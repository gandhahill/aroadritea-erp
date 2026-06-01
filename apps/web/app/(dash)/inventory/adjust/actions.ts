'use server';

import { getSession } from '@/lib/auth';
import { getActiveLocationOptions } from '@/lib/location-options';
import { and, asc, db, desc, eq, inArray, sql } from '@erp/db';
import {
  products,
  stockAdjustmentLines,
  stockAdjustments,
  stockLevels,
} from '@erp/db/schema/inventory';
import { locations } from '@erp/db/schema/auth';
import { users } from '@erp/db/schema/auth';
import {
  approveAdjustment,
  createAdjustmentDraft,
  rejectAdjustment,
  submitAdjustment,
} from '@erp/services/inventory';
import { can } from '@erp/services/iam';
import type { AuditContext } from '@erp/shared/types';
import { getLocale } from 'next-intl/server';
import { revalidatePath } from 'next/cache';

export interface QuickAdjustOption {
  id: string;
  label: string;
}

export interface QuickAdjustProductOption {
  id: string;
  sku: string;
  label: string;
  uom: string;
}

export interface QuickAdjustData {
  locations: QuickAdjustOption[];
  products: QuickAdjustProductOption[];
}

export interface QuickAdjustState {
  ok?: boolean;
  error?: string;
}

async function getAuditContext(): Promise<AuditContext | null> {
  const session = await getSession();
  if (!session?.user) return null;
  const user = session.user as Record<string, unknown>;
  return {
    tenantId: String(user.tenantId ?? 'default'),
    userId: String(user.id ?? ''),
    locationId: String(user.locationId ?? ''),
  };
}

function text(formData: FormData, key: string): string {
  return String(formData.get(key) ?? '').trim();
}

function pickName(name: unknown, locale: string, fallback: string): string {
  if (!name || typeof name !== 'object') return fallback;
  const value = name as Record<string, string | undefined>;
  return value[locale] ?? value.id ?? value.en ?? value.zh ?? fallback;
}

function toQty(value: string): string | null {
  const qty = Number(value.replace(',', '.'));
  if (!Number.isFinite(qty) || qty < 0) return null;
  return qty
    .toFixed(3)
    .replace(/\\.0+$/, '')
    .replace(/(\\.\\d*?)0+$/, '$1');
}

function errorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return String(error);
}

export async function fetchQuickAdjustData(): Promise<QuickAdjustData> {
  const ctx = await getAuditContext();
  if (!ctx) return { locations: [], products: [] };

  const rawLocale = await getLocale().catch(() => 'id');
  const locale = rawLocale === 'en' || rawLocale === 'zh' ? rawLocale : 'id';

  const [locations, productRows] = await Promise.all([
    getActiveLocationOptions({ tenantId: ctx.tenantId, locale, type: 'store' }),
    db
      .select({
        id: products.id,
        sku: products.sku,
        name: products.name,
        uom: products.uom,
      })
      .from(products)
      .where(and(eq(products.tenantId, ctx.tenantId), eq(products.isActive, true)))
      .orderBy(asc(products.sku)),
  ]);

  return {
    locations: locations.map((location) => ({
      id: location.id,
      label: `${location.code} - ${location.label}`,
    })),
    products: productRows.map((product) => ({
      id: product.id,
      sku: product.sku,
      label: `${product.sku} - ${pickName(product.name, locale, product.sku)}`,
      uom: product.uom,
    })),
  };
}

export async function createQuickAdjustmentAction(
  _prev: QuickAdjustState | null,
  formData: FormData,
): Promise<QuickAdjustState> {
  const ctx = await getAuditContext();
  if (!ctx) return { error: 'Unauthenticated' };

  const locationId = text(formData, 'locationId');
  const productId = text(formData, 'productId');
  const qtyAfter = toQty(text(formData, 'qtyAfter'));
  if (!locationId || !productId || qtyAfter === null) {
    return { error: 'Invalid adjustment data.' };
  }

  const [product] = await db
    .select({
      id: products.id,
      uom: products.uom,
      defaultCostPrice: products.defaultCostPrice,
    })
    .from(products)
    .where(and(eq(products.tenantId, ctx.tenantId), eq(products.id, productId)))
    .limit(1);
  if (!product) return { error: 'Product not found.' };

  const [currentStock] = await db
    .select({
      qtyOnHand: sql<string>`COALESCE(sum(${stockLevels.qtyOnHand}), 0)::text`,
      avgUnitCost: sql<bigint | null>`max(${stockLevels.avgUnitCost})`,
    })
    .from(stockLevels)
    .where(
      and(
        eq(stockLevels.tenantId, ctx.tenantId),
        eq(stockLevels.locationId, locationId),
        eq(stockLevels.productId, productId),
      ),
    );

  const qtyBefore = toQty(currentStock?.qtyOnHand ?? '0') ?? '0';
  const delta = toQty(String(Number(qtyAfter) - Number(qtyBefore))) ?? '0';

  const unitCost =
    currentStock?.avgUnitCost ??
    (product.defaultCostPrice && product.defaultCostPrice > 0n
      ? product.defaultCostPrice
      : null);

  const created = await createAdjustmentDraft(
    {
      locationId,
      adjustmentDate: new Date().toISOString().slice(0, 10),
      reason: text(formData, 'reason') || 'count_correction',
      notes: text(formData, 'notes') || undefined,
      lines: [
        {
          productId,
          qtyBefore,
          qtyAfter,
          qtyDelta: delta,
          uom: product.uom,
          unitCost: unitCost ? unitCost.toString() : undefined,
          batchNo: text(formData, 'batchNo') || undefined,
          expiryDate: text(formData, 'expiryDate') || undefined,
        },
      ],
    },
    { ...ctx, locationId },
  );
  if (!created.ok) return { error: errorMessage(created.error) };

  const submitted = await submitAdjustment(created.value.id, { ...ctx, locationId });
  if (!submitted.ok) return { error: errorMessage(submitted.error) };

  revalidatePath('/inventory/stock');
  revalidatePath('/inventory/adjust');
  return { ok: true };
}

