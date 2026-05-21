/**
 * inventory.listProducts / getProduct — SD §9.3, §21.5
 *
 * Read operations for products catalog.
 * Permission: inventory.product.read
 */

import { db } from '@erp/db';
import { productCategories, productVariants, products } from '@erp/db/schema/inventory';
import { AppError } from '@erp/shared/errors';
import { type Result, err, ok, tryCatch } from '@erp/shared/result';
import type { AuditContext } from '@erp/shared/types';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { requirePermission } from '../iam';
import type { ProductResult } from './create-product';
import { type ListProductsInput, ListProductsInputSchema } from './schemas';

// --- Extended types for list results ---

export interface ProductListItem extends ProductResult {
  categoryCode: string;
  categoryName: { id: string; en: string; zh: string };
  imageUrl: string | null;
  variantCount: number;
  /** Cheapest sell price across active variants (string bigint rupiah). Null when no variants. */
  variantPriceMin: string | null;
  /** Most expensive sell price across active variants. Null when no variants. */
  variantPriceMax: string | null;
}

export interface ProductDetailResult extends ProductResult {
  description: { id: string; en: string; zh: string } | null;
  categoryCode: string;
  categoryName: { id: string; en: string; zh: string };
  cogsAccountId: string | null;
  revenueAccountId: string | null;
  inventoryAccountId: string | null;
  taxCode: string | null;
  imageUrl: string | null;
  variants: VariantResult[];
  createdAt: Date;
  updatedAt: Date;
}

export interface VariantResult {
  id: string;
  sku: string;
  name: { id: string; en: string; zh: string };
  sellPrice: string;
  costPrice: string;
  attributes: Record<string, string>;
  sortOrder: number;
  isActive: boolean;
  version: number;
}

// --- List products ---

export async function listProducts(
  input: ListProductsInput,
  ctx: AuditContext,
): Promise<Result<{ items: ProductListItem[]; total: number }>> {
  const permCheck = await requirePermission(ctx.userId, 'inventory.product.read', {
    locationId: ctx.locationId,
  });
  if (!permCheck.ok) return permCheck;

  const parsed = ListProductsInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      AppError.validation('inventory.product.validationFailed', { issues: parsed.error.issues }),
    );
  }
  const data = parsed.data;

  return tryCatch(
    async () => {
      // Build conditions
      const conditions = [eq(products.tenantId, ctx.tenantId)];

      if (data.isActive !== undefined) {
        conditions.push(eq(products.isActive, data.isActive));
      }
      if (data.categoryId) {
        conditions.push(eq(products.categoryId, data.categoryId));
      }
      if (data.kind) {
        conditions.push(eq(products.kind, data.kind));
      }
      if (data.isSellable !== undefined) {
        conditions.push(eq(products.isSellable, data.isSellable));
      }
      if (data.isPurchasable !== undefined) {
        conditions.push(eq(products.isPurchasable, data.isPurchasable));
      }
      if (data.search) {
        // Search by SKU or name (Indonesian locale)
        const searchPattern = `%${data.search}%`;
        conditions.push(
          sql`(${products.sku} ILIKE ${searchPattern} OR ${products.name}->>'id' ILIKE ${searchPattern} OR ${products.name}->>'en' ILIKE ${searchPattern})`,
        );
      }

      const whereClause = and(...conditions);

      // Count total
      const countRows = await db
        .select({ count: sql<number>`cast(count(*) as int)` })
        .from(products)
        .where(whereClause);

      const total = countRows[0]?.count ?? 0;

      // Fetch items
      const rows = await db
        .select({
          id: products.id,
          sku: products.sku,
          name: products.name,
          categoryId: products.categoryId,
          kind: products.kind,
          opnameFrequency: products.opnameFrequency,
          opnameFrequencies: products.opnameFrequencies,
          uom: products.uom,
          isSellable: products.isSellable,
          isPurchasable: products.isPurchasable,
          trackBatch: products.trackBatch,
          trackExpiry: products.trackExpiry,
          shelfLifeDays: products.shelfLifeDays,
          defaultSellPrice: products.defaultSellPrice,
          defaultCostPrice: products.defaultCostPrice,
          imageUrl: products.imageUrl,
          isActive: products.isActive,
          version: products.version,
          categoryCode: productCategories.code,
          categoryName: productCategories.name,
        })
        .from(products)
        .leftJoin(
          productCategories,
          and(
            eq(products.categoryId, productCategories.id),
            eq(productCategories.tenantId, ctx.tenantId),
          ),
        )
        .where(whereClause)
        .orderBy(products.sku)
        .limit(data.limit)
        .offset(data.offset);

      // Count + price-range variants per product (batch query). The price
      // range powers the catalog table's "Rp X – Rp Y" cell so callers don't
      // need to refetch variants just to render a price.
      const productIds = rows.map((r) => r.id);
      let variantCounts: Map<string, number> = new Map();
      let variantPriceMins: Map<string, string> = new Map();
      let variantPriceMaxes: Map<string, string> = new Map();

      if (productIds.length > 0) {
        const vcRows = await db
          .select({
            productId: productVariants.productId,
            count: sql<number>`cast(count(*) as int)`,
            minPrice: sql<string>`min(${productVariants.sellPrice})::text`,
            maxPrice: sql<string>`max(${productVariants.sellPrice})::text`,
          })
          .from(productVariants)
          .where(
            and(inArray(productVariants.productId, productIds), eq(productVariants.isActive, true)),
          )
          .groupBy(productVariants.productId);

        variantCounts = new Map(vcRows.map((r) => [r.productId, r.count]));
        variantPriceMins = new Map(vcRows.map((r) => [r.productId, r.minPrice]));
        variantPriceMaxes = new Map(vcRows.map((r) => [r.productId, r.maxPrice]));
      }

      const items: ProductListItem[] = rows.map((r) => ({
        id: r.id,
        sku: r.sku,
        name: r.name as { id: string; en: string; zh: string },
        categoryId: r.categoryId,
        kind: r.kind,
        opnameFrequency: r.opnameFrequency,
        opnameFrequencies: r.opnameFrequencies,
        uom: r.uom,
        isSellable: r.isSellable,
        isPurchasable: r.isPurchasable,
        trackBatch: r.trackBatch,
        trackExpiry: r.trackExpiry,
        shelfLifeDays: r.shelfLifeDays,
        defaultSellPrice: String(r.defaultSellPrice),
        defaultCostPrice: String(r.defaultCostPrice),
        imageUrl: r.imageUrl,
        isActive: r.isActive,
        version: r.version,
        categoryCode: r.categoryCode ?? '',
        categoryName: (r.categoryName ?? { id: '', en: '', zh: '' }) as {
          id: string;
          en: string;
          zh: string;
        },
        variantCount: variantCounts.get(r.id) ?? 0,
        variantPriceMin: variantPriceMins.get(r.id) ?? null,
        variantPriceMax: variantPriceMaxes.get(r.id) ?? null,
      }));

      return { items, total };
    },
    (e) => AppError.internal('inventory.product.listFailed', e),
  );
}

