/**
 * inventory.updateProduct — SD §9.3, §21.5
 *
 * Updates an existing product with optimistic concurrency (SD §8.4).
 * Returns Result<ProductResult> — never throws.
 *
 * Permission: inventory.product.update
 */

import { eq, and } from 'drizzle-orm';
import { db } from '@erp/db';
import { products, productCategories } from '@erp/db/schema/inventory';
import { auditLog } from '@erp/db/schema/audit';
import { type Result, err, tryCatch } from '@erp/shared/result';
import { AppError } from '@erp/shared/errors';
import { generateId } from '@erp/shared/id';
import type { AuditContext } from '@erp/shared/types';
import { requirePermission } from '../iam';
import { UpdateProductInputSchema, type UpdateProductInput } from './schemas';
import type { ProductResult } from './create-product';

export async function updateProduct(
  input: UpdateProductInput,
  ctx: AuditContext,
): Promise<Result<ProductResult>> {
  // 1. Permission check
  const permCheck = await requirePermission(ctx.userId, 'inventory.product.update', {
    locationId: ctx.locationId,
  });
  if (!permCheck.ok) return permCheck;

  // 2. Validate input
  const parsed = UpdateProductInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      AppError.validation('inventory.product.validationFailed', {
        issues: parsed.error.issues,
      }),
    );
  }
  const data = parsed.data;

  // 3. Fetch existing product
  const [existing] = await db
    .select()
    .from(products)
    .where(and(eq(products.tenantId, ctx.tenantId), eq(products.id, data.productId)))
    .limit(1);

  if (!existing) {
    return err(AppError.notFound('inventory.product.notFound', { productId: data.productId }));
  }

  // 4. Optimistic concurrency check (SD §8.4)
  if (existing.version !== data.version) {
    return err(
      AppError.conflict('inventory.product.versionMismatch', {
        expected: data.version,
        actual: existing.version,
      }),
    );
  }

  // 5. If categoryId changed, validate new category
  if (data.categoryId && data.categoryId !== existing.categoryId) {
    const category = await db
      .select({ id: productCategories.id, isActive: productCategories.isActive })
      .from(productCategories)
      .where(
        and(
          eq(productCategories.tenantId, ctx.tenantId),
          eq(productCategories.id, data.categoryId),
        ),
      )
      .then((rows) => rows[0]);

    if (!category) {
      return err(AppError.notFound('inventory.product.categoryNotFound', { categoryId: data.categoryId }));
    }
    if (!category.isActive) {
      return err(AppError.businessRule('inventory.product.categoryInactive', { categoryId: data.categoryId }));
    }
  }

  // 6. Build update payload (only changed fields)
  const updates: Record<string, unknown> = {
    updatedAt: new Date(),
    updatedBy: ctx.userId,
    version: existing.version + 1,
  };

  if (data.name !== undefined) updates.name = data.name;
  if (data.description !== undefined) updates.description = data.description;
  if (data.categoryId !== undefined) updates.categoryId = data.categoryId;
  if (data.kind !== undefined) updates.kind = data.kind;
  if (data.uom !== undefined) updates.uom = data.uom;
  if (data.isSellable !== undefined) updates.isSellable = data.isSellable;
  if (data.isPurchasable !== undefined) updates.isPurchasable = data.isPurchasable;
  if (data.trackBatch !== undefined) updates.trackBatch = data.trackBatch;
  if (data.trackExpiry !== undefined) updates.trackExpiry = data.trackExpiry;
  if (data.shelfLifeDays !== undefined) updates.shelfLifeDays = data.shelfLifeDays;
  if (data.defaultSellPrice !== undefined) updates.defaultSellPrice = BigInt(data.defaultSellPrice);
  if (data.defaultCostPrice !== undefined) updates.defaultCostPrice = BigInt(data.defaultCostPrice);
  if (data.cogsAccountId !== undefined) updates.cogsAccountId = data.cogsAccountId;
  if (data.revenueAccountId !== undefined) updates.revenueAccountId = data.revenueAccountId;
  if (data.inventoryAccountId !== undefined) updates.inventoryAccountId = data.inventoryAccountId;
  if (data.taxCode !== undefined) updates.taxCode = data.taxCode;
  if (data.imageUrl !== undefined) updates.imageUrl = data.imageUrl;
  if (data.isActive !== undefined) updates.isActive = data.isActive;

  return tryCatch(
    async () => {
      // 7. Conditional update with version check
      const [updated] = await db
        .update(products)
        .set(updates)
        .where(
          and(
            eq(products.id, data.productId),
            eq(products.version, data.version),
          ),
        )
        .returning();

      if (!updated) {
        throw AppError.conflict('inventory.product.concurrentUpdate');
      }

      // 8. Audit log
      await db.insert(auditLog).values({
        id: generateId(),
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        action: 'update',
        entityType: 'product',
        entityId: data.productId,
        before: { sku: existing.sku, name: existing.name, version: existing.version },
        after: { ...updates, version: existing.version + 1 },
        metadata: { ip: ctx.ipAddress ?? null, userAgent: ctx.userAgent ?? null },
      });

      const result: ProductResult = {
        id: updated.id,
        sku: updated.sku,
        name: updated.name as { id: string; en: string; zh: string },
        categoryId: updated.categoryId,
        kind: updated.kind,
        uom: updated.uom,
        isSellable: updated.isSellable,
        isPurchasable: updated.isPurchasable,
        trackBatch: updated.trackBatch,
        trackExpiry: updated.trackExpiry,
        shelfLifeDays: updated.shelfLifeDays,
        defaultSellPrice: String(updated.defaultSellPrice),
        defaultCostPrice: String(updated.defaultCostPrice),
        isActive: updated.isActive,
        version: updated.version,
      };

      return result;
    },
    (e) => {
      if (e instanceof AppError) return e;
      return AppError.internal('inventory.product.updateFailed', e);
    },
  );
}
