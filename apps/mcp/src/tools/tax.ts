/**
 * Tax MCP tools — SD §16.4, §19
 *
 * Tools:
 * - tax.list_rates
 * - tax.export_coretax
 */

import { db } from '@erp/db';
import { journalEntries, journalLines, taxRates } from '@erp/db/schema/accounting';
import { can } from '@erp/services/iam';
import { listRates } from '@erp/services/tax';
import { and, eq, gte, inArray, isNotNull, lt } from 'drizzle-orm';
import { z } from 'zod';
import type { McpContext } from '../context';
import { mcpError, mcpSuccess, serializeResult } from '../helpers';

async function checkPermission(ctx: McpContext, permission: string) {
  return can(ctx.userId, permission);
}

// --- Schemas ---

export const ListRatesSchema = z.object({
  locale: z.enum(['id', 'en', 'zh']).optional().default('id'),
  active_only: z.boolean().optional().default(true),
});

export const ExportCoretaxSchema = z.object({
  period_code: z.string().regex(/^\d{4}-\d{2}$/),
  format: z.enum(['csv', 'xlsx']).default('csv'),
});

// --- Tool list ---

export const taxTools = [
  { name: 'tax.list_rates', schema: ListRatesSchema, handler: listRatesHandler },
  { name: 'tax.export_coretax', schema: ExportCoretaxSchema, handler: exportCoretaxHandler },
] as const;

// --- Handlers ---

async function listRatesHandler(input: z.infer<typeof ListRatesSchema>, ctx: McpContext) {
  const permitted = await checkPermission(ctx, 'tax.view');
  if (!permitted) return mcpError('FORBIDDEN', 'Permission denied: tax.view');

  const locale = input.locale ?? (ctx.locale as 'id' | 'en' | 'zh');
  const rates = await listRates(
    { activeOnly: input.active_only },
    { userId: ctx.userId, tenantId: ctx.tenantId, locationId: 'system' },
  );

  if (!rates.ok) return serializeResult(rates);

  const formatted = rates.value.map((r) => ({
    code: r.code,
    name: r.name[locale] ?? r.name.id,
    rate_bps: r.rateBps,
    rate_percent: `${r.ratePercent}%`,
    calculation: r.calculation,
  }));

  return mcpSuccess(formatted);
}

async function exportCoretaxHandler(input: z.infer<typeof ExportCoretaxSchema>, ctx: McpContext) {
  const permitted = await checkPermission(ctx, 'tax.export');
  if (!permitted) return mcpError('FORBIDDEN', 'Permission denied: tax.export');

  const fromDate = `${input.period_code}-01`;
  const parts = input.period_code.split('-').map((part) => Number.parseInt(part, 10));
  const year = parts[0] ?? 0;
  const month = parts[1] ?? 1;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const toDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;

  const lines = await db
    .select({
      taxCode: journalLines.taxCode,
      debit: journalLines.debit,
      credit: journalLines.credit,
    })
    .from(journalLines)
    .innerJoin(journalEntries, eq(journalLines.journalEntryId, journalEntries.id))
    .where(
      and(
        eq(journalEntries.tenantId, ctx.tenantId),
        eq(journalEntries.status, 'posted'),
        isNotNull(journalLines.taxCode),
        gte(journalEntries.postingDate, fromDate),
        lt(journalEntries.postingDate, toDate),
      ),
    );

  const summary = new Map<
    string,
    { taxCode: string; debit: bigint; credit: bigint; lineCount: number }
  >();
  for (const line of lines) {
    if (!line.taxCode) continue;
    const current = summary.get(line.taxCode) ?? {
      taxCode: line.taxCode,
      debit: 0n,
      credit: 0n,
      lineCount: 0,
    };
    current.debit += line.debit;
    current.credit += line.credit;
    current.lineCount += 1;
    summary.set(line.taxCode, current);
  }

  const codes = Array.from(summary.keys());
  const rateRows =
    codes.length > 0
      ? await db
          .select({ code: taxRates.code, name: taxRates.name, rateBps: taxRates.rateBps })
          .from(taxRates)
          .where(inArray(taxRates.code, codes))
      : [];
  const rateMap = new Map(rateRows.map((rate) => [rate.code, rate]));

  const rows = Array.from(summary.values()).map((row) => {
    const rate = rateMap.get(row.taxCode);
    const name = (rate?.name as Record<string, string> | undefined) ?? {};
    return {
      period_code: input.period_code,
      tax_code: row.taxCode,
      tax_name: name.id ?? name.en ?? row.taxCode,
      rate_bps: rate?.rateBps ?? null,
      debit: row.debit.toString(),
      credit: row.credit.toString(),
      net_credit: (row.credit - row.debit).toString(),
      line_count: row.lineCount,
    };
  });

  const csv = [
    'period_code,tax_code,tax_name,rate_bps,debit,credit,net_credit,line_count',
    ...rows.map((row) =>
      [
        row.period_code,
        row.tax_code,
        JSON.stringify(row.tax_name),
        row.rate_bps ?? '',
        row.debit,
        row.credit,
        row.net_credit,
        row.line_count,
      ].join(','),
    ),
  ].join('\n');

  return mcpSuccess({
    period_code: input.period_code,
    format: input.format,
    rows,
    csv: input.format === 'csv' ? csv : undefined,
    exported_at: new Date().toISOString(),
  });
}
