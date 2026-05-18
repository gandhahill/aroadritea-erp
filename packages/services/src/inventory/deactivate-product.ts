/**
 * inventory.deactivateProduct — SD §9.3, §21.5
 *
 * Soft-deletes a product by setting isActive = false.
 * Permission: inventory.product.update
 */

import { db } from '@erp/db';
import { auditLog } from '@erp/db/schema/audit';
import { products } from '@erp/db/schema/inventory';
import { AppError } from '@erp/shared/errors';
import { generateId } from '@erp/shared/id';
import { type Result, err, tryCatch } from '@erp/shared/result';
import type { AuditContext } from '@erp/shared/types';
import { and, eq } from 'drizzle-orm';
import { requirePermission } from '../iam';

async function toggleProductActive(
  productId: string,
  active: boolean,
  ctx: AuditContext,
  permKey: string,
): Promise<Result<{ id: string }>> {
  const permCheck = await requirePermission(ctx.userId, permKey, {
    locationId: ctx.locationId,
  });
  if (!permCheck.ok) return permCheck;

  if (!productId || productId.trim().length === 0) {
    return err(AppError.validation('inventory.product.invalidId', {}));
  }

  return tryCatch(
    async () => {
      // Atomic toggle that only succeeds when the row is currently in
      // the OPPOSITE state. Returning rows distinguishes a no-op (idle
      // double-click on the same button) from a real not-found case.
      const [updated] = await db
        .update(products)
        .set({ isActive: active, updatedBy: ctx.userId })
        .where(
          and(
            eq(products.id, productId),
            eq(products.tenantId, ctx.tenantId),
            eq(products.isActive, !active),
          ),
        )
        .returning({ id: products.id });

      if (!updated) {
        const existing = await db
          .select({ id: products.id })
          .from(products)
          .where(and(eq(products.id, productId), eq(products.tenantId, ctx.tenantId)))
          .limit(1);
        if (existing.length === 0) {
          throw AppError.notFound('inventory.product.notFound');
        }
        // Row exists but already in the desired state — treat as success.
        return { id: productId };
      }

      await db.insert(auditLog).values({
        id: generateId(),
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        action: active ? 'reactivate' : 'deactivate',
        entityType: 'product',
        entityId: productId,
        before: { isActive: !active },
        after: { isActive: active },
        metadata: { ip: ctx.ipAddress ?? null, userAgent: ctx.userAgent ?? null },
      });

      return { id: updated.id };
    },
    (e) => {
      if (e instanceof AppError) return e;
      return AppError.internal(
        active ? 'inventory.product.reactivateFailed' : 'inventory.product.deactivateFailed',
        e,
      );
    },
  );
}

export async function deactivateProduct(
  productId: string,
  ctx: AuditContext,
): Promise<Result<{ id: string }>> {
  return toggleProductActive(productId, false, ctx, 'inventory.product.update');
}

export async function reactivateProduct(
  productId: string,
  ctx: AuditContext,
): Promise<Result<{ id: string }>> {
  return toggleProductActive(productId, true, ctx, 'inventory.product.update');
}
