/**
 * Daily Omzet (PB1-exclusive) Service — SD §25.5b, SoT §21.3b
 *
 * - getOmzetHarian: fetch gross sales, compute PB1-exclusive omzet, load adjustment
 * - saveOmzetAdjustment: upsert adjustment per location/date
 * - exportOmzetHarianXlsx: generate styled Excel file for Coretax/SPT
 *
 * PB1 10% is inclusive — back-calculate from gross:
 *   net = gross / 1.10
 *   pb1 = gross - net
 */

import { db } from '@erp/db';
import { auditLog } from '@erp/db/schema/audit';
import { locations } from '@erp/db/schema/auth';
import { salesOrders, shifts } from '@erp/db/schema/pos';
import { dailyRevenueAdjustments } from '@erp/db/schema/reporting/daily-revenue-adjustments';
import { AppError } from '@erp/shared/errors';
import { generateId } from '@erp/shared/id';
import { type Result, err, ok } from '@erp/shared/result';
import type { AuditContext } from '@erp/shared/types';
import { and, eq, sql } from 'drizzle-orm';
import { requirePermission } from '../iam';

/**
 * Locale is resolved by the caller (the action layer has next-intl).
 * Default 'id' so background callers (worker, MCP, tests) don't crash.
 */
type SupportedLocale = 'id' | 'en' | 'zh';

// ─── Constants ──────────────────────────────────────────────────────────────

/** 110 = 100 + 10 (for integer-safe PB1 strip: gross * 100 / 110) */
const PB1_DIVISOR = BigInt(110);
const PB1_MULTIPLIER = BigInt(100);

// ─── Types ─────────────────────────────────────────────────────────────────

export interface OmzetHarianResult {
  date: string;
  locationId: string;
  locationName: string;
  grossSales: string; // bigint string (in sen/IDR cents)
  pb1Amount: string; // bigint string
  netOmzet: string; // bigint string (PB1-exclusive)
  adjustmentAmount: string; // bigint string (can be negative)
  adjustmentNote: string | null;
  fiscalOmzet: string; // bigint string (netOmzet + adjustment)
  lastModified: string | null;
  shiftCount: number;
}

// ─── Integer-safe PB1 calculation ──────────────────────────────────────────

/**
 * Strip PB1 (inclusive) from gross amount.
 * Input/output are in sen (IDR cents) — BigInt.
 * Formula: net = gross * 100 / 110 (integer-safe floor division)
 *
 * Example: gross = 5.500.000 IDR (= 550_000_000 sen)
 *   net = 550_000_000 * 100 / 110 = 500_000_000 sen = 5.000.000 IDR
 *   pb1 = 550_000_000 - 500_000_000 = 50_000_000 sen = 500.000 IDR
 */
function stripPB1FromCents(grossCents: bigint): bigint {
  return (grossCents * PB1_MULTIPLIER) / PB1_DIVISOR;
}

/**
 * Convert whatever `db.execute()` returned (string, number, bigint, null) into
 * a bigint. Returns 0n for null, undefined, empty string, NaN, or non-numeric.
 */
function toBigIntSafe(value: unknown): bigint {
  if (value === null || value === undefined) return 0n;
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? BigInt(Math.trunc(value)) : 0n;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '' || !/^-?\d+(\.\d+)?$/.test(trimmed)) return 0n;
    // Drop fractional remainder (Postgres NUMERIC can return "12345.00")
    const intPart = trimmed.split('.')[0]!;
    try {
      return BigInt(intPart);
    } catch {
      return 0n;
    }
  }
  return 0n;
}

// ─── getOmzetHarian ───────────────────────────────────────────────────────