// --- Get single product with variants ---

export async function getProduct(
  productId: string,
  ctx: AuditContext,
): Promise<Result<ProductDetailResult>> {
  const permCheck = await requirePermission(ctx.userId, 'inventory.product.read', {
    locationId: ctx.locationId,
  });
  if (!permCheck.ok) return permCheck;

  return tryCatch(
    async () => {
      // Fetch product with category
      const [row] = await db
        .select({
          id: products.id,
          sku: products.sku,
          name: products.name,
          description: products.description,
          categoryId: products.categoryId,
          kind: products.kind,
          opnameFrequency: products.opnameFrequency,
          opnameFrequencies: products.opnameFrequencies,
          uom: products.uom,
          isSellable: products.isSellable,
          isPurchasable: products.isPurchasable,
          trackBatch: products.trackBatch,
          trackExpiry: products.trackExpiry,
          shelfLifeDays: products.shelfLifeDays,
          defaultSellPrice: products.defaultSellPrice,
          defaultCostPrice: products.defaultCostPrice,
          cogsAccountId: products.cogsAccountId,
          revenueAccountId: products.revenueAccountId,
          inventoryAccountId: products.inventoryAccountId,
          taxCode: products.taxCode,
          imageUrl: products.imageUrl,
          isActive: products.isActive,
          version: products.version,
          createdAt: products.createdAt,
          updatedAt: products.updatedAt,
          categoryCode: productCategories.code,
          categoryName: productCategories.name,
        })
        .from(products)
        .leftJoin(
          productCategories,
          and(
            eq(products.categoryId, productCategories.id),
            eq(productCategories.tenantId, ctx.tenantId),
          ),
        )
        .where(and(eq(products.tenantId, ctx.tenantId), eq(products.id, productId)))
        .limit(1);

      if (!row) {
        throw AppError.notFound('inventory.product.notFound', { productId });
      }

      // Fetch variants — tenant-scoped (variants live under a product but
      // a stray join could still leak a cross-tenant row).
      const variants = await db
        .select()
        .from(productVariants)
        .where(
          and(
            eq(productVariants.productId, productId),
            eq(productVariants.tenantId, ctx.tenantId),
          ),
        )
        .orderBy(productVariants.sortOrder);

      const result: ProductDetailResult = {
        id: row.id,
        sku: row.sku,
        name: row.name as { id: string; en: string; zh: string },
        description: row.description as { id: string; en: string; zh: string } | null,
        categoryId: row.categoryId,
        kind: row.kind,
        opnameFrequency: row.opnameFrequency,
        opnameFrequencies: row.opnameFrequencies,
        uom: row.uom,
        isSellable: row.isSellable,
        isPurchasable: row.isPurchasable,
        trackBatch: row.trackBatch,
        trackExpiry: row.trackExpiry,
        shelfLifeDays: row.shelfLifeDays,
        defaultSellPrice: String(row.defaultSellPrice),
        defaultCostPrice: String(row.defaultCostPrice),
        cogsAccountId: row.cogsAccountId,
        revenueAccountId: row.revenueAccountId,
        inventoryAccountId: row.inventoryAccountId,
        taxCode: row.taxCode,
        imageUrl: row.imageUrl,
        isActive: row.isActive,
        version: row.version,
        categoryCode: row.categoryCode ?? '',
        categoryName: (row.categoryName ?? { id: '', en: '', zh: '' }) as {
          id: string;
          en: string;
          zh: string;
        },
        createdAt: row.createdAt as Date,
        updatedAt: row.updatedAt as Date,
        variants: variants.map((v) => ({
          id: v.id,
          sku: v.sku,
          name: v.name as { id: string; en: string; zh: string },
          sellPrice: String(v.sellPrice),
          costPrice: String(v.costPrice),
          attributes: (v.attributes ?? {}) as Record<string, string>,
          sortOrder: v.sortOrder,
          isActive: v.isActive,
          version: v.version,
        })),
      };

      return result;
    },
    (e) => {
      if (e instanceof AppError) return e;
      return AppError.internal('inventory.product.getFailed', e);
    },
  );
}
