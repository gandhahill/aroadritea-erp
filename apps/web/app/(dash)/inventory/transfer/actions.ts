'use server';

import { getSession } from '@/lib/auth';
import { and, desc, eq, inArray, sql, db } from '@erp/db';
import { locations } from '@erp/db/schema/auth';
import {
  products,
  stockTransferLines,
  stockTransfers,
} from '@erp/db/schema/inventory';
import {
  cancelTransfer,
  createTransferDraft,
  receiveTransfer,
  shipTransfer,
} from '@erp/services/inventory';
import type { AuditContext } from '@erp/shared/types';
import { getLocale, getTranslations } from 'next-intl/server';
import { revalidatePath } from 'next/cache';

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

function pickName(name: unknown, locale: string, fallback: string = ''): string {
  if (!name || typeof name !== 'object') return fallback;
  const value = name as Record<string, string | undefined>;
  return value[locale] ?? value.id ?? value.en ?? value.zh ?? fallback;
}

// --- Data Fetching ---

export async function fetchTransferList(
  locationId?: string,
  status?: string,
  page = 1,
  pageSize = 25,
) {
  const ctx = await getAuditContext();
  if (!ctx) throw new Error('Unauthenticated');

  const offset = (Math.max(1, page) - 1) * pageSize;

  const conditions = [eq(stockTransfers.tenantId, ctx.tenantId)];
  if (locationId) {
    conditions.push(
      sql`${stockTransfers.fromLocationId} = ${locationId} OR ${stockTransfers.toLocationId} = ${locationId}`,
    );
  }
  if (status) {
    conditions.push(eq(stockTransfers.status, status));
  }

  const queryConditions = and(...conditions);

  const [totalCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(stockTransfers)
    .where(queryConditions);

  const rows = await db
    .select({
      id: stockTransfers.id,
      number: stockTransfers.number,
      transferDate: stockTransfers.transferDate,
      status: stockTransfers.status,
      fromLocationId: stockTransfers.fromLocationId,
      toLocationId: stockTransfers.toLocationId,
    })
    .from(stockTransfers)
    .where(queryConditions)
    .orderBy(desc(stockTransfers.transferDate), desc(stockTransfers.number))
    .limit(pageSize)
    .offset(offset);

  // Fetch location names
  const locIds = [
    ...new Set(rows.map((r) => r.fromLocationId).concat(rows.map((r) => r.toLocationId))),
  ];
  let locMap = new Map<string, string>();
  if (locIds.length > 0) {
    const locs = await db
      .select({ id: locations.id, name: locations.name, code: locations.code })
      .from(locations)
      .where(and(eq(locations.tenantId, ctx.tenantId), inArray(locations.id, locIds)));
    const locale = await getLocale();
    locMap = new Map(
      locs.map((l) => [l.id, pickName(l.name, locale, l.code)]),
    );
  }

  return {
    total: Number(totalCount?.count || 0),
    items: rows.map((r) => ({
      ...r,
      fromLocationName: locMap.get(r.fromLocationId) || 'Unknown',
      toLocationName: locMap.get(r.toLocationId) || 'Unknown',
    })),
  };
}

export async function fetchTransferDetail(transferId: string) {
  const ctx = await getAuditContext();
  if (!ctx) throw new Error('Unauthenticated');

  const trf = await db
    .select()
    .from(stockTransfers)
    .where(and(eq(stockTransfers.tenantId, ctx.tenantId), eq(stockTransfers.id, transferId)))
    .then((r) => r[0]);

  if (!trf) return null;

  const lines = await db
    .select()
    .from(stockTransferLines)
    .where(eq(stockTransferLines.transferId, transferId))
    .orderBy(stockTransferLines.lineNo);

  const productIds = [...new Set(lines.map((l) => l.productId))];
  let productMap = new Map<string, string>();
  if (productIds.length > 0) {
    const prods = await db
      .select({ id: products.id, name: products.name, sku: products.sku })
      .from(products)
      .where(and(eq(products.tenantId, ctx.tenantId), inArray(products.id, productIds)));
    const locale = await getLocale();
    productMap = new Map(
      prods.map((p) => [p.id, pickName(p.name, locale, p.sku)]),
    );
  }

  // Fetch locations
  const locs = await db
    .select({ id: locations.id, name: locations.name, code: locations.code })
    .from(locations)
    .where(eq(locations.tenantId, ctx.tenantId));
  const locale = await getLocale();
  const locMap = new Map(
    locs.map((l) => [l.id, (l.name as Record<string, string>)[locale] || (l.name as Record<string, string>).id]),
  );

  return {
    ...trf,
    fromLocationName: locMap.get(trf.fromLocationId) || 'Unknown',
    toLocationName: locMap.get(trf.toLocationId) || 'Unknown',
    lines: lines.map((l) => ({
      ...l,
      productName: productMap.get(l.productId) || 'Unknown',
    })),
  };
}

export async function fetchLocationOptions() {
  const ctx = await getAuditContext();
  if (!ctx) return [];
  const locs = await db
    .select({ id: locations.id, name: locations.name, code: locations.code })
    .from(locations)
    .where(eq(locations.tenantId, ctx.tenantId))
    .orderBy(locations.name);
  const locale = await getLocale();
  return locs.map((l) => ({
    id: l.id,
    code: l.code,
    name: pickName(l.name, locale, l.code),
  }));
}

export async function fetchProductOptions() {
  const ctx = await getAuditContext();
  if (!ctx) return [];
  const prods = await db
    .select({ id: products.id, name: products.name, uom: products.uom, sku: products.sku })
    .from(products)
    .where(eq(products.tenantId, ctx.tenantId))
    .orderBy(products.name);
  const locale = await getLocale();
  return prods.map((p) => ({
    id: p.id,
    uom: p.uom,
    name: pickName(p.name, locale, p.sku),
  }));
}

// --- Mutations ---

export async function createTransferAction(_prevState: any, formData: FormData) {
  const ctx = await getAuditContext();
  if (!ctx) return { error: 'Unauthenticated' };
  const t = await getTranslations('inventory.transfer');

  const fromLocationId = formData.get('fromLocationId') as string;
  const toLocationId = formData.get('toLocationId') as string;
  const transferDate = formData.get('transferDate') as string;
  const notes = formData.get('notes') as string;
  const linesJson = formData.get('linesJson') as string;

  let lines: any[] = [];
  try {
    lines = JSON.parse(linesJson);
  } catch (e) {
    return { error: 'Invalid lines format' };
  }

  const result = await createTransferDraft(
    { fromLocationId, toLocationId, transferDate, notes, lines },
    ctx,
  );
  if (!result.ok) {
    return { error: result.error.message };
  }

  revalidatePath('/inventory/transfer');
  return { ok: true, message: t('createSuccess'), transferId: result.value.id };
}

export async function shipTransferAction(transferId: string, version: number) {
  const ctx = await getAuditContext();
  if (!ctx) return { error: 'Unauthenticated' };
  const t = await getTranslations('inventory.transfer');

  const result = await shipTransfer({ transferId, version }, ctx);
  if (!result.ok) return { error: result.error.message };

  revalidatePath('/inventory/transfer');
  revalidatePath(`/inventory/transfer/${transferId}`);
  return { ok: true, message: t('shipSuccess') };
}

export async function receiveTransferAction(transferId: string, version: number, lines: Array<{ lineId: string; qtyReceived: string }>) {
  const ctx = await getAuditContext();
  if (!ctx) return { error: 'Unauthenticated' };
  const t = await getTranslations('inventory.transfer');

  const result = await receiveTransfer({ transferId, version, lines }, ctx);
  if (!result.ok) return { error: result.error.message };

  revalidatePath('/inventory/transfer');
  revalidatePath(`/inventory/transfer/${transferId}`);
  return { ok: true, message: t('receiveSuccess') };
}

export async function cancelTransferAction(transferId: string) {
  const ctx = await getAuditContext();
  if (!ctx) return { error: 'Unauthenticated' };
  const t = await getTranslations('inventory.transfer');

  const result = await cancelTransfer(transferId, ctx);
  if (!result.ok) return { error: result.error.message };

  revalidatePath('/inventory/transfer');
  revalidatePath(`/inventory/transfer/${transferId}`);
  return { ok: true, message: t('cancelSuccess') };
}
