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

export interface DepletedBatchResult {
  batchNo: string | null;
  qty: number;
  unitCost: bigint | null;
  totalCost: bigint;
}

export interface DepleteStockResult {
  depletedBatches: DepletedBatchResult[];
  totalCost: bigint;
}

function scaledCost(qty: number, unitCost: bigint | null): bigint {
  if (!unitCost) return 0n;
  return (BigInt(Math.round(qty * 1000)) * unitCost) / 1000n;
}

/**
 * Depletes stock for a specific product at a location using FEFO (First Expired First Out).
 * This will consume stock from batches nearing expiration first.
 */
export async function depleteStock(
  input: DepleteStockInput,
  ctx: AuditContext,
  opts: { tx?: any } = {},
): Promise<Result<DepleteStockResult>> {
  const parsed = DepleteStockInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(AppError.validation('common.errors.validationFailed', { issues: parsed.error.issues }));
  }

  const execute = async (client: any): Promise<DepleteStockResult> => {
    const now = new Date();

    // 1. Fetch all available stock levels for this product at this location,
    // ordered by FEFO. Build the depletion plan before mutating any row.
    const availableBatches = await client
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
      .orderBy(asc(sql`${stockLevels.expiryDate} NULLS LAST`), asc(stockLevels.lastMovementAt));

    const totalAvailable = availableBatches.reduce(
      (sum: number, batch: typeof stockLevels.$inferSelect) =>
        sum + Number.parseFloat(batch.qtyAvailable),
      0,
    );

    if (totalAvailable + 0.001 < input.qtyToDeplete) {
      throw AppError.businessRule('inventory.errors.insufficient_stock', {
        productId: input.productId,
        required: input.qtyToDeplete,
        shortage: input.qtyToDeplete - totalAvailable,
      });
    }

    let remainingQty = input.qtyToDeplete;
    const depletedBatches: DepletedBatchResult[] = [];
    const stockMovementsToInsert: Array<typeof stockMovements.$inferInsert> = [];

    for (const batch of availableBatches) {
      if (remainingQty <= 0.001) break;

      const qtyAvailable = Number.parseFloat(batch.qtyAvailable);
      const qtyToTake = Math.min(qtyAvailable, remainingQty);
      const unitCost = batch.avgUnitCost ?? null;
      const totalCost = scaledCost(qtyToTake, unitCost);

      depletedBatches.push({
        batchNo: batch.batchNo,
        qty: qtyToTake,
        unitCost,
        totalCost,
      });
      remainingQty -= qtyToTake;

      stockMovementsToInsert.push({
        id: generateId(),
        tenantId: ctx.tenantId,
        locationId: input.locationId,
        occurredAt: now,
        stockLocationId: batch.stockLocationId ?? null,
        productId: input.productId,
        variantId: batch.variantId ?? null,
        batchNo: batch.batchNo,
        expiryDate: batch.expiryDate,
        qtyDelta: (-qtyToTake).toString(),
        uom: batch.uom,
        reason: input.reason,
        referenceType: input.referenceType ?? null,
        referenceId: input.referenceId ?? null,
        unitCost,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      });

      const updated = await client
        .update(stockLevels)
        .set({
          qtyOnHand: sql`${stockLevels.qtyOnHand} - ${qtyToTake}::numeric`,
          qtyAvailable: sql`${stockLevels.qtyAvailable} - ${qtyToTake}::numeric`,
          updatedBy: ctx.userId,
          lastMovementAt: now,
        })
        .where(
          and(
            eq(stockLevels.id, batch.id),
            eq(stockLevels.tenantId, ctx.tenantId),
            sql`${stockLevels.qtyOnHand} >= ${qtyToTake}::numeric`,
            sql`${stockLevels.qtyAvailable} >= ${qtyToTake}::numeric`,
          ),
        )
        .returning({ id: stockLevels.id });

      if (updated.length === 0) {
        throw AppError.businessRule('inventory.errors.insufficient_stock', {
          productId: input.productId,
          required: input.qtyToDeplete,
        });
      }
    }

    if (stockMovementsToInsert.length > 0) {
      await client.insert(stockMovements).values(stockMovementsToInsert);
    }

    return {
      depletedBatches,
      totalCost: depletedBatches.reduce((sum, batch) => sum + batch.totalCost, 0n),
    };
  };

  try {
    const result = opts.tx ? await execute(opts.tx) : await db.transaction(execute);
    return ok(result);
  } catch (e) {
    if (e instanceof AppError) return err(e);
    return err(AppError.internal('inventory.errors.depletion_failed', e));
  }
}
