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
import { products } from '@erp/db/schema/inventory';
import {
  manualSalesClosings,
  payments,
  posSettings,
  salesOrderLines,
  salesOrders,
  shifts,
} from '@erp/db/schema/pos';
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface DeliveryChannelConfig {
  id: string;
  commissionBps: number;
  enabled: boolean;
}

function normalizeDeliveryChannels(raw: unknown): Map<string, DeliveryChannelConfig> {
  const source = Array.isArray(raw) ? raw : [];
  const result = new Map<string, DeliveryChannelConfig>();

  for (const item of source) {
    const record =
      typeof item === 'string'
        ? { id: item, commissionBps: 2000, enabled: true }
        : item && typeof item === 'object'
          ? (item as Record<string, unknown>)
          : null;
    if (!record) continue;

    const id = String(record.id ?? '')
      .trim()
      .toLowerCase();
    if (!/^[a-z0-9_-]{2,32}$/.test(id)) continue;

    const rawCommissionBps = Number(record.commissionBps ?? 2000);
    result.set(id, {
      id,
      commissionBps: Number.isFinite(rawCommissionBps)
        ? Math.min(10000, Math.max(0, Math.trunc(rawCommissionBps)))
        : 2000,
      enabled: record.enabled !== false,
    });
  }

  return result;
}

// ─── Service ───────────────────────────────────────────────────────────────────

export async function getDailySummary(
  params: DailySummaryParams,
  ctx: AuditContext,
): Promise<Result<DailySummary>> {
  const permCheck = await requirePermission(ctx.userId, 'reporting.view', {
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

  const manualSaleRows = await db
    .select()
    .from(manualSalesClosings)
    .where(
      and(
        eq(manualSalesClosings.locationId, params.locationId),
        eq(manualSalesClosings.tenantId, ctx.tenantId),
        eq(manualSalesClosings.status, 'posted'),
        gte(manualSalesClosings.salesDate, params.startDate),
        lte(manualSalesClosings.salesDate, params.endDate),
      ),
    );

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
  const grossSales =
    paidSaleRows.reduce((s, r) => s + r.subtotal, 0n) +
    manualSaleRows.reduce((s, r) => s + r.grossSales, 0n);
  const discountTotal =
    paidSaleRows.reduce((s, r) => s + r.discountTotal, 0n) +
    manualSaleRows.reduce((s, r) => s + r.discountTotal, 0n);
  const taxTotal =
    paidSaleRows.reduce((s, r) => s + r.taxTotal, 0n) +
    manualSaleRows.reduce((s, r) => s + r.taxTotal, 0n);
  const netSales = grossSales - discountTotal;

  const [setting] = await db
    .select({ deliveryChannelsJson: posSettings.deliveryChannelsJson })
    .from(posSettings)
    .where(
      and(eq(posSettings.tenantId, ctx.tenantId), eq(posSettings.locationId, params.locationId)),
    )
    .limit(1);

  const deliveryChannels = normalizeDeliveryChannels(setting?.deliveryChannelsJson);
  const commissionDelivery =
    paidSaleRows.reduce((sum, sale) => {
      const channel = deliveryChannels.get(sale.channel);
      if (!channel?.enabled) return sum;
      return sum + (sale.subtotal * BigInt(channel.commissionBps)) / 10000n;
    }, 0n) +
    manualSaleRows.reduce((sum, sale) => {
      const channel = deliveryChannels.get(sale.channel);
      if (!channel?.enabled) return sum;
      return sum + (sale.grossSales * BigInt(channel.commissionBps)) / 10000n;
    }, 0n);
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
  for (const manual of manualSaleRows) {
    const existing = paymentBreakdown.find((row) => row.method === manual.paymentMethod);
    if (existing) {
      existing.txCount += manual.transactionCount || 1;
      existing.total = (
        BigInt(existing.total) +
        manual.grossSales -
        manual.discountTotal
      ).toString();
    } else {
      paymentBreakdown.push({
        method: manual.paymentMethod,
        txCount: manual.transactionCount || 1,
        total: (manual.grossSales - manual.discountTotal).toString(),
      });
    }
  }

  // ── Shift summary ─────────────────────────────────────────────────────────────
  const shiftRows = await db
    .select()
    .from(shifts)
    .where(and(
      eq(shifts.locationId, params.locationId),
      eq(shifts.tenantId, ctx.tenantId)
    ))
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
        productName: products.name,
        categoryId: products.categoryId,
      })
      .from(salesOrderLines)
      .innerJoin(salesOrders, eq(salesOrderLines.salesOrderId, salesOrders.id))
      .leftJoin(
        products,
        and(eq(salesOrderLines.productId, products.id), eq(products.tenantId, ctx.tenantId)),
      )
      .where(inArray(salesOrderLines.salesOrderId, paidSaleIds))
      .groupBy(salesOrderLines.productId, salesOrders.channel, products.name, products.categoryId)
      .orderBy(sql`sum(${salesOrderLines.lineSubtotal}) DESC`)
      .limit(10);

    topProducts = topRows.map((row, idx) => {
      const nameField = row.productName as Record<string, string> | null;
      const resolvedName = nameField?.id ?? nameField?.en ?? nameField?.zh ?? row.productId;
      return {
        rank: idx + 1,
        productId: row.productId,
        productName: resolvedName,
        categoryId: row.categoryId ?? '',
        qty: Number(row.qty),
        nominal: row.nominal.toString(),
        channel: row.channel,
      };
    });
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
