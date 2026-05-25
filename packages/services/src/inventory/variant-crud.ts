/**
 * inventory.createVariant / updateVariant — SD §9.3
 *
 * CRUD for product variants (size × temperature).
 * Permission: inventory.product.update (variants are sub-resource of products)
 */

import { db } from '@erp/db';
import { productVariants, products } from '@erp/db/schema/inventory';
import { AppError } from '@erp/shared/errors';
import { generateId } from '@erp/shared/id';
import { type Result, err, tryCatch } from '@erp/shared/result';
import type { AuditContext } from '@erp/shared/types';
import { and, eq } from 'drizzle-orm';
import { auditRecord } from '../audit';
import { requirePermission } from '../iam';
import type { VariantResult } from './list-products';
import {
  type CreateVariantInput,
  CreateVariantInputSchema,
  type UpdateVariantInput,
  UpdateVariantInputSchema,
} from './schemas';

// --- Create variant ---

export async function createVariant(
  input: CreateVariantInput,
  ctx: AuditContext,
): Promise<Result<VariantResult>> {
  const permCheck = await requirePermission(ctx.userId, 'inventory.product.update', {
    locationId: ctx.locationId,
  });
  if (!permCheck.ok) return permCheck;

  const parsed = CreateVariantInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      AppError.validation('inventory.variant.validationFailed', { issues: parsed.error.issues }),
    );
  }
  const data = parsed.data;

  // Validate parent product exists
  const [product] = await db
    .select({ id: products.id })
    .from(products)
    .where(and(eq(products.tenantId, ctx.tenantId), eq(products.id, data.productId)))
    .limit(1);

  if (!product) {
    return err(
      AppError.notFound('inventory.variant.productNotFound', { productId: data.productId }),
    );
  }

  // Check SKU uniqueness
  const [existing] = await db
    .select({ id: productVariants.id })
    .from(productVariants)
    .where(and(eq(productVariants.tenantId, ctx.tenantId), eq(productVariants.sku, data.sku)))
    .limit(1);

  if (existing) {
    return err(AppError.conflict('inventory.variant.skuDuplicate', { sku: data.sku }));
  }

  const variantId = generateId();

  return tryCatch(
    async () => {
      await db.insert(productVariants).values({
        id: variantId,
        tenantId: ctx.tenantId,
        productId: data.productId,
        sku: data.sku,
        name: data.name,
        sellPrice: BigInt(data.sellPrice),
        costPrice: BigInt(data.costPrice),
        attributes: data.attributes as Record<string, string>,
        sortOrder: data.sortOrder,
        isActive: true,
        version: 1,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      });

      await auditRecord({
        action: 'create',
        entityType: 'product_variant',
        entityId: variantId,
        before: null,
        after: { id: variantId, sku: data.sku, productId: data.productId },
        metadata: { ip: ctx.ipAddress ?? null, userAgent: ctx.userAgent ?? null },
        ctx,
      });

      return {
        id: variantId,
        sku: data.sku,
        name: data.name,
        sellPrice: data.sellPrice,
        costPrice: data.costPrice,
        attributes: data.attributes as Record<string, string>,
        sortOrder: data.sortOrder,
        isActive: true,
        version: 1,
      } satisfies VariantResult;
    },
    (e) => AppError.internal('inventory.variant.createFailed', e),
  );
}

// --- Update variant ---

export async function updateVariant(
  input: UpdateVariantInput,
  ctx: AuditContext,
): Promise<Result<VariantResult>> {
  const permCheck = await requirePermission(ctx.userId, 'inventory.product.update', {
    locationId: ctx.locationId,
  });
  if (!permCheck.ok) return permCheck;

  const parsed = UpdateVariantInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      AppError.validation('inventory.variant.validationFailed', { issues: parsed.error.issues }),
    );
  }
  const data = parsed.data;

  // Fetch existing
  const [existing] = await db
    .select()
    .from(productVariants)
    .where(and(eq(productVariants.tenantId, ctx.tenantId), eq(productVariants.id, data.variantId)))
    .limit(1);

  if (!existing) {
    return err(AppError.notFound('inventory.variant.notFound', { variantId: data.variantId }));
  }

  // Optimistic concurrency
  if (existing.version !== data.version) {
    return err(
      AppError.conflict('inventory.variant.versionMismatch', {
        expected: data.version,
        actual: existing.version,
      }),
    );
  }

  const updates: Record<string, unknown> = {
    updatedAt: new Date(),
    updatedBy: ctx.userId,
    version: existing.version + 1,
  };

  if (data.name !== undefined) updates.name = data.name;
  if (data.sellPrice !== undefined) updates.sellPrice = BigInt(data.sellPrice);
  if (data.costPrice !== undefined) updates.costPrice = BigInt(data.costPrice);
  if (data.attributes !== undefined) updates.attributes = data.attributes as Record<string, string>;
  if (data.sortOrder !== undefined) updates.sortOrder = data.sortOrder;
  if (data.isActive !== undefined) updates.isActive = data.isActive;

  return tryCatch(
    async () => {
      const [updated] = await db
        .update(productVariants)
        .set(updates)
        .where(
          and(
            eq(productVariants.id, data.variantId),
            eq(productVariants.tenantId, ctx.tenantId),
            eq(productVariants.version, data.version),
          ),
        )
        .returning();

      if (!updated) {
        throw AppError.conflict('inventory.variant.concurrentUpdate');
      }

      // Determine audit action: if isActive goes from true→false, it's a soft-delete
      const auditAction =
        data.isActive === false && existing.isActive === true ? 'delete' : 'update';

      await auditRecord({
        action: auditAction,
        entityType: 'product_variant',
        entityId: data.variantId,
        before: { sku: existing.sku, version: existing.version, isActive: existing.isActive },
        after: { ...updates, version: existing.version + 1 },
        metadata: { ip: ctx.ipAddress ?? null, userAgent: ctx.userAgent ?? null },
        ctx,
      });

      return {
        id: updated.id,
        sku: updated.sku,
        name: updated.name as { id: string; en: string; zh: string },
        sellPrice: String(updated.sellPrice),
        costPrice: String(updated.costPrice),
        attributes: (updated.attributes ?? {}) as Record<string, string>,
        sortOrder: updated.sortOrder,
        isActive: updated.isActive,
        version: updated.version,
      } satisfies VariantResult;
    },
    (e) => {
      if (e instanceof AppError) return e;
      return AppError.internal('inventory.variant.updateFailed', e);
    },
  );
}
