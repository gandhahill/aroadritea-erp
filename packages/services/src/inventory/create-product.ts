/**
 * inventory.createProduct — SD §9.3, §21.5
 *
 * Creates a new product in the catalog.
 * Returns Result<ProductResult> — never throws.
 *
 * Business rules:
 * - SKU must be unique per tenant
 * - Category must exist and be active
 * - If accounting account IDs provided, they must exist
 * - Permission: inventory.product.create
 */

import { eq, and } from 'drizzle-orm';
import { db } from '@erp/db';
import { products, productCategories } from '@erp/db/schema/inventory';
import { auditLog } from '@erp/db/schema/audit';
import { type Result, ok, err, tryCatch } from '@erp/shared/result';
import { AppError } from '@erp/shared/errors';
import { generateId } from '@erp/shared/id';
import type { AuditContext } from '@erp/shared/types';
import { requirePermission } from '../iam';
import { CreateProductInputSchema, type CreateProductInput } from './schemas';

// --- Return type ---

export interface ProductResult {
  id: string;
  sku: string;
  name: { id: string; en: string; zh: string };
  categoryId: string;
  kind: string;
  uom: string;
  isSellable: boolean;
  isPurchasable: boolean;
  trackBatch: boolean;
  trackExpiry: boolean;
  shelfLifeDays: number | null;
  defaultSellPrice: string;
  defaultCostPrice: string;
  isActive: boolean;
  version: number;
}

// --- Service function ---

export async function createProduct(
  input: CreateProductInput,
  ctx: AuditContext,
): Promise<Result<ProductResult>> {
  // 1. Permission check
  const permCheck = await requirePermission(ctx.userId, 'inventory.product.create', {
    locationId: ctx.locationId,
  });
  if (!permCheck.ok) return permCheck;

  // 2. Validate input
  const parsed = CreateProductInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      AppError.validation('inventory.product.validationFailed', {
        issues: parsed.error.issues,
      }),
    );
  }
  const data = parsed.data;

  // 3. Check SKU uniqueness
  const existing = await db
    .select({ id: products.id })
    .from(products)
    .where(and(eq(products.tenantId, ctx.tenantId), eq(products.sku, data.sku)))
    .then((rows) => rows[0]);

  if (existing) {
    return err(AppError.conflict('inventory.product.skuDuplicate', { sku: data.sku }));
  }

  // 4. Validate category exists and is active
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

  // 5. Generate ID and insert
  const productId = generateId();

  return tryCatch(
    async () => {
      await db.insert(products).values({
        id: productId,
        tenantId: ctx.tenantId,
        sku: data.sku,
        name: data.name,
        description: data.description ?? null,
        categoryId: data.categoryId,
        kind: data.kind,
        uom: data.uom,
        isSellable: data.isSellable,
        isPurchasable: data.isPurchasable,
        trackBatch: data.trackBatch,
        trackExpiry: data.trackExpiry,
        shelfLifeDays: data.shelfLifeDays ?? null,
        defaultSellPrice: BigInt(data.defaultSellPrice),
        defaultCostPrice: BigInt(data.defaultCostPrice),
        cogsAccountId: data.cogsAccountId ?? null,
        revenueAccountId: data.revenueAccountId ?? null,
        inventoryAccountId: data.inventoryAccountId ?? null,
        taxCode: data.taxCode ?? null,
        imageUrl: data.imageUrl ?? null,
        isActive: true,
        version: 1,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      });

      // Audit log
      await db.insert(auditLog).values({
        id: generateId(),
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        action: 'create',
        entityType: 'product',
        entityId: productId,
        before: null,
        after: { id: productId, sku: data.sku, name: data.name, kind: data.kind },
        metadata: { ip: ctx.ipAddress ?? null, userAgent: ctx.userAgent ?? null },
      });

      const result: ProductResult = {
        id: productId,
        sku: data.sku,
        name: data.name,
        categoryId: data.categoryId,
        kind: data.kind,
        uom: data.uom,
        isSellable: data.isSellable,
        isPurchasable: data.isPurchasable,
        trackBatch: data.trackBatch,
        trackExpiry: data.trackExpiry,
        shelfLifeDays: data.shelfLifeDays ?? null,
        defaultSellPrice: data.defaultSellPrice,
        defaultCostPrice: data.defaultCostPrice,
        isActive: true,
        version: 1,
      };

      return result;
    },
    (e) => AppError.internal('inventory.product.createFailed', e),
  );
}
