/**
 * hourly-sales.ts — Hourly Sales Report (SD §25.6, §25.6.1–§25.6.2)
 *
 * Generates an hourly sales breakdown:
 * - Group by 'channel': per channel × per hour (10–22 WIB) matrix
 * - Group by 'day': per day × per hour (10–22 WIB) matrix
 * - Hour totals + grand totals
 *
 * Permission: accounting.view | reporting.view
 */

import { eq, and, gte, lte, inArray, sql } from 'drizzle-orm';
import { db } from '@erp/db';
import { salesOrders } from '@erp/db/schema/pos';
import { type Result, ok } from '@erp/shared/result';
import type { AuditContext } from '@erp/shared/types';
import { requirePermission } from '../iam';

// ─── Constants ─────────────────────────────────────────────────────────────────

const STORE_OPEN_HOUR = 10; // 10:00 WIB
const STORE_CLOSE_HOUR = 22; // 22:00 WIB (exclusive — last hour = 21)
const ALL_CHANNELS = ['dine_in', 'take_away', 'gofood', 'grabfood', 'shopeefood'] as const;
type Channel = typeof ALL_CHANNELS[number];

// ─── Types ─────────────────────────────────────────────────────────────────────────

export interface HourlySalesParams {
  locationId: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  groupBy?: 'channel' | 'day';
}

export interface HourlyCell {
  txCount: number;
  grossSales: string; // bigint string (in sen)
}

export interface ChannelHourRow {
  channel: string;
  hourBreakdown: Record<string, HourlyCell>; // "10".."21"
}

export interface DayHourRow {
  date: string; // YYYY-MM-DD (WIB)
  hourBreakdown: Record<string, HourlyCell>; // "10".."21"
}

