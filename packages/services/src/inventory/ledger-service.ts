import { db } from '@erp/db';
import { products, stockMovements } from '@erp/db/schema/inventory';
import { type Result, err, ok } from '@erp/shared/result';
import { and, desc, eq, gte, lte } from 'drizzle-orm';
import { z } from 'zod';

export const GetStockLedgerInputSchema = z.object({
  tenantId: z.string().min(1),
  locationId: z.string().min(1),
  productId: z.string().min(1),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
});

export type GetStockLedgerInput = z.infer<typeof GetStockLedgerInputSchema>;

export interface StockLedgerRow {
  id: string;
  occurredAt: Date;
  reason: string;
  referenceType: string | null;
  referenceId: string | null;
  qtyDelta: string;
  uom: string;
}

export async function getStockLedger(
  input: GetStockLedgerInput,
): Promise<Result<StockLedgerRow[]>> {
  const parsed = GetStockLedgerInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(new Error(parsed.error.message));
  }

  const conditions = [
    eq(stockMovements.tenantId, input.tenantId),
    eq(stockMovements.locationId, input.locationId),
    eq(stockMovements.productId, input.productId),
  ];

  if (input.startDate) {
    conditions.push(gte(stockMovements.occurredAt, input.startDate));
  }
  if (input.endDate) {
    conditions.push(lte(stockMovements.occurredAt, input.endDate));
  }

  const results = await db
    .select({
      id: stockMovements.id,
      occurredAt: stockMovements.occurredAt,
      reason: stockMovements.reason,
      referenceType: stockMovements.referenceType,
      referenceId: stockMovements.referenceId,
      qtyDelta: stockMovements.qtyDelta,
      uom: stockMovements.uom,
    })
    .from(stockMovements)
    .where(and(...conditions))
    .orderBy(desc(stockMovements.occurredAt));

  return ok(results);
}
