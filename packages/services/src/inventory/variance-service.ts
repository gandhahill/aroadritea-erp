/**
 * inventory.variance — Inventory Variance Report (SD §25.9.4)
 *
 * Aggregates variance data from all approved opname sessions for a
 * location and date range. Returns per-product and per-session summaries.
 *
 * Permission: inventory.view | accounting.view | reporting.view
 */

import { db } from '@erp/db';
import { locations } from '@erp/db';
import { products, stockLevels } from '@erp/db/schema/inventory';
import { stockOpnameLines, stockOpnameSessions } from '@erp/db/schema/stock-opname';
import { AppError } from '@erp/shared/errors';
import { type Result, err, ok } from '@erp/shared/result';
import type { AuditContext } from '@erp/shared/types';
import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { requirePermission } from '../iam';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface VarianceReportParams {
  locationId?: string; // all locations if omitted
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
}

export interface VarianceSessionRow {
  sessionId: string;
  sessionNumber: string;
  sessionDate: string;
  periodCode: string;
  locationId: string;
  locationName: string;
  totalLines: number;
  countedLines: number;
  linesWithVariance: number;
  totalVarianceValue: string; // bigint string (absolute IDR value)
  netVarianceQty: number; // signed: positive = surplus, negative = shortage
  journalEntryId: string | null;
  preparedBy: string | null;
}

export interface VarianceProductRow {
  productId: string;
  productName: string;
  categoryId: string | null;
  sku: string | null;
  uom: string;
  sessions: number; // how many sessions this product appeared in
  totalSystemQty: number;
  totalCountedQty: number;
  totalVarianceQty: number; // signed
  totalVarianceValueAbs: string; // absolute IDR value
  varianceRate: number; // % of system qty (can be > 100% on small denominators)
  worstSession: string; // session number with the largest |variance|
  worstSessionDate: string;
}