export interface HourlySalesResult {
  period: { start: string; end: string };
  locationId: string;
  groupBy: 'channel' | 'day';
  channelRows?: ChannelHourRow[];   // present when groupBy='channel'
  dayRows?: DayHourRow[];           // present when groupBy='day'
  hourTotals: Record<string, HourlyCell>; // "10".."21" grand total per hour
  totalTxCount: number;
  totalGrossSales: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** Build an empty hour map for all store hours. */
function emptyHourMap(): Record<string, HourlyCell> {
  const map: Record<string, HourlyCell> = {};
  for (let h = STORE_OPEN_HOUR; h < STORE_CLOSE_HOUR; h++) {
    map[h.toString()] = { txCount: 0, grossSales: '0' };
  }
  return map;
}

/**
 * Get the hour (as string) from a Date in WIB.
 * Returns null if hour is outside store hours (10–22).
 */
function hourWib(d: Date): string | null {
  // WIB = UTC+7
  const utcHour = d.getUTCHours();
  const wibHour = utcHour + 7;
  if (wibHour < STORE_OPEN_HOUR || wibHour >= STORE_CLOSE_HOUR) return null;
  return wibHour.toString();
}

/**
 * Get the date string (YYYY-MM-DD) from a Date in WIB.
 */
function dateWib(d: Date): string {
  // Shift to WIB (UTC+7)
  const wibMs = d.getTime() + 7 * 60 * 60 * 1000;
  return new Date(wibMs).toISOString().slice(0, 10);
}

// ─── Service ────────────────────────────────────────────────────────────────────

export async function getHourlySales(
  params: HourlySalesParams,
  ctx: AuditContext,
): Promise<Result<HourlySalesResult>> {
  const permCheck = await requirePermission(ctx.userId, 'accounting.view', {
    locationId: params.locationId,
  });
  if (!permCheck.ok) return permCheck;

  const groupBy = params.groupBy ?? 'channel';

  // Date range in WIB
  const startDateTime = new Date(`${params.startDate}T00:00:00+07:00`);
  const endOfDay = new Date(params.endDate);
  endOfDay.setDate(endOfDay.getDate() + 1);
  const endDateTime = new Date(endOfDay.toISOString().split('T')[0] + 'T00:00:00+07:00');

  // Fetch paid sales in range
  const paidSales = await db
    .select({
      id: salesOrders.id,
      placedAt: salesOrders.placedAt,
      subtotal: salesOrders.subtotal,
      channel: salesOrders.channel,
    })
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

  // Build the raw matrix: channel → date → hour → { txCount, subtotal }
  type MatrixCell = { txCount: number; subtotal: bigint };
  const matrix: Map<string, Map<string, Map<string, MatrixCell>>> = new Map();

  for (const sale of paidSales) {
    const hourStr = hourWib(sale.placedAt);
    if (!hourStr) continue; // outside store hours

    const dateStr = dateWib(sale.placedAt);
    const channel = sale.channel ?? 'unknown';

    let channelMap = matrix.get(channel);
    if (!channelMap) {
      channelMap = new Map();
      matrix.set(channel, channelMap);
    }

    let dateMap = channelMap.get(dateStr);
    if (!dateMap) {
      dateMap = new Map();
      channelMap.set(dateStr, dateMap);
    }

    let cell = dateMap.get(hourStr);
    if (!cell) {
      cell = { txCount: 0, subtotal: 0n };
      dateMap.set(hourStr, cell);
    }
    cell.txCount += 1;
    cell.subtotal += sale.subtotal;
  }

  // ── Compute results ──────────────────────────────────────────────────────────

  const hourTotals: Record<string, HourlyCell> = emptyHourMap();
  let totalTxCount = 0;
  let totalGrossSales = 0n;

  if (groupBy === 'channel') {
    const channelRows: ChannelHourRow[] = [];

    for (const channel of ALL_CHANNELS) {
      const channelMap = matrix.get(channel);
      const hourBreakdown: Record<string, HourlyCell> = emptyHourMap();

      const channelDates = channelMap?.values() ?? [];
      for (const dateMap of channelDates) {
        for (const [hourStr, cell] of dateMap) {
          const existing = hourBreakdown[hourStr]!;
          hourBreakdown[hourStr] = {
            txCount: existing.txCount + cell.txCount,
            grossSales: (BigInt(existing.grossSales) + cell.subtotal).toString(),
          };

          // Accumulate hour totals
          const tot = hourTotals[hourStr]!;
          hourTotals[hourStr] = {
            txCount: tot.txCount + cell.txCount,
            grossSales: (BigInt(tot.grossSales) + cell.subtotal).toString(),
          };

          totalTxCount += cell.txCount;
          totalGrossSales += cell.subtotal;
        }
      }

      channelRows.push({ channel, hourBreakdown });
    }

    return ok({
      period: { start: params.startDate, end: params.endDate },
      locationId: params.locationId,
      groupBy,
      channelRows,
      hourTotals,
      totalTxCount,
      totalGrossSales: totalGrossSales.toString(),
    });
  } else {
    // groupBy === 'day'
    // Collect all dates across all channels
    const allDates = new Set<string>();
    for (const channelMap of matrix.values()) {
      for (const dateStr of channelMap.keys()) {
        allDates.add(dateStr);
      }
    }

    const sortedDates = [...allDates].sort();
    const dayRows: DayHourRow[] = [];

    for (const dateStr of sortedDates) {
      const hourBreakdown: Record<string, HourlyCell> = emptyHourMap();

      // Aggregate all channels for this date
      for (const channelMap of matrix.values()) {
        const dateMap = channelMap.get(dateStr);
        if (!dateMap) continue;

        for (const [hourStr, cell] of dateMap) {
          const existing = hourBreakdown[hourStr]!;
          hourBreakdown[hourStr] = {
            txCount: existing.txCount + cell.txCount,
            grossSales: (BigInt(existing.grossSales) + cell.subtotal).toString(),
          };

          const tot = hourTotals[hourStr]!;
          hourTotals[hourStr] = {
            txCount: tot.txCount + cell.txCount,
            grossSales: (BigInt(tot.grossSales) + cell.subtotal).toString(),
          };

          totalTxCount += cell.txCount;
          totalGrossSales += cell.subtotal;
        }
      }

      dayRows.push({ date: dateStr, hourBreakdown });
    }

    return ok({
      period: { start: params.startDate, end: params.endDate },
      locationId: params.locationId,
      groupBy,
      dayRows,
      hourTotals,
      totalTxCount,
      totalGrossSales: totalGrossSales.toString(),
    });
  }
}