export async function getOmzetHarian(
  params: { locationId: string; date: string; locale?: SupportedLocale },
  ctx: AuditContext,
): Promise<Result<OmzetHarianResult>> {
  const permCheck = await requirePermission(ctx.userId, 'reporting.view', {
    locationId: params.locationId,
  });
  if (!permCheck.ok) return permCheck;

  try {
    // 1. Aggregate gross sales from paid sales orders for this location+date.
    // salesOrders.grandTotal is in IDR (rupiah), so multiply by 100 for sen.
    // Use explicit half-open Asia/Jakarta day range to avoid relying on
    // `DATE(... AT TIME ZONE)` which can mis-handle timestamps stored
    // without timezone in some Postgres clients.
    const dayStart = new Date(`${params.date}T00:00:00+07:00`);
    const dayEnd = new Date(dayStart);
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
    const saleAgg = await db.execute(
      sql<{ total: bigint }>`
        SELECT COALESCE(SUM(grand_total * 100), 0::bigint) as total
        FROM sales_orders
        WHERE tenant_id = ${ctx.tenantId}
          AND location_id = ${params.locationId}
          AND status = 'paid'
          AND placed_at >= ${dayStart.toISOString()}
          AND placed_at < ${dayEnd.toISOString()}
      `,
    );
    // Coerce SUM(...) carefully — node-postgres returns NUMERIC as string
    // and BIGINT as string by default. Skip BigInt() when the value is
    // null/empty/non-digit so we never throw "Cannot convert ... to BigInt".
    const grossRaw = saleAgg.rows[0]?.total;
    const grossCents = toBigIntSafe(grossRaw);

    // 2. Compute PB1 amounts
    const netCents = stripPB1FromCents(grossCents);
    const pb1Cents = grossCents - netCents;

    // 3. Load existing fiscal adjustment. MUST filter by tenant_id —
    //    otherwise a multi-tenant deployment would leak adjustments
    //    across tenants that happen to share locationId/date.
    const [adj] = await db
      .select({
        amount: dailyRevenueAdjustments.adjustmentAmount,
        note: dailyRevenueAdjustments.adjustmentNote,
        updatedAt: dailyRevenueAdjustments.updatedAt,
      })
      .from(dailyRevenueAdjustments)
      .where(
        and(
          eq(dailyRevenueAdjustments.tenantId, ctx.tenantId),
          eq(dailyRevenueAdjustments.locationId, params.locationId),
          eq(dailyRevenueAdjustments.date, params.date),
        ),
      )
      .limit(1);

    const adjCents = toBigIntSafe(adj?.amount);
    const fiscalCents = netCents + adjCents;

    // 4. Shift count for the day (using explicit Asia/Jakarta day range)
    const shiftAgg = await db.execute(
      sql<{ cnt: number }>`
        SELECT COUNT(*) as cnt
        FROM shifts
        WHERE tenant_id = ${ctx.tenantId}
          AND location_id = ${params.locationId}
          AND opened_at >= ${dayStart.toISOString()}
          AND opened_at < ${dayEnd.toISOString()}
      `,
    );
    const shiftCnt = Number(shiftAgg.rows[0]?.cnt ?? 0);

    // 5. Resolve human-readable location label so reports + the XLSX
    //    export don't show raw UUIDs. The `name` column is a
    //    LocaleString jsonb; fall back to `code` then ID.
    const locRow = await db
      .select({ name: locations.name, code: locations.code })
      .from(locations)
      .where(
        and(eq(locations.tenantId, ctx.tenantId), eq(locations.id, params.locationId)),
      )
      .limit(1)
      .then((rows) => rows[0]);

    let locationName: string = params.locationId;
    if (locRow) {
      const locale: SupportedLocale = params.locale ?? 'id';
      const nameRecord = locRow.name as Record<string, string> | null | undefined;
      locationName =
        nameRecord?.[locale] ??
        nameRecord?.id ??
        nameRecord?.en ??
        nameRecord?.zh ??
        locRow.code ??
        params.locationId;
    }

    return ok({
      date: params.date,
      locationId: params.locationId,
      locationName,
      grossSales: grossCents.toString(),
      pb1Amount: pb1Cents.toString(),
      netOmzet: netCents.toString(),
      adjustmentAmount: adjCents.toString(),
      adjustmentNote: adj?.note ?? null,
      fiscalOmzet: fiscalCents.toString(),
      lastModified: adj?.updatedAt ? String(adj.updatedAt) : null,
      shiftCount: shiftCnt,
    });
  } catch (e) {
    return err(AppError.internal('omzet.get.failed', e));
  }
}

