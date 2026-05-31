'use server';

import { getSession } from '@/lib/auth';
import { and, db, eq, sql } from '@erp/db';
import { productVariants, products } from '@erp/db/schema/inventory';
import {
  createManualSalesClosing,
  listManualSalesClosings,
  listManualSalesLocations,
  getManualSalesClosingDetail,
  deleteManualSalesClosing,
} from '@erp/services/pos';
import type { AuditContext } from '@erp/shared/types';
import { getLocale, getTranslations } from 'next-intl/server';
import { revalidatePath } from 'next/cache';

export async function fetchManualSaleDetailAction(id: string) {
  const ctx = await getAuditContext();
  if (!ctx) return { ok: false, error: 'Unauthenticated' };
  const res = await getManualSalesClosingDetail(id, ctx);
  if (!res.ok) return { ok: false, error: errorMessage(res.error) };
  return { ok: true, value: res.value };
}

export async function deleteManualSaleAction(id: string) {
  const ctx = await getAuditContext();
  if (!ctx) return { ok: false, error: 'Unauthenticated' };
  const res = await deleteManualSalesClosing(id, ctx);
  if (!res.ok) {
    console.error('Failed to delete manual sale:', res.error);
    return { ok: false, error: errorMessage(res.error) };
  }
  revalidatePath('/pos/manual-sales');
  return { ok: true };
}

export interface ManualSalesPageData {
  locations: Array<{ id: string; label: string; code: string }>;
  products: Array<{ id: string; name: string; sellPrice: string; variantId: string | null }>;
  ingredients: Array<{ id: string; name: string; uom: string }>;
  items: Array<{
    id: string;
    number: string;
    salesDate: string;
    locationId: string;
    channel: string;
    paymentMethod: string;
    transactionCount: number;
    grossSales: string;
    taxTotal: string;
    netRevenue: string;
    journalEntryId: string | null;
    status: string;
    createdByName?: string | null;
    updatedByName?: string | null;
  }>;
  total: number;
  page: number;
  pageSize: number;
  error?: string;
}

export interface ManualSalesActionState {
  ok?: boolean;
  error?: string;
}

async function getAuditContext(): Promise<AuditContext | null> {
  const session = await getSession();
  if (!session?.user) return null;
  const user = session.user as Record<string, unknown>;
  return {
    userId: String(user.id ?? ''),
    tenantId: String(user.tenantId ?? 'default'),
    locationId: String(user.locationId ?? ''),
  };
}

function pickLocalized(value: unknown, locale: string): string {
  const record = value as Record<string, string> | null | undefined;
  if (!record) return '';
  const key = locale === 'zh' ? 'zh' : locale === 'en' ? 'en' : 'id';
  return record[key] ?? record.id ?? record.en ?? record.zh ?? '';
}

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim();
}

function money(formData: FormData, key: string) {
  const value = text(formData, key).replace(/[^\d]/g, '');
  return value.length > 0 ? value : '0';
}

