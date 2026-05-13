/**
 * POS Server Actions — SD §21.4
 *
 * All POS operations callable from client components.
 * Each action validates auth, parses input, and delegates to the service layer.
 */

'use server';

import { getSession } from '@/lib/auth';
import { and, db, eq, or } from '@erp/db';
import { ilike } from '@erp/db';
import { productCategories, productVariants, products } from '@erp/db/schema/inventory';
import { salesOrders, shifts } from '@erp/db/schema/pos';
import { closeShift, createSale, openShift, refundSale, voidSale } from '@erp/services/pos';
import { getOpenShift } from '@erp/services/pos';
import type {
  CloseShiftInput,
  CreateSaleInput,
  OpenShiftInput,
  RefundSaleInput,
  VoidSaleInput,
} from '@erp/services/pos/schemas';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProductListItem {
  id: string;
  sku: string;
  name: string;
  categoryId: string;
  categoryName: string;
  defaultSellPrice: string;
  imageUrl: string | null;
  kind: string;
  variants: VariantItem[];
}

export interface VariantItem {
  id: string;
  name: string;
  sku: string;
  sellPrice: string;
  attributes: Record<string, string>;
}

export interface ShiftStatusItem {
  id: string;
  locationId: string;
  status: string;
  openingCash: string;
  openedBy: string;
  openedAt: string;
  expectedCash: string | null;
  actualCash: string | null;
  variance: string | null;
  closedBy: string | null;
  closedAt: string | null;
}

