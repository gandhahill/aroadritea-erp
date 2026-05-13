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

import { eq, and, sql } from 'drizzle-orm';
import { db } from '@erp/db';
import { salesOrders, shifts } from '@erp/db/schema/pos';
import { dailyRevenueAdjustments } from '@erp/db/schema/reporting/daily-revenue-adjustments';
import { type Result, ok, err } from '@erp/shared/result';
import { AppError } from '@erp/shared/errors';
import type { AuditContext } from '@erp/shared/types';
import { requirePermission } from '../iam';

// ─── Constants ──────────────────────────────────────────────────────────────

/** 110 = 100 + 10 (for integer-safe PB1 strip: gross * 100 / 110) */
const PB1_DIVISOR = BigInt(110);
const PB1_MULTIPLIER = BigInt(100);

// ─── Types ─────────────────────────────────────────────────────────────────

export interface OmzetHarianResult {
  date: string;
  locationId: string;
  locationName: string;
  grossSales: string;         // bigint string (in sen/IDR cents)
  pb1Amount: string;           // bigint string
  netOmzet: string;           // bigint string (PB1-exclusive)
  adjustmentAmount: string;   // bigint string (can be negative)
  adjustmentNote: string | null;
  fiscalOmzet: string;         // bigint string (netOmzet + adjustment)
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

// ─── getOmzetHarian ───────────────────────────────────────────────────────

export async function getOmzetHarian(
  params: { locationId: string; date: string },
  ctx: AuditContext,
): Promise<Result<OmzetHarianResult>> {
  const permCheck = await requirePermission(ctx.userId, 'reporting.view', {
    locationId: params.locationId,
  });
  if (!permCheck.ok) return permCheck;

  try {
    // 1. Aggregate gross sales from completed sales orders for this location+date
    // salesOrders.grandTotal is in IDR (not sen), so multiply by 100n for cents
    const saleAgg = await db.execute(
      sql<{ total: bigint }>`
        SELECT COALESCE(SUM(grand_total * 100), 0::bigint) as total
        FROM sales_orders
        WHERE location_id = ${params.locationId}
          AND status = 'completed'
          AND DATE(created_at AT TIME ZONE 'Asia/Jakarta') = ${params.date}
      `,
    );
    const grossCents = (saleAgg.rows[0]?.total as unknown as bigint) ?? BigInt(0);

    // 2. Compute PB1 amounts
    const netCents = stripPB1FromCents(grossCents);
    const pb1Cents = grossCents - netCents;

    // 3. Load existing fiscal adjustment
    const [adj] = await db
      .select({
        amount: dailyRevenueAdjustments.adjustmentAmount,
        note: dailyRevenueAdjustments.adjustmentNote,
        updatedAt: dailyRevenueAdjustments.updatedAt,
      })
      .from(dailyRevenueAdjustments)
      .where(
        and(
          eq(dailyRevenueAdjustments.locationId, params.locationId),
          eq(dailyRevenueAdjustments.date, params.date),
        ),
      )
      .limit(1);

    const adjCents = (adj?.amount as unknown as bigint) ?? BigInt(0);
    const fiscalCents = netCents + adjCents;

    // 4. Shift count for the day
    const shiftAgg = await db.execute(
      sql<{ cnt: number }>`
        SELECT COUNT(*) as cnt
        FROM shifts
        WHERE location_id = ${params.locationId}
          AND DATE(opened_at AT TIME ZONE 'Asia/Jakarta') = ${params.date}
      `,
    );
    const shiftCnt = Number(shiftAgg.rows[0]?.cnt ?? 0);

    return ok({
      date: params.date,
      locationId: params.locationId,
      locationName: params.locationId, // caller maps ID → name
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
  const permCheck = await requirePermission(ctx.userId, 'accounting.view', {
    locationId: params.locationId,
  });
  if (!permCheck.ok) return permCheck;

  try {
    const adjCents = BigInt(params.adjustmentAmount);

    const [existing] = await db
      .select({ id: dailyRevenueAdjustments.id })
      .from(dailyRevenueAdjustments)
      .where(
        and(
          eq(dailyRevenueAdjustments.locationId, params.locationId),
          eq(dailyRevenueAdjustments.date, params.date),
        ),
      )
      .limit(1);

    if (existing) {
      await db
        .update(dailyRevenueAdjustments)
        .set({
          adjustmentAmount: adjCents,
          adjustmentNote: params.adjustmentNote ?? null,
          updatedBy: ctx.userId,
        })
        .where(eq(dailyRevenueAdjustments.id, existing.id));
    } else {
      await db.insert(dailyRevenueAdjustments).values({
        id: crypto.randomUUID(),
        tenantId: ctx.tenantId,
        locationId: params.locationId,
        date: params.date,
        adjustmentAmount: adjCents,
        adjustmentNote: params.adjustmentNote ?? null,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
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
  const permCheck = await requirePermission(ctx.userId, 'accounting.view', {
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

    const buffer = await workbook.xlsx.writeBuffer() as ArrayBuffer;
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
    return ['日期', '地点', '总销售额 (IDR)', 'PB1 10% (IDR)', '净收入 (IDR)', '调整金额 (IDR)', '财政应税收入 (IDR)', '备注'];
  }
  if (locale === 'en') {
    return ['Date', 'Location', 'Gross Sales (IDR)', 'PB1 10% (IDR)', 'Net Revenue (IDR)', 'Adjustment (IDR)', 'Fiscal Omzet (IDR)', 'Note'];
  }
  return ['Tanggal', 'Lokasi', 'Gross Sales (IDR)', 'PB1 10% (IDR)', 'Omzet Neto (IDR)', 'Penyesuaian (IDR)', 'Omzet Fiskal (IDR)', 'Keterangan'];
}