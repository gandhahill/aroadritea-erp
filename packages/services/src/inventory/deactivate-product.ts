/**
 * inventory.deactivateProduct — SD §9.3, §21.5
 *
 * Soft-deletes a product by setting isActive = false.
 * Permission: inventory.product.update
 */

import { db } from '@erp/db';
import { products } from '@erp/db/schema/inventory';
import { AppError } from '@erp/shared/errors';
import { type Result, err, tryCatch } from '@erp/shared/result';
import type { AuditContext } from '@erp/shared/types';
import { and, eq } from 'drizzle-orm';
import { requirePermission } from '../iam';

export async function deactivateProduct(
  productId: string,
  ctx: AuditContext,
): Promise<Result<{ id: string }>> {
  const permCheck = await requirePermission(ctx.userId, 'inventory.product.update', {
    locationId: ctx.locationId,
  });
  if (!permCheck.ok) return permCheck;

  if (!productId || productId.trim().length === 0) {
    return err(AppError.validation('inventory.product.invalidId', {}));
  }

  return tryCatch(
    async () => {
      const [updated] = await db
        .update(products)
        .set({ isActive: false, updatedBy: ctx.userId })
        .where(and(eq(products.id, productId), eq(products.tenantId, ctx.tenantId)))
        .returning({ id: products.id });

      if (!updated) throw AppError.notFound('inventory.product.notFound');
      return { id: updated.id };
    },
    (e) => {
      if (e instanceof AppError) return e;
      return AppError.internal('inventory.product.deactivateFailed', e);
    },
  );
}

export async function reactivateProduct(
  productId: string,
  ctx: AuditContext,
): Promise<Result<{ id: string }>> {
  const permCheck = await requirePermission(ctx.userId, 'inventory.product.update', {
    locationId: ctx.locationId,
  });
  if (!permCheck.ok) return permCheck;

  if (!productId || productId.trim().length === 0) {
    return err(AppError.validation('inventory.product.invalidId', {}));
  }

  return tryCatch(
    async () => {
      const [updated] = await db
        .update(products)
        .set({ isActive: true, updatedBy: ctx.userId })
        .where(and(eq(products.id, productId), eq(products.tenantId, ctx.tenantId)))
        .returning({ id: products.id });

      if (!updated) throw AppError.notFound('inventory.product.notFound');
      return { id: updated.id };
    },
    (e) => {
      if (e instanceof AppError) return e;
      return AppError.internal('inventory.product.reactivateFailed', e);
    },
  );
}