export interface VarianceReportResult {
  params: VarianceReportParams;
  summary: {
    totalSessions: number;
    totalProducts: number;
    totalLines: number;
    linesWithVariance: number;
    totalVarianceValueAbs: string; // sum of |varianceValue| across all lines
    totalSurplusValue: string; // sum of positive varianceValues
    totalShortageValue: string; // sum of negative varianceValues
    avgVarianceRate: number; // average |varianceQty| / |systemQty| across all lines
  };
  sessions: VarianceSessionRow[];
  products: VarianceProductRow[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Format a nullable bigint as string (sen/rupiah). */
function bigIntToStr(v: bigint | null): string {
  return v == null ? '0' : v.toString();
}

/** Signed numeric from DB numeric string. */
function parseNumeric(v: string | number | null | undefined): number {
  if (v == null) return 0;
  return Number.parseFloat(String(v));
}

// ─── Service ──────────────────────────────────────────────────────────────────

export async function getVarianceReport(
  params: VarianceReportParams,
  ctx: AuditContext,
): Promise<Result<VarianceReportResult>> {
  const permCheck = await requirePermission(ctx.userId, 'inventory.view', {
    locationId: params.locationId,
  });
  if (!permCheck.ok) return permCheck;

  const startDate = new Date(`${params.startDate}T00:00:00+07:00`);
  const endDateRaw = new Date(params.endDate);
  endDateRaw.setDate(endDateRaw.getDate() + 1);
  const endDate = new Date(endDateRaw.toISOString().split('T')[0] + 'T00:00:00+07:00');

  // ── Build base condition ─────────────────────────────────────────────────────
  const tenantCond = eq(stockOpnameSessions.tenantId, ctx.tenantId);
  const dateCond = and(
    gte(stockOpnameSessions.sessionDate, params.startDate),
    lte(stockOpnameSessions.sessionDate, params.endDate),
  );
  const statusCond = eq(stockOpnameSessions.status, 'approved');

  let locationCond;
  if (params.locationId) {
    locationCond = eq(stockOpnameSessions.locationId, params.locationId);
  } else {
    // All locations for this tenant
    locationCond = undefined;
  }

  const sessionWhere = and(tenantCond, dateCond, statusCond, locationCond);

  // ── Fetch approved sessions ──────────────────────────────────────────────────
  const sessions = await db
    .select()
    .from(stockOpnameSessions)
    .where(sessionWhere)
    .orderBy(desc(stockOpnameSessions.sessionDate));

  if (sessions.length === 0) {
    return ok({
      params,
      summary: {
        totalSessions: 0,
        totalProducts: 0,
        totalLines: 0,
        linesWithVariance: 0,
        totalVarianceValueAbs: '0',
        totalSurplusValue: '0',
        totalShortageValue: '0',
        avgVarianceRate: 0,
      },
      sessions: [],
      products: [],
    });
  }

  const sessionIds = sessions.map((s) => s.id);

  // ── Fetch all lines for those sessions ─────────────────────────────────────
  const lines = await db
    .select()
    .from(stockOpnameLines)
    .where(sql`${stockOpnameLines.sessionId} = ANY(${sessionIds})`);

  // ── Fetch product details ───────────────────────────────────────────────────
  const productIds = [...new Set(lines.map((l) => l.productId))];
  const productRows = await db
    .select({
      id: products.id,
      name: products.name,
      categoryId: products.categoryId,
      sku: products.sku,
    })
    .from(products)
    .where(sql`${products.id} = ANY(${productIds})`);

  const productMap = new Map(productRows.map((p) => [p.id, p]));

  // ── Fetch location names ─────────────────────────────────────────────────────
  const locationIds = [...new Set(sessions.map((s) => s.locationId))];
  const locationRows = await db
    .select({
      id: locations.id,
      name: locations.name,
    })
    .from(locations)
    .where(sql`${locations.id} = ANY(${locationIds})`);

  const locationMap = new Map(
    locationRows.map((l) => [
      l.id,
      // name is jsonb { id, en, zh } — extract id locale
      (l.name as { id: string; en: string; zh: string } | null)?.id ?? l.id,
    ]),
  );

  // ── Build session rows ────────────────────────────────────────────────────────
  const linesBySession = new Map<string, typeof lines>();
  for (const line of lines) {
    const arr = linesBySession.get(line.sessionId) ?? [];
    arr.push(line);
    linesBySession.set(line.sessionId, arr);
  }

  let totalVarianceValueAbs = 0n;
  let totalSurplusValue = 0n;
  let totalShortageValue = 0n;
  let totalVarianceQtyAbsSum = 0;
  let totalSystemQtySum = 0;

  const sessionRows: VarianceSessionRow[] = sessions.map((s) => {
    const sLines = linesBySession.get(s.id) ?? [];

    let sessTotalVarValueAbs = 0n;
    let sessSurplus = 0n;
    let sessShortage = 0n;
    let netVarianceQty = 0;

    for (const l of sLines) {
      const varValue = (l.varianceValue as bigint | null) ?? BigInt(0);
      const varQtyNum = parseNumeric(l.varianceQty);

      if (varValue !== BigInt(0)) {
        const absVal = varValue < BigInt(0) ? -varValue : varValue;
        sessTotalVarValueAbs += absVal;
        totalVarianceValueAbs += absVal;

        if (varValue > BigInt(0)) {
          sessSurplus += varValue;
          totalSurplusValue += varValue;
        } else {
          sessShortage += varValue;
          totalShortageValue += varValue;
        }
      }

      netVarianceQty += varQtyNum;

      const systemQtyNum = parseNumeric(l.systemQty);
      totalSystemQtySum += Math.abs(systemQtyNum);
      totalVarianceQtyAbsSum += Math.abs(varQtyNum);
    }

    const countedLines = sLines.filter((l) => l.isCounted).length;
    const linesWithVar = sLines.filter((l) => parseNumeric(l.varianceQty) !== 0).length;

    return {
      sessionId: s.id,
      sessionNumber: s.number,
      sessionDate: s.sessionDate.toString().substring(0, 10),
      periodCode: s.periodCode,
      locationId: s.locationId,
      locationName: locationMap.get(s.locationId) ?? s.locationId,
      totalLines: sLines.length,
      countedLines,
      linesWithVariance: linesWithVar,
      totalVarianceValue: sessTotalVarValueAbs.toString(),
      netVarianceQty,
      journalEntryId: null, // resolved from audit log if needed
      preparedBy: s.preparedBy,
    };
  });

  // ── Build product rows ───────────────────────────────────────────────────────
  const linesByProduct = new Map<string, typeof lines>();
  for (const line of lines) {
    const arr = linesByProduct.get(line.productId) ?? [];
    arr.push(line);
    linesByProduct.set(line.productId, arr);
  }

  const productRows2: VarianceProductRow[] = [];
  for (const [productId, pLines] of linesByProduct) {
    const product = productMap.get(productId);
    const uom = pLines[0]?.uom ?? '';

    let totalSystemQty = 0;
    let totalCountedQty = 0;
    let totalVarQty = 0;
    let totalVarValueAbs = 0n;
    let worstSessionNum = '';
    let worstSessionDate = '';
    let worstVarQtyAbs = 0;

    for (const l of pLines) {
      const sysNum = parseNumeric(l.systemQty);
      const cntNum = parseNumeric(l.countedQty);
      const varNum = parseNumeric(l.varianceQty);
      const varVal = (l.varianceValue as bigint | null) ?? BigInt(0);

      totalSystemQty += sysNum;
      totalCountedQty += cntNum;
      totalVarQty += varNum;

      if (varVal !== BigInt(0)) {
        const absVal = varVal < BigInt(0) ? -varVal : varVal;
        totalVarValueAbs += absVal;
      }

      if (Math.abs(varNum) > worstVarQtyAbs) {
        worstVarQtyAbs = Math.abs(varNum);
        // Find session for this line
        const sess = sessions.find((s) => s.id === l.sessionId);
        if (sess) {
          worstSessionNum = sess.number;
          worstSessionDate = sess.sessionDate.toString().substring(0, 10);
        }
      }
    }

    // Collect unique session IDs this product appeared in
    const sessionCount = new Set(pLines.map((l) => l.sessionId)).size;

    const varianceRate = totalSystemQty !== 0 ? (Math.abs(totalVarQty) / totalSystemQty) * 100 : 0;

    productRows2.push({
      productId,
      productName: product
        ? String((product.name as { id: string; en: string; zh: string })?.id ?? product.name)
        : productId,
      categoryId: product?.categoryId ?? null,
      sku: product?.sku ?? null,
      uom,
      sessions: sessionCount,
      totalSystemQty,
      totalCountedQty,
      totalVarianceQty: totalVarQty,
      totalVarianceValueAbs: totalVarValueAbs.toString(),
      varianceRate: Math.round(varianceRate * 100) / 100,
      worstSession: worstSessionNum,
      worstSessionDate,
    });
  }

  // Sort products by |varianceValue| descending
  productRows2.sort(
    (a, b) =>
      Number.parseInt(b.totalVarianceValueAbs, 10) - Number.parseInt(a.totalVarianceValueAbs, 10),
  );

  const avgVarianceRate =
    totalSystemQtySum !== 0
      ? Math.round((totalVarianceQtyAbsSum / totalSystemQtySum) * 10000) / 100
      : 0;

  const uniqueProductIds = new Set(lines.map((l) => l.productId)).size;

  return ok({
    params,
    summary: {
      totalSessions: sessions.length,
      totalProducts: uniqueProductIds,
      totalLines: lines.length,
      linesWithVariance: lines.filter((l) => parseNumeric(l.varianceQty) !== 0).length,
      totalVarianceValueAbs: totalVarianceValueAbs.toString(),
      totalSurplusValue: totalSurplusValue.toString(),
      totalShortageValue: totalShortageValue.toString(),
      avgVarianceRate,
    },
    sessions: sessionRows,
    products: productRows2,
  });
}