function intValue(formData: FormData, key: string) {
  const value = Number.parseInt(text(formData, key), 10);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function errorMessage(error: unknown) {
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return String(error);
}

export async function fetchManualSalesPageData(
  locationId?: string,
  page = 1,
  requestedPageSize = 25,
): Promise<ManualSalesPageData> {
  const ctx = await getAuditContext();
  const pageSize = Math.max(
    1,
    Math.min(100, Number.isFinite(requestedPageSize) ? requestedPageSize : 25),
  );
  if (!ctx)
    return {
      locations: [],
      products: [],
      ingredients: [],
      items: [],
      total: 0,
      page: 1,
      pageSize,
      error: 'Unauthenticated',
    };
  const locale = await getLocale();
  const currentPage = Math.max(1, Number.isFinite(page) ? page : 1);
  const activeLocationId = locationId || ctx.locationId || undefined;

  const [locationRows, closings, productList, ingredientsList] = await Promise.all([
    listManualSalesLocations(ctx),
    listManualSalesClosings(
      { locationId: activeLocationId, limit: pageSize, offset: (currentPage - 1) * pageSize },
      ctx,
    ),
    db
      .execute<{
        id: string;
        name: string;
        sellPrice: string;
        variantId: string | null;
      }>(
        sql`
      SELECT 
        p.id, 
        COALESCE(p.name->>'id', p.name->>'en', 'Product') || COALESCE(' - ' || COALESCE(v.name->>'id', v.name->>'en'), '') as name,
        COALESCE(v.sell_price, p.default_sell_price) as "sellPrice",
        v.id as "variantId"
      FROM products p
      LEFT JOIN product_variants v ON v.product_id = p.id AND v.is_active = true
      WHERE p.tenant_id = ${ctx.tenantId} AND p.is_active = true AND p.kind IN ('food', 'drink', 'retail', 'finished_good')
      ORDER BY p.sku ASC
      `,
      )
      .then((res) => res),
    db
      .execute<{
        id: string;
        name: string;
        uom: string;
      }>(
        sql`
      SELECT 
        p.id, 
        COALESCE(p.name->>'id', p.name->>'en', 'Ingredient') as name,
        p.uom
      FROM products p
      WHERE p.tenant_id = ${ctx.tenantId} AND p.is_active = true AND p.kind IN ('raw_material', 'consumable')
      ORDER BY p.sku ASC
      `,
      )
      .then((res) => res),
  ]);

  if (!closings.ok) {
    return {
      locations: [],
      products: [],
      ingredients: [],
      items: [],
      total: 0,
      page: currentPage,
      pageSize,
      error: errorMessage(closings.error),
    };
  }

  return {
    locations: locationRows.map((row) => ({
      id: row.id,
      code: row.code,
      label: `${row.code} - ${pickLocalized(row.name, locale)}`,
    })),
    products: productList.map((p) => ({
      id: p.id,
      name: p.name,
      sellPrice: p.sellPrice,
      variantId: p.variantId,
    })),
    ingredients: ingredientsList.map((i) => ({
      id: i.id,
      name: i.name,
      uom: i.uom,
    })),
    items: closings.value.items,
    total: closings.value.total,
    page: currentPage,
    pageSize,
  };
}

export async function createManualSalesAction(
  _prev: ManualSalesActionState | null,
  formData: FormData,
): Promise<ManualSalesActionState> {
  const ctx = await getAuditContext();
  const t = await getTranslations('pos.manualSales');
  if (!ctx) return { error: t('errorUnauthenticated', { defaultValue: 'Unauthenticated' }) };

  let lineItems = [];
  try {
    const rawItems = text(formData, 'lineItemsJson');
    if (rawItems) {
      lineItems = JSON.parse(rawItems);
    }
  } catch (e) {
    return { error: t('errorInvalidLineItems', { defaultValue: 'Invalid line items data' }) };
  }

  let payments = [];
  try {
    const rawPayments = text(formData, 'paymentsJson');
    if (rawPayments) {
      payments = JSON.parse(rawPayments);
    }
  } catch (e) {
    return { error: t('errorInvalidPayments', { defaultValue: 'Invalid payments data' }) };
  }

  if (payments.length === 0) {
    return { error: t('errorMinPayment', { defaultValue: 'Minimal harus ada 1 metode pembayaran' }) };
  }

  const baseDeductBom = formData.get('deductBom') === 'true';
  let remainingDiscount = BigInt(money(formData, 'discountTotal'));

  for (let i = 0; i < payments.length; i++) {
    const payment = payments[i];
    const isFirst = i === 0;
    
    const grossSales = BigInt(payment.grossSales || '0');
    
    // Distribute discount: take up to grossSales amount from remainingDiscount
    const appliedDiscount = remainingDiscount > grossSales ? grossSales : remainingDiscount;
    remainingDiscount -= appliedDiscount;

    const result = await createManualSalesClosing(
      {
        locationId: text(formData, 'locationId') || ctx.locationId,
        salesDate: text(formData, 'salesDate'),
        channel: payment.channel || 'walk_in',
        paymentMethod: payment.method || 'cash',
        grossSales: grossSales.toString(),
        discountTotal: appliedDiscount.toString(),
        transactionCount: payment.transactionCount || 0,
        sourceReference: text(formData, 'sourceReference') || undefined,
        notes: text(formData, 'notes') || undefined,
        idempotencyKey: crypto.randomUUID(),
        // Attach line items and deduct BOM only on the first payment row
        lineItems: isFirst ? lineItems : [],
        deductBom: isFirst ? baseDeductBom : false,
        originalCreatedBy: text(formData, 'originalCreatedBy') || undefined,
      },
      ctx,
    );

    if (!result.ok) {
      return { error: t('errorPaymentFailed', { method: payment.method, error: errorMessage(result.error), defaultValue: `Gagal pada pembayaran ${payment.method}: ` + errorMessage(result.error) }) };
    }
  }

  if (remainingDiscount > 0n) {
    return { error: t('errorDiscountExceedsGross', { defaultValue: 'Diskon melebihi total seluruh penjualan kotor.' }) };
  }

  revalidatePath('/pos/manual-sales');
  revalidatePath('/reporting/daily-summary');
  revalidatePath('/reporting/omzet-harian');
  return { ok: true };
}

export async function deleteManualSalesAction(id: string) {
  const ctx = await getAuditContext();
  const t = await getTranslations('pos.manualSales');
  if (!ctx) return { ok: false, error: t('errorUnauthenticated', { defaultValue: 'Unauthenticated' }) };
  const res = await deleteManualSalesClosing(id, ctx);
  if (!res.ok) return { ok: false, error: errorMessage(res.error) };
  revalidatePath('/pos/manual-sales');
  revalidatePath('/reporting/daily-summary');
  revalidatePath('/reporting/omzet-harian');
  return { ok: true };
}

export async function updateManualSalesAction(
  id: string,
  prev: ManualSalesActionState | null,
  formData: FormData,
): Promise<ManualSalesActionState> {
  const ctx = await getAuditContext();
  const t = await getTranslations('pos.manualSales');
  if (!ctx) return { error: t('errorUnauthenticated', { defaultValue: 'Unauthenticated' }) };

  // Validate early before deleting to avoid data loss on trivial errors
  try {
    const rawItems = text(formData, 'lineItemsJson');
    if (rawItems) JSON.parse(rawItems);
  } catch (e) {
    return { error: t('errorInvalidLineItems', { defaultValue: 'Invalid line items data' }) };
  }

  let payments = [];
  try {
    const rawPayments = text(formData, 'paymentsJson');
    if (rawPayments) {
      payments = JSON.parse(rawPayments);
    }
  } catch (e) {
    return { error: t('errorInvalidPayments', { defaultValue: 'Invalid payments data' }) };
  }

  if (payments.length === 0) {
    return { error: t('errorMinPayment', { defaultValue: 'Minimal harus ada 1 metode pembayaran' }) };
  }

  const remainingDiscount = BigInt(money(formData, 'discountTotal'));
  const totalGross = payments.reduce((acc: bigint, p: any) => acc + BigInt(p.grossSales || '0'), 0n);
  if (remainingDiscount > totalGross) {
    return { error: t('errorDiscountExceedsGross', { defaultValue: 'Diskon melebihi total seluruh penjualan kotor.' }) };
  }

  // Get original creator to preserve it on the new record
  const original = await getManualSalesClosingDetail(id, ctx);
  if (!original.ok) {
    return { error: errorMessage(original.error) };
  }
  if (original.value.closing.createdBy) {
    formData.append('originalCreatedBy', original.value.closing.createdBy);
  }

  // For update, we simply delete and then create new ones.
  const delRes = await deleteManualSalesClosing(id, ctx);
  if (!delRes.ok) {
    return { error: errorMessage(delRes.error) };
  }

  return createManualSalesAction(null, formData);
}

export async function serverExportManualSales(locationId?: string) {
  const result = await fetchManualSalesPageData(locationId, 1, 1000);
  if (result.error) {
    return { ok: false, error: result.error };
  }

  const headers = [
    'Number',
    'Date',
    'Location ID',
    'Channel',
    'Payment Method',
    'Tx Count',
    'Gross Sales',
    'Tax Total',
    'Net Revenue',
    'Journal Entry ID',
  ];
  const rows = result.items.map((i) => [
    i.number,
    i.salesDate,
    i.locationId,
    i.channel,
    i.paymentMethod,
    i.transactionCount.toString(),
    i.grossSales,
    i.taxTotal,
    i.netRevenue,
    i.journalEntryId || '-',
  ]);

  return {
    ok: true,
    value: {
      sheets: [
        {
          name: 'Manual Sales',
          rows: [headers, ...rows],
        },
      ],
    },
  };
}