// ─── saveOmzetAdjustment ───────────────────────────────────────────────────

export async function saveOmzetAdjustment(
  params: {
    locationId: string;
    date: string;
    adjustmentAmount: string; // bigint string (in sen)
    adjustmentNote?: string;
  },
  ctx: AuditContext,
): Promise<Result<void>> {
  const permCheck = await requirePermission(ctx.userId, 'tax.export', {
    locationId: params.locationId,
  });
  if (!permCheck.ok) return permCheck;

  try {
    const adjCents = BigInt(params.adjustmentAmount);

    // Tenant-scoped lookup — same multi-tenant guard as getOmzetHarian.
    const [existing] = await db
      .select({
        id: dailyRevenueAdjustments.id,
        adjustmentAmount: dailyRevenueAdjustments.adjustmentAmount,
        adjustmentNote: dailyRevenueAdjustments.adjustmentNote,
      })
      .from(dailyRevenueAdjustments)
      .where(
        and(
          eq(dailyRevenueAdjustments.tenantId, ctx.tenantId),
          eq(dailyRevenueAdjustments.locationId, params.locationId),
          eq(dailyRevenueAdjustments.date, params.date),
        ),
      )
      .limit(1);

    if (existing) {
      // Tenant guard on the UPDATE as well — defence in depth, even
      // though `existing.id` was filtered above.
      await db
        .update(dailyRevenueAdjustments)
        .set({
          adjustmentAmount: adjCents,
          adjustmentNote: params.adjustmentNote ?? null,
          updatedBy: ctx.userId,
        })
        .where(
          and(
            eq(dailyRevenueAdjustments.id, existing.id),
            eq(dailyRevenueAdjustments.tenantId, ctx.tenantId),
          ),
        );

      // Fiscal adjustments feed Coretax SPT exports — every edit must
      // be on the audit log (ISO 38500 + UU KUP record retention).
      await db.insert(auditLog).values({
        id: generateId(),
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        action: 'update',
        entityType: 'daily_revenue_adjustment',
        entityId: existing.id,
        before: {
          adjustmentAmount: existing.adjustmentAmount.toString(),
          adjustmentNote: existing.adjustmentNote,
        },
        after: {
          adjustmentAmount: adjCents.toString(),
          adjustmentNote: params.adjustmentNote ?? null,
          locationId: params.locationId,
          date: params.date,
        },
        metadata: { ip: ctx.ipAddress ?? null, userAgent: ctx.userAgent ?? null },
      });
    } else {
      const newId = crypto.randomUUID();
      await db.insert(dailyRevenueAdjustments).values({
        id: newId,
        tenantId: ctx.tenantId,
        locationId: params.locationId,
        date: params.date,
        adjustmentAmount: adjCents,
        adjustmentNote: params.adjustmentNote ?? null,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      });

      await db.insert(auditLog).values({
        id: generateId(),
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        action: 'create',
        entityType: 'daily_revenue_adjustment',
        entityId: newId,
        before: null,
        after: {
          adjustmentAmount: adjCents.toString(),
          adjustmentNote: params.adjustmentNote ?? null,
          locationId: params.locationId,
          date: params.date,
        },
        metadata: { ip: ctx.ipAddress ?? null, userAgent: ctx.userAgent ?? null },
      });
    }

    return ok(undefined);
  } catch (e) {
    return err(AppError.internal('omzet.saveAdjustment.failed', e));
  }
}

// ─── exportOmzetHarianXlsx ───────────────────────────────────────────────

