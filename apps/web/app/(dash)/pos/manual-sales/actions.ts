'use server';

import { getSession } from '@/lib/auth';
import {
  createManualSalesClosing,
  listManualSalesClosings,
  listManualSalesLocations,
} from '@erp/services/pos';
import type { AuditContext } from '@erp/shared/types';
import { getLocale } from 'next-intl/server';
import { revalidatePath } from 'next/cache';

export interface ManualSalesPageData {
  locations: Array<{ id: string; label: string; code: string }>;
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
    return { locations: [], items: [], total: 0, page: 1, pageSize, error: 'Unauthenticated' };
  const locale = await getLocale();
  const currentPage = Math.max(1, Number.isFinite(page) ? page : 1);
  const activeLocationId = locationId || ctx.locationId || undefined;

  const [locationRows, closings] = await Promise.all([
    listManualSalesLocations(ctx),
    listManualSalesClosings(
      { locationId: activeLocationId, limit: pageSize, offset: (currentPage - 1) * pageSize },
      ctx,
    ),
  ]);

  if (!closings.ok) {
    return {
      locations: [],
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
  if (!ctx) return { error: 'Unauthenticated' };

  const result = await createManualSalesClosing(
    {
      locationId: text(formData, 'locationId') || ctx.locationId,
      salesDate: text(formData, 'salesDate'),
      channel: text(formData, 'channel') || 'walk_in',
      paymentMethod: text(formData, 'paymentMethod') || 'cash',
      grossSales: money(formData, 'grossSales'),
      discountTotal: money(formData, 'discountTotal'),
      transactionCount: intValue(formData, 'transactionCount'),
      sourceReference: text(formData, 'sourceReference') || undefined,
      notes: text(formData, 'notes') || undefined,
      idempotencyKey: crypto.randomUUID(),
    },
    ctx,
  );

  if (!result.ok) return { error: errorMessage(result.error) };
  revalidatePath('/pos/manual-sales');
  revalidatePath('/reporting/daily-summary');
  revalidatePath('/reporting/omzet-harian');
  return { ok: true };
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
