/**
 * POS Server Actions — SD §21.4
 *
 * All POS operations callable from client components.
 * Each action validates auth, parses input, and delegates to the service layer.
 */

'use server';

import { getSession } from '@/lib/auth';
import { getActiveLocationOptions, resolveDefaultLocationId } from '@/lib/location-options';
import { and, db, eq, ilike, inArray, isNull, or, sql } from '@erp/db';
import {
  productCategories,
  productModifierOptions,
  productVariants,
  products,
  stockLevels,
} from '@erp/db/schema/inventory';
import { posSettings, salesOrders, shifts } from '@erp/db/schema/pos';
import { promotions } from '@erp/db/schema/promotion';
import { taxRates } from '@erp/db/schema/accounting';
import { requirePermission } from '@erp/services/iam';
import { type MemberLookupResult, findMemberByPhone } from '@erp/services/member';
import { closeShift, createSale, openShift, refundSale, voidSale } from '@erp/services/pos';
import { getOpenShift } from '@erp/services/pos';
import type {
  CloseShiftInput,
  CreateSaleInput,
  OpenShiftInput,
  RefundSaleInput,
  VoidSaleInput,
} from '@erp/services/pos/schemas';
import { getLocale } from 'next-intl/server';

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
  /**
   * Stock available at the current shift's outlet. `null` means the product
   * is untracked (no `stock_levels` row exists for this product+location);
   * the POS treats untracked products as always available. `"0"` means
   * out of stock and the POS disables the add button.
   */
  qtyAvailable: string | null;
}

