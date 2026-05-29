import { db } from '@erp/db';
import { salesOrders } from '@erp/db/schema/pos';
import { AppError } from '@erp/shared/errors';
import { type Result, err, ok } from '@erp/shared/result';
import type { AuditContext } from '@erp/shared/types';
import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';

export const ParkSaleInputSchema = z.object({
  saleId: z.string().min(1),
  note: z.string().min(1),
});

export type ParkSaleInput = z.infer<typeof ParkSaleInputSchema>;

export async function parkSale(input: ParkSaleInput, ctx: AuditContext): Promise<Result<{ id: string }>> {
  const parsed = ParkSaleInputSchema.safeParse(input);
  if (!parsed.success) return err(AppError.validation(parsed.error.message));

  const [sale] = await db
    .select()
    .from(salesOrders)
    .where(and(eq(salesOrders.id, input.saleId), eq(salesOrders.tenantId, ctx.tenantId)));

  if (!sale) return err(AppError.notFound('sales.errors.sale_not_found'));
  if (sale.status !== 'open') return err(AppError.businessRule('sales.errors.cannot_park_non_open_sale'));

  await db
    .update(salesOrders)
    .set({
      status: 'parked',
      parkedAt: new Date(),
      parkNote: input.note,
      updatedBy: ctx.userId,
      version: sale.version + 1,
    })
    .where(and(eq(salesOrders.id, sale.id), eq(salesOrders.version, sale.version)));

  return ok({ id: sale.id });
}

export async function recallSale(saleId: string, ctx: AuditContext): Promise<Result<{ id: string }>> {
  const [sale] = await db
    .select()
    .from(salesOrders)
    .where(and(eq(salesOrders.id, saleId), eq(salesOrders.tenantId, ctx.tenantId)));

  if (!sale) return err(AppError.notFound('sales.errors.sale_not_found'));
  if (sale.status !== 'parked') return err(AppError.businessRule('sales.errors.cannot_recall_non_parked_sale'));

  await db
    .update(salesOrders)
    .set({
      status: 'open',
      parkedAt: null,
      parkNote: null,
      updatedBy: ctx.userId,
      version: sale.version + 1,
    })
    .where(and(eq(salesOrders.id, sale.id), eq(salesOrders.version, sale.version)));

  return ok({ id: sale.id });
}
