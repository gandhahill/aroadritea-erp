/**
 * daily-summary.ts — Daily Sales Summary Report (SD §25.5.1)
 *
 * Generates a comprehensive daily sales summary with:
 * - Gross/net sales, PB1 tax, delivery commission deduction
 * - Payment method breakdown (method | tx_count | total)
 * - Shift summary with cash variance
 * - Top 10 products by nominal
 * - Refund tracking
 *
 * Permission: accounting.view | reporting.view
 */

import { db } from '@erp/db';
import { payments, salesOrderLines, salesOrders, shifts } from '@erp/db/schema/pos';
import { AppError } from '@erp/shared/errors';
import { type Result, ok } from '@erp/shared/result';
import type { AuditContext } from '@erp/shared/types';
import { and, eq, gte, inArray, lte, sql } from 'drizzle-orm';
import { requirePermission } from '../iam';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface DailySummaryParams {
  locationId: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  cashierId?: string;
}

export interface PaymentMethodRow {
  method: string;
  txCount: number;
  total: string; // bigint string
}

export interface ShiftSummaryRow {
  shiftId: string;
  openedAt: string;
  closedAt: string | null;
  openingCash: string;
  expectedCash: string | null;
  actualCash: string | null;
  variance: string | null;
  cashierName: string;
  txCount: number;
  txTotal: string;
}

export interface ProductSaleRow {
  rank: number;
  productId: string;
  productName: string;
  categoryId: string;
  qty: number;
  nominal: string; // bigint string
  channel: string;
}

export interface DailySummaryResult {
  period: { start: string; end: string };
  locationId: string;
  grossSales: string; // bigint string (before discounts)
  discountTotal: string;
  netSales: string;
  taxTotal: string; // PB1 collected (inclusive → back-out)
  commissionDelivery: string; // 20% × delivery channel gross
  netRevenue: string; // netSales − commissionDelivery
  refundTotal: string;
  refundCount: number;
  paymentBreakdown: PaymentMethodRow[];
  shiftSummary: ShiftSummaryRow[];
  topProducts: ProductSaleRow[];
  isPreliminary: boolean;
}

export type DailySummary = DailySummaryResult;

// ─── Constants ─────────────────────────────────────────────────────────────────

/**
 * Delivery commission: platform retains 20%, net = 80% × gross.
 * Commission = grossDelivery × 20/100.
 */
const DELIVERY_COMMISSION_RATE = 20n; // percent

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Format bigint as IDR string (divide by 100 to convert from sen/rupiah unit). */
function formatMoney(v: bigint): string {
  return v.toString();
}

// ─── Service ───────────────────────────────────────────────────────────────────

