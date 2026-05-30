import { db } from '@erp/db';
import { locations } from '@erp/db/schema/auth';
import { manualSalesClosings } from '@erp/db/schema/pos';
import { dailyRevenueAdjustments } from '@erp/db/schema/reporting/daily-revenue-adjustments';
import { AppError } from '@erp/shared/errors';
import { type Result, err, ok } from '@erp/shared/result';
import type { AuditContext } from '@erp/shared/types';
import { and, eq, sql } from 'drizzle-orm';
import { requirePermission } from '../iam';

type SupportedLocale = 'id' | 'en' | 'zh';

const PB1_DIVISOR = BigInt(110);
const PB1_MULTIPLIER = BigInt(100);

export interface OmzetBulananRow {
  date: string; // YYYY-MM-DD
  grossSales: string;
  pb1Amount: string;
  netOmzet: string;
  adjustmentAmount: string;
  fiscalOmzet: string;
}

export interface OmzetBulananResult {
  period: string; // YYYY-MM
  locationId: string;
  locationName: string;
  rows: OmzetBulananRow[];
  totals: OmzetBulananRow; // aggregated totals
}

function stripPB1FromCents(grossCents: bigint): bigint {
  return (grossCents * PB1_MULTIPLIER) / PB1_DIVISOR;
}

function toBigIntSafe(value: unknown): bigint {
  if (value === null || value === undefined) return 0n;
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? BigInt(Math.trunc(value)) : 0n;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '' || !/^-?\d+(\.\d+)?$/.test(trimmed)) return 0n;
    const intPart = trimmed.split('.')[0]!;
    try {
      return BigInt(intPart);
    } catch {
      return 0n;
    }
  }
  return 0n;
}