// ─── List adjustments ────────────────────────────────────────────────────────

export interface AdjustmentRow {
  id: string;
  number: string;
  adjustmentDate: string;
  reason: string;
  notes: string | null;
  status: string;
  version: number;
  locationName: string;
  createdByName: string;
  lineCount: number;
  createdAt: string;
}

export async function fetchAdjustments(): Promise<AdjustmentRow[]> {
  const ctx = await getAuditContext();
  if (!ctx) return [];

  const allowed = await can(ctx.userId, 'inventory.adjust');
  if (!allowed) return [];

  const rows = await db
    .select({
      id: stockAdjustments.id,
      number: stockAdjustments.number,
      adjustmentDate: stockAdjustments.adjustmentDate,
      reason: stockAdjustments.reason,
      notes: stockAdjustments.notes,
      status: stockAdjustments.status,
      version: stockAdjustments.version,
      locationName: locations.name,
      createdBy: stockAdjustments.createdBy,
      createdAt: stockAdjustments.createdAt,
    })
    .from(stockAdjustments)
    .leftJoin(locations, eq(stockAdjustments.locationId, locations.id))
    .where(eq(stockAdjustments.tenantId, ctx.tenantId))
    .orderBy(desc(stockAdjustments.createdAt))
    .limit(100);

  const userIds = [...new Set(rows.map((r) => r.createdBy).filter((id): id is string => Boolean(id)))];
  const userRows =
    userIds.length > 0
      ? await db
          .select({ id: users.id, displayName: users.displayName })
          .from(users)
          .where(inArray(users.id, userIds))
      : [];
  const userMap = new Map(userRows.map((u) => [u.id, u.displayName ?? '']));

  const adjIds = rows.map((r) => r.id);
  const lineCounts =
    adjIds.length > 0
      ? await db
          .select({
            adjustmentId: stockAdjustmentLines.adjustmentId,
            count: sql<number>`cast(count(*) as int)`,
          })
          .from(stockAdjustmentLines)
          .where(inArray(stockAdjustmentLines.adjustmentId, adjIds))
          .groupBy(stockAdjustmentLines.adjustmentId)
      : [];
  const countMap = new Map(lineCounts.map((c) => [c.adjustmentId, c.count]));

  const rawLocale = await getLocale().catch(() => 'id');
  const locale = rawLocale === 'en' || rawLocale === 'zh' ? rawLocale : 'id';

  return rows.map((r) => ({
    id: r.id,
    number: r.number,
    adjustmentDate: r.adjustmentDate,
    reason: r.reason,
    notes: r.notes,
    status: r.status,
    version: r.version,
    locationName: pickName(r.locationName, locale, '-'),
    createdByName: userMap.get(r.createdBy ?? '') ?? '-',
    lineCount: countMap.get(r.id) ?? 0,
    createdAt: r.createdAt?.toISOString().slice(0, 10) ?? '',
  }));
}

// ─── Approve / Reject ─────────────────────────────────────────────────────────

export async function approveAdjustmentAction(
  adjustmentId: string,
  version: number,
): Promise<{ ok?: boolean; error?: string }> {
  const ctx = await getAuditContext();
  if (!ctx) return { error: 'Unauthenticated' };

  const [adj] = await db
    .select({ locationId: stockAdjustments.locationId })
    .from(stockAdjustments)
    .where(and(eq(stockAdjustments.id, adjustmentId), eq(stockAdjustments.tenantId, ctx.tenantId)))
    .limit(1);
  if (!adj) return { error: 'Not found' };

  const result = await approveAdjustment(
    { adjustmentId, version },
    { ...ctx, locationId: adj.locationId },
  );
  if (!result.ok) return { error: errorMessage(result.error) };

  revalidatePath('/inventory/adjust');
  revalidatePath('/inventory/stock');
  return { ok: true };
}

export async function rejectAdjustmentAction(
  adjustmentId: string,
  version: number,
  reason: string,
): Promise<{ ok?: boolean; error?: string }> {
  const ctx = await getAuditContext();
  if (!ctx) return { error: 'Unauthenticated' };

  const [adj] = await db
    .select({ locationId: stockAdjustments.locationId })
    .from(stockAdjustments)
    .where(and(eq(stockAdjustments.id, adjustmentId), eq(stockAdjustments.tenantId, ctx.tenantId)))
    .limit(1);
  if (!adj) return { error: 'Not found' };

  const result = await rejectAdjustment(
    { adjustmentId, version, reason },
    { ...ctx, locationId: adj.locationId },
  );
  if (!result.ok) return { error: errorMessage(result.error) };

  revalidatePath('/inventory/adjust');
  return { ok: true };
}
