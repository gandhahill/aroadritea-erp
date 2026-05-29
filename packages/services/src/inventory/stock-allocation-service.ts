import { db } from '@erp/db';
import { stockLevels } from '@erp/db/schema/inventory';
import { AppError } from '@erp/shared/errors';
import { type Result, err, ok } from '@erp/shared/result';
import type { AuditContext } from '@erp/shared/types';
import { and, eq, sql } from 'drizzle-orm';
import { auditRecord } from '../audit';

export async function allocateStock(
  input: {
    locationId: string;
    productId: string;
    variantId?: string | null;
    qtyToAllocate: number;
  },
  ctx: AuditContext,
): Promise<Result<void>> {
  if (input.qtyToAllocate <= 0) return err(AppError.validation('inventory.allocation.qtyMustBePositive'));
  if (!ctx.userId) return err(AppError.unauthenticated('auth.required'));

  const conditions = [
    eq(stockLevels.tenantId, ctx.tenantId),
    eq(stockLevels.locationId, input.locationId),
    eq(stockLevels.productId, input.productId),
  ];
  if (input.variantId) {
    conditions.push(eq(stockLevels.variantId, input.variantId));
  } else {
    conditions.push(sql`${stockLevels.variantId} IS NULL`);
  }

  const [existing] = await db
    .select()
    .from(stockLevels)
    .where(and(...conditions))
    .limit(1);

  if (!existing) {
    return err(AppError.notFound('inventory.stockLevel.notFound'));
  }

  // Update allocation
  const newAllocated = Number(existing.allocatedQty) + input.qtyToAllocate;
  const newAvailable = Number(existing.qtyAvailable) - input.qtyToAllocate;
  
  if (newAvailable < 0) {
    return err(AppError.conflict('inventory.allocation.insufficientStock'));
  }

  await db
    .update(stockLevels)
    .set({
      allocatedQty: newAllocated.toString(),
      qtyAvailable: newAvailable.toString(),
      updatedBy: ctx.userId,
      updatedAt: new Date(),
    })
    .where(eq(stockLevels.id, existing.id));

  await auditRecord({
    action: 'update',
    entityType: 'stock_allocation',
    entityId: existing.id,
    before: { allocatedQty: existing.allocatedQty, qtyAvailable: existing.qtyAvailable },
    after: { allocatedQty: newAllocated.toString(), qtyAvailable: newAvailable.toString() },
    ctx,
  });

  return ok(undefined);
}

export async function deallocateStock(
  input: {
    locationId: string;
    productId: string;
    variantId?: string | null;
    qtyToDeallocate: number;
  },
  ctx: AuditContext,
): Promise<Result<void>> {
  if (input.qtyToDeallocate <= 0) return err(AppError.validation('inventory.allocation.qtyMustBePositive'));
  if (!ctx.userId) return err(AppError.unauthenticated('auth.required'));

  const conditions = [
    eq(stockLevels.tenantId, ctx.tenantId),
    eq(stockLevels.locationId, input.locationId),
    eq(stockLevels.productId, input.productId),
  ];
  if (input.variantId) {
    conditions.push(eq(stockLevels.variantId, input.variantId));
  } else {
    conditions.push(sql`${stockLevels.variantId} IS NULL`);
  }

  const [existing] = await db
    .select()
    .from(stockLevels)
    .where(and(...conditions))
    .limit(1);

  if (!existing) {
    return err(AppError.notFound('inventory.stockLevel.notFound'));
  }

  // Update allocation
  const newAllocated = Math.max(0, Number(existing.allocatedQty) - input.qtyToDeallocate);
  // Only add back the actually deallocated amount
  const actualDeallocated = Number(existing.allocatedQty) - newAllocated;
  const newAvailable = Number(existing.qtyAvailable) + actualDeallocated;
  
  await db
    .update(stockLevels)
    .set({
      allocatedQty: newAllocated.toString(),
      qtyAvailable: newAvailable.toString(),
      updatedBy: ctx.userId,
      updatedAt: new Date(),
    })
    .where(eq(stockLevels.id, existing.id));

  await auditRecord({
    action: 'update',
    entityType: 'stock_deallocation',
    entityId: existing.id,
    before: { allocatedQty: existing.allocatedQty, qtyAvailable: existing.qtyAvailable },
    after: { allocatedQty: newAllocated.toString(), qtyAvailable: newAvailable.toString() },
    ctx,
  });

  return ok(undefined);
}