export async function getOmzetBulanan(
  params: { locationId: string; period: string; locale?: SupportedLocale },
  ctx: AuditContext,
): Promise<Result<OmzetBulananResult>> {
  const permCheck = await requirePermission(ctx.userId, 'reporting.view', {
    locationId: params.locationId,
  });
  if (!permCheck.ok) return permCheck;

  try {
    const [year, month] = params.period.split('-');
    const startDate = new Date(`${params.period}-01T00:00:00+07:00`);
    const endDate = new Date(startDate);
    endDate.setUTCMonth(endDate.getUTCMonth() + 1);

    // Get gross from sales orders (sum per day)
    const saleAgg = await db.execute(
      sql<{ date_val: string; total: bigint }>`
        SELECT TO_CHAR(placed_at AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD') as date_val,
               COALESCE(SUM(grand_total * 100), 0::bigint) as total
        FROM sales_orders
        WHERE tenant_id = ${ctx.tenantId}
          AND location_id = ${params.locationId}
          AND status = 'paid'
          AND placed_at >= ${startDate.toISOString()}
          AND placed_at < ${endDate.toISOString()}
        GROUP BY 1
      `,
    );

    // Get gross from manual sales
    const manualAgg = await db.execute(
      sql<{ date_val: string; total: bigint }>`
        SELECT sales_date as date_val,
               COALESCE(SUM((gross_sales - discount_total) * 100), 0::bigint) as total
        FROM manual_sales_closings
        WHERE tenant_id = ${ctx.tenantId}
          AND location_id = ${params.locationId}
          AND status = 'posted'
          AND sales_date >= ${`${params.period}-01`}
          AND sales_date <= ${`${params.period}-31`}
        GROUP BY 1
      `,
    );

    // Get adjustments
    const adjAgg = await db
      .select({
        date: dailyRevenueAdjustments.date,
        amount: dailyRevenueAdjustments.adjustmentAmount,
      })
      .from(dailyRevenueAdjustments)
      .where(
        and(
          eq(dailyRevenueAdjustments.tenantId, ctx.tenantId),
          eq(dailyRevenueAdjustments.locationId, params.locationId),
          sql`${dailyRevenueAdjustments.date} >= ${`${params.period}-01`}`,
          sql`${dailyRevenueAdjustments.date} <= ${`${params.period}-31`}`
        )
      );

    const grossByDate = new Map<string, bigint>();
    for (const row of saleAgg as unknown as Array<any>) {
      if (row.date_val) grossByDate.set(String(row.date_val), toBigIntSafe(row.total));
    }
    for (const row of manualAgg as unknown as Array<any>) {
      if (row.date_val) {
        const dateStr = String(row.date_val);
        const existing = grossByDate.get(dateStr) ?? 0n;
        grossByDate.set(dateStr, existing + toBigIntSafe(row.total));
      }
    }

    const adjByDate = new Map<string, bigint>();
    for (const row of adjAgg) {
      adjByDate.set(row.date, toBigIntSafe(row.amount));
    }

    // Resolve location name
    const locRow = await db
      .select({ name: locations.name, code: locations.code })
      .from(locations)
      .where(and(eq(locations.tenantId, ctx.tenantId), eq(locations.id, params.locationId)))
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

    // Build days array
    const daysInMonth = new Date(Number(year), Number(month), 0).getDate();
    const rows: OmzetBulananRow[] = [];
    let totGross = 0n;
    let totPb1 = 0n;
    let totNet = 0n;
    let totAdj = 0n;
    let totFiscal = 0n;

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${params.period}-${String(day).padStart(2, '0')}`;
      const gross = grossByDate.get(dateStr) ?? 0n;
      const net = stripPB1FromCents(gross);
      const pb1 = gross - net;
      const adj = adjByDate.get(dateStr) ?? 0n;
      const fiscal = net + adj;

      rows.push({
        date: dateStr,
        grossSales: gross.toString(),
        pb1Amount: pb1.toString(),
        netOmzet: net.toString(),
        adjustmentAmount: adj.toString(),
        fiscalOmzet: fiscal.toString(),
      });

      totGross += gross;
      totPb1 += pb1;
      totNet += net;
      totAdj += adj;
      totFiscal += fiscal;
    }

    return ok({
      period: params.period,
      locationId: params.locationId,
      locationName,
      rows,
      totals: {
        date: 'TOTAL',
        grossSales: totGross.toString(),
        pb1Amount: totPb1.toString(),
        netOmzet: totNet.toString(),
        adjustmentAmount: totAdj.toString(),
        fiscalOmzet: totFiscal.toString(),
      },
    });
  } catch (e) {
    return err(AppError.internal('omzet.monthly.failed', e));
  }
}

export async function exportOmzetBulananXlsx(
  params: { locationId: string; period: string; locale?: 'id' | 'en' | 'zh' },
  ctx: AuditContext,
): Promise<Result<{ buffer: ArrayBuffer; filename: string }>> {
  const permCheck = await requirePermission(ctx.userId, 'tax.export', {
    locationId: params.locationId,
  });
  if (!permCheck.ok) return permCheck;

  try {
    const omzetRes = await getOmzetBulanan(params, ctx);
    if (!omzetRes.ok) return err(omzetRes.error);

    const data = omzetRes.value;
    const locale = params.locale ?? 'id';

    const ExcelJS = await import('exceljs');
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Aroadri ERP';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet(`PB1 ${params.period}`);

    // Headers
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

    const idrFmt = '#,##0';

    for (const row of data as unknown as Array<any>) {
      const r = sheet.addRow([
        row.date,
        data.locationName,
        Number(BigInt(row.grossSales) / 100n),
        Number(BigInt(row.pb1Amount) / 100n),
        Number(BigInt(row.netOmzet) / 100n),
        Number(BigInt(row.adjustmentAmount) / 100n),
        Number(BigInt(row.fiscalOmzet) / 100n),
      ]);
      r.getCell(3)!.numFmt = idrFmt;
      r.getCell(4)!.numFmt = idrFmt;
      r.getCell(5)!.numFmt = idrFmt;
      r.getCell(6)!.numFmt = idrFmt;
      r.getCell(7)!.numFmt = idrFmt;
    }

    const tRow = sheet.addRow([
      data.totals.date,
      '',
      Number(BigInt(data.totals.grossSales) / 100n),
      Number(BigInt(data.totals.pb1Amount) / 100n),
      Number(BigInt(data.totals.netOmzet) / 100n),
      Number(BigInt(data.totals.adjustmentAmount) / 100n),
      Number(BigInt(data.totals.fiscalOmzet) / 100n),
    ]);
    tRow.font = { bold: true };
    tRow.eachCell((cell, cId) => {
      if (cId >= 3 && cell) cell.numFmt = idrFmt;
      if (cell) cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFEAEAEA' },
      };
    });

    sheet.getColumn(1).width = 14;
    sheet.getColumn(2).width = 20;
    sheet.getColumn(3).width = 18;
    sheet.getColumn(4).width = 15;
    sheet.getColumn(5).width = 18;
    sheet.getColumn(6).width = 16;
    sheet.getColumn(7).width = 18;

    sheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];
    sheet.autoFilter = 'A1:G1';

    const buffer = (await workbook.xlsx.writeBuffer()) as ArrayBuffer;
    const locSlug = params.locationId.replace(/[^a-z0-9]/gi, '-').toLowerCase();
    const filename = `rekap-pb1-${params.period}-${locSlug}.xlsx`;

    return ok({ buffer, filename });
  } catch (e) {
    return err(AppError.internal('omzet.monthly.export.failed', e));
  }
}

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
  ];
}
