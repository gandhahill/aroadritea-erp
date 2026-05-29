import { db } from '@erp/db';
import { stockLevels, stockMovements } from '@erp/db/schema/inventory';
import { AppError } from '@erp/shared/errors';
import { generateId } from '@erp/shared/id';
import { type Result, err, ok } from '@erp/shared/result';
import type { AuditContext } from '@erp/shared/types';
import { and, asc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';

export const DepleteStockInputSchema = z.object({
  productId: z.string().min(1),
  locationId: z.string().min(1),
  qtyToDeplete: z.number().positive(),
  reason: z.string(),
  referenceType: z.string().optional(),
  referenceId: z.string().optional(),
});

export type DepleteStockInput = z.infer<typeof DepleteStockInputSchema>;

/**
 * Depletes stock for a specific product at a location using FEFO (First Expired First Out).
 * This will consume stock from batches nearing expiration first.
 */
export async function depleteStock(
  input: DepleteStockInput,
  ctx: AuditContext,
): Promise<Result<{ depletedBatches: { batchNo: string | null; qty: number }[] }>> {
  const parsed = DepleteStockInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(new Error(parsed.error.message));
  }

  // 1. Fetch all available stock levels for this product at this location, ordered by FEFO.
  const availableBatches = await db
    .select()
    .from(stockLevels)
    .where(
      and(
        eq(stockLevels.tenantId, ctx.tenantId),
        eq(stockLevels.locationId, input.locationId),
        eq(stockLevels.productId, input.productId),
        sql`${stockLevels.qtyAvailable} > 0`,
      ),
    )
    // FEFO: NULLs last, so un-expiring items are consumed after expiring items
    .orderBy(asc(sql`${stockLevels.expiryDate} NULLS LAST`), asc(stockLevels.lastMovementAt));

  let remainingQty = input.qtyToDeplete;
  const depletedBatches: { batchNo: string | null; qty: number }[] = [];
  const stockMovementsToInsert = [];

  for (const batch of availableBatches) {
    if (remainingQty <= 0) break;

    const qtyAvailable = Number.parseFloat(batch.qtyAvailable);
    const qtyToTake = Math.min(qtyAvailable, remainingQty);

    depletedBatches.push({ batchNo: batch.batchNo, qty: qtyToTake });
    remainingQty -= qtyToTake;

    // Create a stock movement for this deduction
    stockMovementsToInsert.push({
      id: generateId(),
      tenantId: ctx.tenantId,
      locationId: input.locationId,
      occurredAt: new Date(),
      productId: input.productId,
      batchNo: batch.batchNo,
      expiryDate: batch.expiryDate,
      qtyDelta: (-qtyToTake).toString(),
      uom: batch.uom,
      reason: input.reason,
      referenceType: input.referenceType ?? null,
      referenceId: input.referenceId ?? null,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    });

    // Update stock levels table
    await db
      .update(stockLevels)
      .set({
        qtyOnHand: sql`${stockLevels.qtyOnHand} - ${qtyToTake}`,
        qtyAvailable: sql`${stockLevels.qtyAvailable} - ${qtyToTake}`,
        lastMovementAt: new Date(),
      })
      .where(
        and(
          eq(stockLevels.tenantId, ctx.tenantId),
          eq(stockLevels.locationId, input.locationId),
          eq(stockLevels.productId, input.productId),
          batch.batchNo === null ? sql`${stockLevels.batchNo} IS NULL` : eq(stockLevels.batchNo, batch.batchNo),
        ),
      );
  }

  if (remainingQty > 0.001) {
    return err(
      AppError.businessRule('inventory.errors.insufficient_stock', {
        productId: input.productId,
        required: input.qtyToDeplete,
        shortage: remainingQty,
      }),
    );
  }

  if (stockMovementsToInsert.length > 0) {
    await db.insert(stockMovements).values(stockMovementsToInsert);
  }

  return ok({ depletedBatches });
}