export interface VariantItem {
  id: string;
  name: string;
  sku: string;
  sellPrice: string;
  attributes: Record<string, string>;
  /** Same null/"0" convention as ProductListItem.qtyAvailable, scoped to this variant. */
  qtyAvailable: string | null;
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
  /** Optimistic-lock version. Required when closing the shift. */
  version: number;
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

export type MemberLookupActionResult =
  | { ok: true; member: MemberLookupResult | null }
  | { ok: false; error: string };

export interface PosChannelOption {
  id: string;
  label: string;
  netBps: number;
  commissionBps: number;
  enabled: boolean;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

async function getAuditContext() {
  const session = await getSession();
  if (!session) throw new Error('Unauthenticated');
  const user = session.user as Record<string, unknown>;
  const tenantId = String(user.tenantId ?? 'default');
  const sessionLocationId = String(user.locationId ?? '');
  const locationOptions = await getActiveLocationOptions({ tenantId, locale: 'id', type: 'store' });
  return {
    userId: String(user.id ?? ''),
    tenantId,
    locationId: resolveDefaultLocationId(locationOptions, undefined, sessionLocationId),
    ipAddress: undefined as string | undefined,
    userAgent: undefined as string | undefined,
  };
}

type AppLocale = 'id' | 'en' | 'zh';
type NameRecord = { id?: string; en?: string; zh?: string };

function normalizeLocale(locale: string): AppLocale {
  return locale === 'en' || locale === 'zh' ? locale : 'id';
}

function localizeName(value: unknown, locale: AppLocale, fallback: string): string {
  const name = value as NameRecord | null | undefined;
  return name?.[locale] ?? name?.id ?? name?.en ?? name?.zh ?? fallback;
}

function humanizeChannel(id: string) {
  return id
    .split(/[_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function normalizeDeliveryChannels(raw: unknown): PosChannelOption[] {
  const source = Array.isArray(raw) ? raw : [];
  const rows = source
    .map((item): PosChannelOption | null => {
      if (typeof item === 'string') {
        const id = item.trim().toLowerCase();
        if (!/^[a-z0-9_-]{2,32}$/.test(id)) return null;
        return {
          id,
          label: humanizeChannel(id),
          netBps: 8000,
          commissionBps: 2000,
          enabled: true,
        };
      }

      if (!item || typeof item !== 'object') return null;
      const value = item as Record<string, unknown>;
      const id = String(value.id ?? '')
        .trim()
        .toLowerCase();
      if (!/^[a-z0-9_-]{2,32}$/.test(id)) return null;
      const netBps = Number(value.netBps ?? 8000);
      const commissionBps = Number(value.commissionBps ?? 10000 - netBps);
      return {
        id,
        label: String(value.label ?? humanizeChannel(id)).trim() || humanizeChannel(id),
        netBps: Number.isFinite(netBps) ? netBps : 8000,
        commissionBps: Number.isFinite(commissionBps) ? commissionBps : 2000,
        enabled: value.enabled !== false,
      };
    })
    .filter((item): item is PosChannelOption => Boolean(item));

  const byId = new Map<string, PosChannelOption>();
  for (const row of rows) byId.set(row.id, row);
  return [...byId.values()].filter((row) => row.enabled);
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
  const locale = normalizeLocale(await getLocale());
  const conditions = [
    eq(products.tenantId, ctx.tenantId),
    eq(products.isActive, true),
    eq(products.isSellable, true),
  ];

  if (params.categoryId) {
    conditions.push(eq(products.categoryId, params.categoryId));
  }
  if (params.search) {
    const searchPattern = `%${params.search}%`;
    const searchCond = or(
      ilike(products.sku, searchPattern),
      sql`${products.name}->>'id' ILIKE ${searchPattern}`,
      sql`${products.name}->>'en' ILIKE ${searchPattern}`,
      sql`${products.name}->>'zh' ILIKE ${searchPattern}`,
    );
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
    .orderBy(sql`${products.name}->>'id'`)
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
        .where(
          and(
            eq(productVariants.tenantId, ctx.tenantId),
            eq(productVariants.isActive, true),
            inArray(productVariants.productId, productIds),
          ),
        )
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

  const categoryMap = new Map<string, NameRecord>(
    categoryRows.map((c) => [c.id, c.name as NameRecord]),
  );

  // Stock per outlet (current shift location). A row in stock_levels with
  // qtyAvailable > 0 = available; qtyAvailable = 0 = out of stock; no row at
  // all = untracked (treat as available). We keep two maps: one keyed by
  // productId (no variant) and one keyed by `${productId}::${variantId}`
  // so the UI can disable per variant. Aggregated across batches.
  const productLevelStock = new Map<string, number>();
  const variantLevelStock = new Map<string, number>();
  if (productIds.length > 0 && ctx.locationId) {
    const levelRows = await db
      .select({
        productId: stockLevels.productId,
        variantId: stockLevels.variantId,
        qtyAvailable: sql<string>`sum(${stockLevels.qtyAvailable})::text`,
      })
      .from(stockLevels)
      .where(
        and(
          eq(stockLevels.tenantId, ctx.tenantId),
          eq(stockLevels.locationId, ctx.locationId),
          inArray(stockLevels.productId, productIds),
        ),
      )
      .groupBy(stockLevels.productId, stockLevels.variantId);

    for (const row of levelRows) {
      const qty = Number(row.qtyAvailable ?? '0');
      if (row.variantId) {
        variantLevelStock.set(`${row.productId}::${row.variantId}`, qty);
      } else {
        productLevelStock.set(row.productId, qty);
      }
    }
  }

  const variantsByProduct = new Map<string, VariantItem[]>();
  for (const v of variantRows) {
    const variantItems = variantsByProduct.get(v.productId) ?? [];
    const qty = variantLevelStock.get(`${v.productId}::${v.id}`);
    variantItems.push({
      id: v.id,
      name: localizeName(v.name, locale, 'Default'),
      sku: v.sku,
      sellPrice: v.sellPrice.toString(),
      attributes: v.attributes ?? {},
      qtyAvailable: qty !== undefined ? String(qty) : null,
    });
    variantsByProduct.set(v.productId, variantItems);
  }

  return productRows.map((p) => {
    const catName = categoryMap.get(p.categoryId);
    const productQty = productLevelStock.get(p.id);
    return {
      id: p.id,
      sku: p.sku,
      name: localizeName(p.name, locale, p.sku),
      categoryId: p.categoryId,
      categoryName: localizeName(catName, locale, p.categoryId),
      defaultSellPrice: p.defaultSellPrice.toString(),
      imageUrl: p.imageUrl,
      kind: p.kind,
      variants: variantsByProduct.get(p.id) ?? [],
      qtyAvailable: productQty !== undefined ? String(productQty) : null,
    };
  });
}

export async function fetchCategories(): Promise<{ id: string; name: string }[]> {
  const ctx = await getAuditContext();
  const locale = normalizeLocale(await getLocale());
  const rows = await db
    .select({ id: productCategories.id, name: productCategories.name })
    .from(productCategories)
    .where(and(eq(productCategories.tenantId, ctx.tenantId), eq(productCategories.isActive, true)))
    .orderBy(productCategories.sortOrder);
  return rows.map((r) => {
    return { id: r.id, name: localizeName(r.name, locale, r.id) };
  });
}

export async function fetchPosChannelOptions(locationId?: string): Promise<PosChannelOption[]> {
  const ctx = await getAuditContext();
  const targetLocationId = locationId || ctx.locationId;

  const [setting] = await db
    .select({ deliveryChannelsJson: posSettings.deliveryChannelsJson })
    .from(posSettings)
    .where(
      and(eq(posSettings.tenantId, ctx.tenantId), eq(posSettings.locationId, targetLocationId)),
    )
    .limit(1);

  return normalizeDeliveryChannels(setting?.deliveryChannelsJson);
}

// ─── Sale Actions ───────────────────────────────────────────────────────────────

export async function lookupMemberByPhoneAction(phone: string): Promise<MemberLookupActionResult> {
  const ctx = await getAuditContext();
  const perm = await requirePermission(ctx.userId, 'pos.transact', {
    locationId: ctx.locationId,
  });
  if (!perm.ok) return { ok: false, error: perm.error.messageKey };

  const result = await findMemberByPhone({ phone }, ctx.tenantId);
  if (!result.ok) return { ok: false, error: result.error.messageKey };

  return { ok: true, member: result.value };
}

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

export async function fetchMasterDataRaw() {
  const ctx = await getAuditContext();

  const productRows = await db
    .select()
    .from(products)
    .where(and(eq(products.tenantId, ctx.tenantId), eq(products.isActive, true), eq(products.isSellable, true)));
  const variantRows = await db
    .select()
    .from(productVariants)
    .where(and(eq(productVariants.tenantId, ctx.tenantId), eq(productVariants.isActive, true)));
  const modifierRows = await db
    .select()
    .from(productModifierOptions)
    .where(and(eq(productModifierOptions.tenantId, ctx.tenantId), eq(productModifierOptions.isActive, true)));
  const promotionRows = await db
    .select()
    .from(promotions)
    .where(
      and(
        eq(promotions.tenantId, ctx.tenantId),
        eq(promotions.status, 'active'),
        isNull(promotions.deletedAt),
      ),
    );
  const taxRateRows = await db
    .select()
    .from(taxRates)
    .where(eq(taxRates.isActive, true));

  // Helper to extract localized name as a single display string
  function localizeNameRaw(name: unknown): string {
    if (!name) return '';
    if (typeof name === 'string') return name;
    if (typeof name === 'object') {
      const n = name as Record<string, string>;
      return n.id || n.en || n.zh || JSON.stringify(name);
    }
    return String(name);
  }

  return {
    products: productRows.map((p) => ({
      id: p.id,
      sku: p.sku,
      name: localizeNameRaw(p.name),
      categoryId: p.categoryId,
      defaultSellPrice: p.defaultSellPrice.toString(),
      imageUrl: p.imageUrl,
      kind: p.kind,
      updatedAt: p.updatedAt.toISOString(),
    })),
    variants: variantRows.map((v) => ({
      id: v.id,
      productId: v.productId,
      name: localizeNameRaw(v.name),
      sku: v.sku,
      sellPrice: v.sellPrice.toString(),
      attributes: v.attributes ?? {},
      sortOrder: v.sortOrder,
    })),
    modifiers: modifierRows.map((m) => ({
      id: m.id,
      name: localizeNameRaw(m.name),
      price: m.extraPrice.toString(),
      category: m.groupId,
      isActive: m.isActive,
    })),
    promotions: promotionRows.map((p) => ({
      id: p.id,
      name: localizeNameRaw(p.name),
      type: p.kind,
      rules: {
        conditions: p.conditionsJson ?? {},
        benefits: p.benefitsJson ?? {},
        locationScope: p.locationScopeJson ?? [],
        channelScope: p.channelScopeJson ?? [],
      },
      startDate: p.startsAt.toISOString(),
      endDate: p.endsAt?.toISOString() ?? '9999-12-31T23:59:59.999Z',
      isActive: p.status === 'active',
    })),
    taxRates: taxRateRows.map((t) => ({
      code: t.code,
      name: JSON.stringify(t.name),
      rate: String(t.rateBps / 10000),
      calculation: t.calculation as 'inclusive' | 'exclusive',
      appliesTo: [],
    })),
  };
}
