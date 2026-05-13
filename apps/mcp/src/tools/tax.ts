/**
 * Tax MCP tools — SD §16.4, §19
 *
 * Tools:
 * - tax.list_rates
 * - tax.export_coretax
 */

import { db } from '@erp/db';
import { taxRates, taxRules } from '@erp/db/schema/accounting';
import { can } from '@erp/services/iam';
import { listRates } from '@erp/services/tax';
import { and, eq, isNull } from 'drizzle-orm';
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
  period_code: z.string(),
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
    name: r.name[locale] ?? r.name['id'],
    rate_bps: r.rateBps,
    rate_percent: r.ratePercent + '%',
    calculation: r.calculation,
  }));

  return mcpSuccess(formatted);
}

async function exportCoretaxHandler(input: z.infer<typeof ExportCoretaxSchema>, ctx: McpContext) {
  const permitted = await checkPermission(ctx, 'tax.export');
  if (!permitted) return mcpError('FORBIDDEN', 'Permission denied: tax.export');

  // Coretax export: collect all tax-relevant journal lines for the period
  // Full implementation in Phase 3+ (needs sales + purchase journals for PPN Masukan/Keluaran)
  return mcpSuccess({
    period_code: input.period_code,
    format: input.format,
    note: 'Coretax export. Full implementation in Phase 3+.',
    exported_at: new Date().toISOString(),
  });
}
