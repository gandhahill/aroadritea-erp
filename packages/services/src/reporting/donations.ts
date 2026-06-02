/**
 * donations.ts — Donation Report (SD §25.11.5)
 *
 * Generates a donation summary report with:
 * - Daily breakdown: date | donation amount | transaction count | average
 * - Period totals
 * - Filter by date range + location
 *
 * Permission: accounting.view | reporting.view
 */

import { db } from '@erp/db';
import { payments, salesOrders } from '@erp/db/schema/pos';
import { AppError } from '@erp/shared/errors';
import { type Result, ok } from '@erp/shared/result';
import type { AuditContext } from '@erp/shared/types';
import { and, eq, gte, isNotNull, lt, lte, inArray } from 'drizzle-orm';
import { requirePermission } from '../iam';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface DonationReportParams {
  locationId?: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
}

export interface DonationDayRow {
  date: string; // YYYY-MM-DD
  donationTotal: string; // bigint string
  txCount: number;
  average: string; // bigint string (rounded)
}

export interface DonationReportResult {
  period: { start: string; end: string };
  locationId: string | null;
  rows: DonationDayRow[];
  totalDonation: string;
  totalTransactions: number;
  overallAverage: string;
}

// ─── Service ───────────────────────────────────────────────────────────────────

export async function getDonationReport(
  params: DonationReportParams,
  ctx: AuditContext,
): Promise<Result<DonationReportResult>> {
  const permCheck = await requirePermission(ctx.userId, 'reporting.view', {
    locationId: params.locationId ?? ctx.locationId,
  });
  if (!permCheck.ok) return permCheck;

  const startDateTime = new Date(`${params.startDate}T00:00:00+07:00`);
  const endDateUtc = new Date(`${params.endDate}T00:00:00Z`);
  endDateUtc.setUTCDate(endDateUtc.getUTCDate() + 1);
  const endDateTime = new Date(`${endDateUtc.toISOString().slice(0, 10)}T00:00:00+07:00`);

  // Query paid sales in range (optionally filtered by location)
  const conditions = [
    eq(salesOrders.tenantId, ctx.tenantId),
    eq(salesOrders.status, 'paid'),
    gte(salesOrders.placedAt, startDateTime),
    lt(salesOrders.placedAt, endDateTime),
  ];
  if (params.locationId) {
    conditions.push(eq(salesOrders.locationId, params.locationId));
  }

  const paidSales = await db
    .select({ id: salesOrders.id, placedAt: salesOrders.placedAt })
    .from(salesOrders)
    .where(and(...conditions));

  if (paidSales.length === 0) {
    return ok({
      period: { start: params.startDate, end: params.endDate },
      locationId: params.locationId ?? null,
      rows: [],
      totalDonation: '0',
      totalTransactions: 0,
      overallAverage: '0',
    });
  }

  const saleIds = paidSales.map((s) => s.id);
  const saleTimeMap = new Map(paidSales.map((s) => [s.id, s.placedAt]));

  // Query payments with donation
  const donationPayments = await db
    .select({
      id: payments.id,
      salesOrderId: payments.salesOrderId,
      donationAmount: payments.donationAmount,
      roundingOption: payments.roundingOption,
    })
    .from(payments)
    .where(and(
      isNotNull(payments.donationAmount),
      inArray(payments.salesOrderId, saleIds)
    ));

  // Filter to only payments from our sales set with non-zero donation
  const relevantDonations = donationPayments.filter(
    (p) => saleIds.includes(p.salesOrderId) && p.donationAmount && p.donationAmount > 0n,
  );

  // Group by date
  const dateMap = new Map<string, { total: bigint; count: number }>();

  for (const dp of relevantDonations) {
    const saleTime = saleTimeMap.get(dp.salesOrderId);
    if (!saleTime) continue;

    // Convert to WIB date
    const wibDate = new Date(saleTime.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const existing = dateMap.get(wibDate) ?? { total: 0n, count: 0 };
    existing.total += dp.donationAmount!;
    existing.count += 1;
    dateMap.set(wibDate, existing);
  }

  // Sort by date and build rows
  const sortedDates = [...dateMap.keys()].sort();
  const rows: DonationDayRow[] = sortedDates.map((date) => {
    const { total, count } = dateMap.get(date)!;
    const average = count > 0 ? total / BigInt(count) : 0n;
    return {
      date,
      donationTotal: total.toString(),
      txCount: count,
      average: average.toString(),
    };
  });

  // Period totals
  const totalDonation = relevantDonations.reduce((sum, d) => sum + (d.donationAmount ?? 0n), 0n);
  const totalTransactions = relevantDonations.length;
  const overallAverage = totalTransactions > 0 ? totalDonation / BigInt(totalTransactions) : 0n;

  return ok({
    period: { start: params.startDate, end: params.endDate },
    locationId: params.locationId ?? null,
    rows,
    totalDonation: totalDonation.toString(),
    totalTransactions,
    overallAverage: overallAverage.toString(),
  });
}