export interface SaleListItem {
  id: string;
  number: string;
  status: string;
  channel: string;
  grandTotal: string;
  placedAt: string;
  cashierName: string;
  lines: { productName: string; qty: string; lineTotal: string }[];
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

async function getAuditContext() {
  const session = await getSession();
  if (!session) throw new Error('Unauthenticated');
  const user = session.user as Record<string, unknown>;
  return {
    userId: String(user.id ?? ''),
    tenantId: String(user.tenantId ?? 'default'),
    locationId: String(user.locationId ?? ''),
    ipAddress: undefined as string | undefined,
    userAgent: undefined as string | undefined,
  };
}

// ─── Shift Actions ─────────────────────────────────────────────────────────────

export async function fetchOpenShift(locationId: string): Promise<ShiftStatusItem | null> {
  const ctx = await getAuditContext();
  const result = await getOpenShift(locationId, ctx);
  if (!result.ok) return null;
  return result.value;
}

export async function openShiftAction(input: OpenShiftInput) {
  const ctx = await getAuditContext();
  return await openShift(input, ctx);
}

export async function closeShiftAction(input: CloseShiftInput) {
  const ctx = await getAuditContext();
  return await closeShift(input, ctx);
}

// ─── Product Actions ───────────────────────────────────────────────────────────

export async function fetchProducts(params: {
  categoryId?: string;
  search?: string;
}): Promise<ProductListItem[]> {
  const ctx = await getAuditContext();
  const conditions = [eq(products.tenantId, ctx.tenantId)];

  if (params.categoryId) {
    conditions.push(eq(products.categoryId, params.categoryId));
  }
  if (params.search) {
    const searchPattern = `%${params.search}%`;
    const searchCond = or(ilike(products.sku, searchPattern), ilike(products.name, searchPattern));
    if (searchCond) conditions.push(searchCond);
  }

  const productRows = await db
    .select({
      id: products.id,
      sku: products.sku,
      name: products.name,
      categoryId: products.categoryId,
      defaultSellPrice: products.defaultSellPrice,
      imageUrl: products.imageUrl,
      kind: products.kind,
    })
    .from(products)
    .where(and(...conditions))
    .orderBy(products.name)
    .then((rows) =>
      rows.map((r) => ({
        id: r.id,
        sku: r.sku,
        name: r.name,
        categoryId: r.categoryId,
        defaultSellPrice: r.defaultSellPrice,
        imageUrl: r.imageUrl,
        kind: r.kind,
      })),
    );

  // Fetch variants for all products in one query
  const productIds = productRows.map((p) => p.id);
  const variantRows = productIds.length
    ? await db
        .select({
          id: productVariants.id,
          productId: productVariants.productId,
          name: productVariants.name,
          sku: productVariants.sku,
          sellPrice: productVariants.sellPrice,
          attributes: productVariants.attributes,
        })
        .from(productVariants)
        .where(and(eq(productVariants.tenantId, ctx.tenantId)))
        .orderBy(productVariants.sortOrder)
        .then((rows) =>
          rows.map((r) => ({
            id: r.id,
            productId: r.productId,
            name: r.name,
            sku: r.sku,
            sellPrice: r.sellPrice,
            attributes: r.attributes,
          })),
        )
    : [];

  const categoryIds = [...new Set(productRows.map((p) => p.categoryId))];
  const categoryRows = categoryIds.length
    ? await db
        .select({ id: productCategories.id, name: productCategories.name })
        .from(productCategories)
        .where(and(eq(productCategories.tenantId, ctx.tenantId)))
        .then((rows) => rows.map((r) => ({ id: r.id, name: r.name })))
    : [];

  type NameRecord = { id?: string; en?: string; zh?: string };
  const categoryMap = new Map<string, NameRecord>(
    categoryRows.map((c) => [c.id, c.name as NameRecord]),
  );
  const variantsByProduct = new Map<string, VariantItem[]>();
  for (const v of variantRows) {
    if (!variantsByProduct.has(v.productId)) variantsByProduct.set(v.productId, []);
    const vName = v.name as NameRecord;
    variantsByProduct.get(v.productId)!.push({
      id: v.id,
      name: vName?.id ?? vName?.en ?? 'Default',
      sku: v.sku,
      sellPrice: v.sellPrice.toString(),
      attributes: v.attributes ?? {},
    });
  }

  return productRows.map((p) => {
    const pName = p.name as NameRecord;
    const catName = categoryMap.get(p.categoryId);
    const cName = catName as NameRecord;
    return {
      id: p.id,
      sku: p.sku,
      name: pName?.id ?? p.sku,
      categoryId: p.categoryId,
      categoryName: cName?.id ?? cName?.en ?? p.categoryId,
      defaultSellPrice: p.defaultSellPrice.toString(),
      imageUrl: p.imageUrl,
      kind: p.kind,
      variants: variantsByProduct.get(p.id) ?? [],
    };
  });
}

export async function fetchCategories(): Promise<{ id: string; name: string }[]> {
  const ctx = await getAuditContext();
  const rows = await db
    .select({ id: productCategories.id, name: productCategories.name })
    .from(productCategories)
    .where(eq(productCategories.tenantId, ctx.tenantId))
    .orderBy(productCategories.sortOrder);
  type NameRecord = { id?: string; en?: string; zh?: string };
  return rows.map((r) => {
    const n = r.name as NameRecord;
    return { id: r.id, name: n?.id ?? n?.en ?? r.id };
  });
}

// ─── Sale Actions ───────────────────────────────────────────────────────────────

export async function createSaleAction(input: CreateSaleInput) {
  const ctx = await getAuditContext();
  return await createSale(input, ctx);
}

export async function voidSaleAction(input: VoidSaleInput) {
  const ctx = await getAuditContext();
  return await voidSale(input, ctx);
}

export async function refundSaleAction(input: RefundSaleInput) {
  const ctx = await getAuditContext();
  return await refundSale(input, ctx);
}

// ─── Recent Sales (for refund access) ───────────────────────────────────────────

export async function fetchRecentSales(params: {
  locationId: string;
  status?: string;
  limit?: number;
}): Promise<SaleListItem[]> {
  const ctx = await getAuditContext();
  const limit = params.limit ?? 20;

  const conditions = [
    eq(salesOrders.tenantId, ctx.tenantId),
    eq(salesOrders.locationId, params.locationId),
  ];
  if (params.status) {
    conditions.push(eq(salesOrders.status, params.status));
  }

  const rows = await db
    .select()
    .from(salesOrders)
    .where(and(...conditions))
    .orderBy(salesOrders.placedAt)
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    number: r.number,
    status: r.status,
    channel: r.channel,
    grandTotal: r.grandTotal.toString(),
    placedAt: r.placedAt.toISOString(),
    cashierName: r.cashierId,
    lines: [],
  }));
}
