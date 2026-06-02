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
import { and, eq, gte, inArray, lt, lte, sql } from 'drizzle-orm';
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
  totalOrderCount: number;
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

  // Use half-open WIB day range: [startDate 00:00 WIB, endDate+1 00:00 WIB).
  // Parse endDate explicitly as UTC midnight to avoid local-tz day shift,
  // then format the next day as a WIB midnight boundary.
  const startDateTime = new Date(`${params.startDate}T00:00:00+07:00`);
  const endDateUtc = new Date(`${params.endDate}T00:00:00Z`);
  endDateUtc.setUTCDate(endDateUtc.getUTCDate() + 1);
  const endDateTime = new Date(
    `${endDateUtc.toISOString().slice(0, 10)}T00:00:00+07:00`,
  );

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
        lt(salesOrders.placedAt, endDateTime),
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
        lt(salesOrders.placedAt, endDateTime),
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
      // Commission is on grand total (after discounts)
      return sum + (sale.grandTotal * BigInt(channel.commissionBps)) / 10000n;
    }, 0n) +
    manualSaleRows.reduce((sum, sale) => {
      const channel = deliveryChannels.get(sale.channel);
      if (!channel?.enabled) return sum;
      // For manual sales, net = grossSales − discountTotal
      return sum + ((sale.grossSales - sale.discountTotal) * BigInt(channel.commissionBps)) / 10000n;
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

  // ─── Shift summary ─────────────────────────────────────────────────────────────
  const shiftRows = await db
    .select()
    .from(shifts)
    .where(and(
      eq(shifts.locationId, params.locationId),
      eq(shifts.tenantId, ctx.tenantId),
      gte(shifts.openedAt, startDateTime),
      lt(shifts.openedAt, endDateTime)
    ))
    .orderBy(shifts.openedAt);

  const shiftsInRange = shiftRows;

  const shiftSummary: ShiftSummaryRow[] = shiftsInRange.map((shift) => {
    const shiftSales = paidSaleRows.filter((s) => s.shiftId === shift.id);
    const manualSales = manualSaleRows.filter((s) => s.shiftId === shift.id);
    
    // PB1 is inclusive: grossSales − discountTotal already contains the tax.
    // Adding taxTotal again would double-count it.
    const txTotal =
      shiftSales.reduce((s, r) => s + r.grandTotal, 0n) +
      manualSales.reduce((s, r) => s + (r.grossSales - r.discountTotal), 0n);
      
    return {
      shiftId: shift.id,
      openedAt: shift.openedAt.toISOString(),
      closedAt: shift.closedAt?.toISOString() ?? null,
      openingCash: shift.openingCash.toString(),
      expectedCash: shift.expectedCash?.toString() ?? null,
      actualCash: shift.actualCash?.toString() ?? null,
      variance: shift.variance?.toString() ?? null,
      cashierName: shift.openedBy,
      txCount: shiftSales.length + manualSales.reduce((acc, m) => acc + (m.transactionCount ?? 1), 0),
      txTotal: txTotal.toString(),
    };
  });

  // ── Top 10 products by nominal ─────────────────────────────────────────────────
  let topProducts: ProductSaleRow[] = [];
  const combinedProducts = new Map<string, ProductSaleRow>();

  // Process manual sale products
  for (const manual of manualSaleRows) {
    if (!manual.lineItemsJson || !Array.isArray(manual.lineItemsJson)) continue;
    const items = manual.lineItemsJson as Array<{ productId?: string, name?: string, qty?: number, total?: string }>;
    for (const item of items) {
      if (!item.productId) continue;
      const key = `${item.productId}_${manual.channel}`;
      if (!combinedProducts.has(key)) {
        combinedProducts.set(key, {
          rank: 0,
          productId: item.productId,
          productName: item.name || item.productId,
          categoryId: '',
          qty: Number(item.qty || 0),
          nominal: (item.total ? BigInt(item.total) : 0n).toString(),
          channel: manual.channel,
        });
      } else {
        const existing = combinedProducts.get(key)!;
        existing.qty += Number(item.qty || 0);
        existing.nominal = (BigInt(existing.nominal) + (item.total ? BigInt(item.total) : 0n)).toString();
      }
    }
  }

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
      .groupBy(salesOrderLines.productId, salesOrders.channel, products.name, products.categoryId);

    for (const row of topRows) {
      const nameField = row.productName as Record<string, string> | null;
      const resolvedName = nameField?.id ?? nameField?.en ?? nameField?.zh ?? row.productId;
      const key = `${row.productId}_${row.channel}`;
      
      if (combinedProducts.has(key)) {
        const existing = combinedProducts.get(key)!;
        existing.qty += Number(row.qty);
        existing.nominal = (BigInt(existing.nominal) + row.nominal).toString();
        if (!existing.categoryId) existing.categoryId = row.categoryId ?? '';
        if (existing.productName === row.productId) existing.productName = resolvedName;
      } else {
        combinedProducts.set(key, {
          rank: 0,
          productId: row.productId,
          productName: resolvedName,
          categoryId: row.categoryId ?? '',
          qty: Number(row.qty),
          nominal: row.nominal.toString(),
          channel: row.channel,
        });
      }
    }
  }
  
  topProducts = Array.from(combinedProducts.values())
    .sort((a, b) => (BigInt(b.nominal) < BigInt(a.nominal) ? -1 : 1))
    .slice(0, 10)
    .map((p, idx) => ({ ...p, rank: idx + 1 }));

  const totalOrderCount =
    paidSaleRows.length +
    manualSaleRows.reduce((sum, m) => sum + (m.transactionCount ?? 1), 0);

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
    totalOrderCount,
    paymentBreakdown,
    shiftSummary,
    topProducts,
    isPreliminary: false,
  });
}
