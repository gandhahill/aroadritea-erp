/**
 * Tool: get_today_sales_summary — T-0172 (Phase 3).
 *
 * Thin wrapper over `reporting.getDailySummary` so the assistant can
 * answer "Bagaimana penjualan hari ini di Malioboro?" using the same
 * numbers the reporting page shows.
 *
 * The underlying service already requires `accounting.view`; we also
 * gate this tool on `reporting.view` in the registry so non-reporting
 * roles don't even see the tool exists.
 */

import type { AuditContext } from '@erp/shared/types';
import { z } from 'zod';
import { getDailySummary } from '../../reporting/daily-summary';

export const GetTodaySalesSummaryInputSchema = z.object({
  /** YYYY-MM-DD (defaults to today in WIB). */
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  /** Outlet ID. Defaults to caller's session location. */
  location_id: z.string().min(1).max(64).optional(),
});

export type GetTodaySalesSummaryInput = z.infer<typeof GetTodaySalesSummaryInputSchema>;

export interface GetTodaySalesSummaryOutput {
  ok: boolean;
  error?: string;
  date?: string;
  location_id?: string;
  gross_sales?: string;
  discount_total?: string;
  net_sales?: string;
  tax_total?: string;
  commission_delivery?: string;
  net_revenue?: string;
  refund_total?: string;
  refund_count?: number;
  payment_breakdown?: Array<{ method: string; tx_count: number; total: string }>;
  top_products?: Array<{
    rank: number;
    product_id: string;
    product_name: string;
    qty: number;
    nominal: string;
    channel: string;
  }>;
  is_preliminary?: boolean;
}

function todayInJakarta(): string {
  return new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
}

export async function getTodaySalesSummaryTool(
  input: GetTodaySalesSummaryInput,
  ctx: AuditContext,
): Promise<GetTodaySalesSummaryOutput> {
  const locationId = input.location_id?.trim() || ctx.locationId?.trim() || '';
  if (!locationId) {
    return { ok: false, error: 'location_id is required' };
  }
  const date = input.date ?? todayInJakarta();

  const result = await getDailySummary({ locationId, startDate: date, endDate: date }, ctx);
  if (!result.ok) {
    return { ok: false, error: result.error.messageKey ?? 'summary.failed' };
  }
  const v = result.value;
  return {
    ok: true,
    date,
    location_id: locationId,
    gross_sales: v.grossSales,
    discount_total: v.discountTotal,
    net_sales: v.netSales,
    tax_total: v.taxTotal,
    commission_delivery: v.commissionDelivery,
    net_revenue: v.netRevenue,
    refund_total: v.refundTotal,
    refund_count: v.refundCount,
    payment_breakdown: v.paymentBreakdown.map((p) => ({
      method: p.method,
      tx_count: p.txCount,
      total: p.total,
    })),
    top_products: v.topProducts.map((p) => ({
      rank: p.rank,
      product_id: p.productId,
      product_name: p.productName,
      qty: p.qty,
      nominal: p.nominal,
      channel: p.channel,
    })),
    is_preliminary: v.isPreliminary,
  };
}
