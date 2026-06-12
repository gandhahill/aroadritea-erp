/**
 * inventory.setProductAvailability — G4 / T-0301
 *
 * Toggles the "86" flag on a product: a temporary, same-day unavailability
 * marker shown in the POS, independent of `isActive` (catalog enable/disable)
 * and `isSellable` (catalog configuration). `is86dAt` records when a product
 * was last marked unavailable (null once it's marked available again).
 *
 * Permission: inventory.product.update
 */

import { db } from '@erp/db';
import { products } from '@erp/db/schema/inventory';
import { AppError } from '@erp/shared/errors';
import { type Result, err, tryCatch } from '@erp/shared/result';
import type { AuditContext } from '@erp/shared/types';
import { and, eq } from 'drizzle-orm';
import { auditRecord } from '../audit';
import { requirePermission } from '../iam';

export interface ProductAvailabilityResult {
  id: string;
  isAvailable: boolean;
  is86dAt: string | null;
}

export async function setProductAvailability(
  input: { productId: string; isAvailable: boolean },
  ctx: AuditContext,
): Promise<Result<ProductAvailabilityResult>> {
  const permCheck = await requirePermission(ctx.userId, 'inventory.product.update', {
    locationId: ctx.locationId,
  });
  if (!permCheck.ok) return permCheck;

  const { productId, isAvailable } = input;
  if (!productId || productId.trim().length === 0) {
    return err(AppError.validation('inventory.product.invalidId', {}));
  }

  return tryCatch(
    async () => {
      const [existing] = await db
        .select({
          id: products.id,
          isAvailable: products.isAvailable,
          is86dAt: products.is86dAt,
        })
        .from(products)
        .where(and(eq(products.id, productId), eq(products.tenantId, ctx.tenantId)))
        .limit(1);

      if (!existing) {
        throw AppError.notFound('inventory.product.notFound');
      }

      const is86dAt = isAvailable ? null : new Date();

      const [updated] = await db
        .update(products)
        .set({ isAvailable, is86dAt, updatedBy: ctx.userId })
        .where(and(eq(products.id, productId), eq(products.tenantId, ctx.tenantId)))
        .returning({
          id: products.id,
          isAvailable: products.isAvailable,
          is86dAt: products.is86dAt,
        });

      if (!updated) {
        throw AppError.notFound('inventory.product.notFound');
      }

      await auditRecord({
        action: 'update',
        entityType: 'product',
        entityId: productId,
        before: { isAvailable: existing.isAvailable, is86dAt: existing.is86dAt },
        after: { isAvailable: updated.isAvailable, is86dAt: updated.is86dAt },
        metadata: { ip: ctx.ipAddress ?? null, userAgent: ctx.userAgent ?? null },
        ctx,
      });

      return {
        id: updated.id,
        isAvailable: updated.isAvailable,
        is86dAt: updated.is86dAt ? updated.is86dAt.toISOString() : null,
      };
    },
    (e) => {
      if (e instanceof AppError) return e;
      return AppError.internal('inventory.product.setAvailabilityFailed', e);
    },
  );
}