export async function getDailySummary(
  params: DailySummaryParams,
  ctx: AuditContext,
): Promise<Result<DailySummary>> {
  const permCheck = await requirePermission(ctx.userId, 'accounting.view', {
    locationId: params.locationId,
  });
  if (!permCheck.ok) return permCheck;

  // Use date range (WIB). Add 1 day to endDate so it covers the full day.
  const startDateTime = new Date(`${params.startDate}T00:00:00+07:00`);
  const endOfDay = new Date(params.endDate);
  endOfDay.setDate(endOfDay.getDate() + 1);
  const endDateTime = new Date(endOfDay.toISOString().split('T')[0] + 'T00:00:00+07:00');

  // ── Paid sales in range ──────────────────────────────────────────────────────
  const paidSaleRows = await db
    .select()
    .from(salesOrders)
    .where(
      and(
        eq(salesOrders.locationId, params.locationId),
        eq(salesOrders.tenantId, ctx.tenantId),
        eq(salesOrders.status, 'paid'),
        gte(salesOrders.placedAt, startDateTime),
        lte(salesOrders.placedAt, endDateTime),
      ),
    );

  const paidSaleIds = paidSaleRows.map((s) => s.id);

  // ── Refunded sales in range ──────────────────────────────────────────────────
  const refundSaleRows = await db
    .select()
    .from(salesOrders)
    .where(
      and(
        eq(salesOrders.locationId, params.locationId),
        eq(salesOrders.tenantId, ctx.tenantId),
        eq(salesOrders.status, 'refunded'),
        gte(salesOrders.placedAt, startDateTime),
        lte(salesOrders.placedAt, endDateTime),
      ),
    );

  // ── Aggregate totals ──────────────────────────────────────────────────────────
  const grossSales = paidSaleRows.reduce((s, r) => s + r.subtotal, 0n);
  const discountTotal = paidSaleRows.reduce((s, r) => s + r.discountTotal, 0n);
  const taxTotal = paidSaleRows.reduce((s, r) => s + r.taxTotal, 0n);
  const grandTotal = paidSaleRows.reduce((s, r) => s + r.grandTotal, 0n);
  const netSales = grossSales - discountTotal;

  const deliveryGross = paidSaleRows
    .filter((s) => ['gofood', 'grabfood', 'shopeefood'].includes(s.channel))
    .reduce((s, r) => s + r.subtotal, 0n);
  const commissionDelivery = (deliveryGross * DELIVERY_COMMISSION_RATE) / 100n;
  const netRevenue = netSales - commissionDelivery;

  const refundTotal = refundSaleRows.reduce((s, r) => s + r.grandTotal, 0n);
  const refundCount = refundSaleRows.length;

  // ── Payment breakdown ─────────────────────────────────────────────────────────
  let paymentBreakdown: PaymentMethodRow[] = [];
  if (paidSaleIds.length > 0) {
    const payRows = await db
      .select({
        method: payments.method,
        txCount: sql<number>`count(*)`,
        total: sql<bigint>`sum(${payments.amount})`,
      })
      .from(payments)
      .where(inArray(payments.salesOrderId, paidSaleIds))
      .groupBy(payments.method);

    paymentBreakdown = payRows.map((r) => ({
      method: r.method,
      txCount: Number(r.txCount),
      total: r.total.toString(),
    }));
  }

  // ── Shift summary ─────────────────────────────────────────────────────────────
  const shiftRows = await db
    .select()
    .from(shifts)
    .where(and(eq(shifts.locationId, params.locationId)))
    .orderBy(shifts.openedAt);

  const shiftsInRange = shiftRows.filter(
    (s) => s.openedAt >= startDateTime && s.openedAt <= endDateTime,
  );

  const shiftSummary: ShiftSummaryRow[] = shiftsInRange.map((shift) => {
    const shiftSales = paidSaleRows.filter((s) => s.shiftId === shift.id);
    const txTotal = shiftSales.reduce((s, r) => s + r.grandTotal, 0n);
    return {
      shiftId: shift.id,
      openedAt: shift.openedAt.toISOString(),
      closedAt: shift.closedAt?.toISOString() ?? null,
      openingCash: shift.openingCash.toString(),
      expectedCash: shift.expectedCash?.toString() ?? null,
      actualCash: shift.actualCash?.toString() ?? null,
      variance: shift.variance?.toString() ?? null,
      cashierName: shift.openedBy,
      txCount: shiftSales.length,
      txTotal: txTotal.toString(),
    };
  });

  // ── Top 10 products by nominal ─────────────────────────────────────────────────
  let topProducts: ProductSaleRow[] = [];
  if (paidSaleIds.length > 0) {
    const topRows = await db
      .select({
        productId: salesOrderLines.productId,
        qty: sql<number>`sum((${salesOrderLines.qty})::numeric)`,
        nominal: sql<bigint>`sum(${salesOrderLines.lineSubtotal})`,
        channel: salesOrders.channel,
      })
      .from(salesOrderLines)
      .innerJoin(salesOrders, eq(salesOrderLines.salesOrderId, salesOrders.id))
      .where(inArray(salesOrderLines.salesOrderId, paidSaleIds))
      .groupBy(salesOrderLines.productId, salesOrders.channel)
      .orderBy(sql`sum(${salesOrderLines.lineSubtotal}) DESC`)
      .limit(10);

    topProducts = topRows.map((row, idx) => ({
      rank: idx + 1,
      productId: row.productId,
      productName: row.productId, // resolved by caller
      categoryId: '',
      qty: Number(row.qty),
      nominal: row.nominal.toString(),
      channel: row.channel,
    }));
  }

  return ok({
    period: { start: params.startDate, end: params.endDate },
    locationId: params.locationId,
    grossSales: grossSales.toString(),
    discountTotal: discountTotal.toString(),
    netSales: netSales.toString(),
    taxTotal: taxTotal.toString(),
    commissionDelivery: commissionDelivery.toString(),
    netRevenue: netRevenue.toString(),
    refundTotal: refundTotal.toString(),
    refundCount,
    paymentBreakdown,
    shiftSummary,
    topProducts,
    isPreliminary: false,
  });
}