export async function exportOmzetHarianXlsx(
  params: { locationId: string; date: string; locale?: 'id' | 'en' | 'zh' },
  ctx: AuditContext,
): Promise<Result<{ buffer: ArrayBuffer; filename: string }>> {
  const permCheck = await requirePermission(ctx.userId, 'tax.export', {
    locationId: params.locationId,
  });
  if (!permCheck.ok) return permCheck;

  try {
    const omzet = await getOmzetHarian(params, ctx);
    if (!omzet.ok) return err(omzet.error);

    const data = omzet.value;
    const locale = params.locale ?? 'id';

    const ExcelJS = await import('exceljs');
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Aroadri ERP';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Omzet Harian');

    // Header row
    const headers = getHeaders(locale);
    const headerRow = sheet.addRow(headers);
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFD6262E' },
      };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF000000' } },
        bottom: { style: 'thin', color: { argb: 'FF000000' } },
        left: { style: 'thin', color: { argb: 'FF000000' } },
        right: { style: 'thin', color: { argb: 'FF000000' } },
      };
    });
    sheet.getRow(1).height = 24;

    // Data row values (convert sen → IDR for display)
    const gross = BigInt(data.grossSales);
    const pb1 = BigInt(data.pb1Amount);
    const net = BigInt(data.netOmzet);
    const adj = BigInt(data.adjustmentAmount);

    // Column G (Fiscal Omzet) = formula =E2+F2
    const dataRow = sheet.addRow([
      data.date,
      data.locationName,
      Number(gross / BigInt(100)),
      Number(pb1 / BigInt(100)),
      Number(net / BigInt(100)),
      Number(adj / BigInt(100)),
      undefined, // formula
      data.adjustmentNote ?? '',
    ]);

    const idrFmt = '#,##0';
    dataRow.getCell(3).numFmt = idrFmt;
    dataRow.getCell(4).numFmt = idrFmt;
    dataRow.getCell(5).numFmt = idrFmt;
    dataRow.getCell(6).numFmt = idrFmt;

    // Fiscal column: formula =E2+F2
    const fiscalCell = dataRow.getCell(7);
    fiscalCell.numFmt = idrFmt;
    fiscalCell.value = { formula: 'E2+F2' };
    fiscalCell.font = { bold: true };

    // Negative adjustments in red
    if (adj < BigInt(0)) {
      dataRow.getCell(6).font = { color: { argb: 'FFFF0000' } };
    }

    // Column widths
    sheet.getColumn(1).width = 14;
    sheet.getColumn(2).width = 20;
    sheet.getColumn(3).width = 18;
    sheet.getColumn(4).width = 15;
    sheet.getColumn(5).width = 18;
    sheet.getColumn(6).width = 16;
    sheet.getColumn(7).width = 18;
    sheet.getColumn(8).width = 30;

    // Freeze pane at row 2
    sheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];
    sheet.autoFilter = 'A1:H1';

    const buffer = (await workbook.xlsx.writeBuffer()) as ArrayBuffer;
    const locSlug = params.locationId.replace(/[^a-z0-9]/gi, '-').toLowerCase();
    const filename = `omzet-harian-${params.date}-${locSlug}.xlsx`;

    return ok({ buffer, filename });
  } catch (e) {
    return err(AppError.internal('omzet.export.failed', e));
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function getHeaders(locale: string): string[] {
  if (locale === 'zh') {
    return [
      '日期',
      '地点',
      '总销售额 (IDR)',
      'PB1 10% (IDR)',
      '净收入 (IDR)',
      '调整金额 (IDR)',
      '财政应税收入 (IDR)',
      '备注',
    ];
  }
  if (locale === 'en') {
    return [
      'Date',
      'Location',
      'Gross Sales (IDR)',
      'PB1 10% (IDR)',
      'Net Revenue (IDR)',
      'Adjustment (IDR)',
      'Fiscal Omzet (IDR)',
      'Note',
    ];
  }
  return [
    'Tanggal',
    'Lokasi',
    'Gross Sales (IDR)',
    'PB1 10% (IDR)',
    'Omzet Neto (IDR)',
    'Penyesuaian (IDR)',
    'Omzet Fiskal (IDR)',
    'Keterangan',
  ];
}
