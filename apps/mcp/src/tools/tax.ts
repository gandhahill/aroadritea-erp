/**
 * Tax MCP tools — SD §16.4, §19
 *
 * Tools:
 * - tax.list_rates
 * - tax.export_coretax
 */

import { auditLog, db } from '@erp/db';
import {
  accounts,
  journalEntries,
  journalLines,
  taxRates,
  taxRules,
} from '@erp/db/schema/accounting';
import { can } from '@erp/services/iam';
import { listRates } from '@erp/services/tax';
import { generateId } from '@erp/shared/id';
import { and, asc, eq, gte, inArray, isNotNull, isNull, lt } from 'drizzle-orm';
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

const LocaleNameSchema = z.object({
  id: z.string().min(1).max(160),
  en: z.string().min(1).max(160),
  zh: z.string().min(1).max(160),
});

export const UpsertTaxRateSchema = z.object({
  id: z.string().optional(),
  code: z
    .string()
    .min(2)
    .max(32)
    .regex(/^[A-Za-z0-9_-]+$/),
  name: LocaleNameSchema,
  rate_bps: z.number().int().min(0).max(10000),
  calculation: z.enum(['inclusive', 'exclusive']),
  posting_account_id: z.string(),
  is_active: z.boolean().optional().default(true),
  effective_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  effective_until: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
});

export const DeleteTaxRateSchema = z.object({ id: z.string() });

export const ListTaxRulesSchema = z.object({});

export const UpsertTaxRuleSchema = z.object({
  id: z.string().optional(),
  scope_kind: z.enum(['channel', 'customer_segment', 'product_category', 'global_default']),
  scope_id: z.string().optional().nullable(),
  tax_code: z.string().min(1).max(32),
  is_applied_default: z.boolean().optional().default(true),
  priority: z.number().int().min(0).max(9999).optional().default(10),
  effective_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  effective_until: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
});

export const DeleteTaxRuleSchema = z.object({ id: z.string() });

// --- Tool list ---

export const taxTools = [
  { name: 'tax.list_rates', schema: ListRatesSchema, handler: listRatesHandler },
  { name: 'tax.export_coretax', schema: ExportCoretaxSchema, handler: exportCoretaxHandler },
  {
    name: 'tax.upsert_rate',
    schema: UpsertTaxRateSchema,
    handler: upsertTaxRateHandler,
    description: 'Create or update a tax rate through the same permission boundary as ERP UI.',
  },
  {
    name: 'tax.delete_rate',
    schema: DeleteTaxRateSchema,
    handler: deleteTaxRateHandler,
    description: 'Soft-delete a tax rate.',
  },
  {
    name: 'tax.list_rules',
    schema: ListTaxRulesSchema,
    handler: listTaxRulesHandler,
    description: 'List database-driven tax rules.',
  },
  {
    name: 'tax.upsert_rule',
    schema: UpsertTaxRuleSchema,
    handler: upsertTaxRuleHandler,
    description: 'Create or update a database-driven tax rule.',
  },
  {
    name: 'tax.delete_rule',
    schema: DeleteTaxRuleSchema,
    handler: deleteTaxRuleHandler,
    description: 'Soft-delete a tax rule.',
  },
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

async function upsertTaxRateHandler(input: z.infer<typeof UpsertTaxRateSchema>, ctx: McpContext) {
  const permitted = await checkPermission(ctx, 'tax.manage_global_rates');
  if (!permitted) return mcpError('FORBIDDEN', 'Permission denied: tax.manage_global_rates');

  const [postingAccount] = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(
      and(
        eq(accounts.id, input.posting_account_id),
        eq(accounts.tenantId, ctx.tenantId),
        eq(accounts.isActive, true),
        eq(accounts.isPostable, true),
        isNull(accounts.deletedAt),
      ),
    )
    .limit(1);
  if (!postingAccount) return mcpError('INVALID_INPUT', 'posting_account_id is not valid');

  const now = new Date();
  const values = {
    code: input.code.trim().toUpperCase(),
    name: input.name,
    rateBps: input.rate_bps,
    calculation: input.calculation,
    postingAccountId: input.posting_account_id,
    isActive: input.is_active,
    effectiveFrom: input.effective_from,
    effectiveUntil: input.effective_until ?? null,
    updatedAt: now,
    updatedBy: ctx.userId,
  };

  if (input.id) {
    const [before] = await db.select().from(taxRates).where(eq(taxRates.id, input.id)).limit(1);
    if (!before) return mcpError('NOT_FOUND', `Tax rate ${input.id} not found`);
    await db.update(taxRates).set(values).where(eq(taxRates.id, input.id));
    await db.insert(auditLog).values({
      id: generateId(),
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      action: 'update',
      entityType: 'tax_rate',
      entityId: input.id,
      before: before as never,
      after: values as never,
    });
    return mcpSuccess({ id: input.id });
  }

  const id = generateId();
  await db.insert(taxRates).values({
    id,
    ...values,
    createdBy: ctx.userId,
  });
  await db.insert(auditLog).values({
    id: generateId(),
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: 'create',
    entityType: 'tax_rate',
    entityId: id,
    before: null,
    after: values as never,
  });
  return mcpSuccess({ id });
}

async function deleteTaxRateHandler(input: z.infer<typeof DeleteTaxRateSchema>, ctx: McpContext) {
  const permitted = await checkPermission(ctx, 'tax.manage_global_rates');
  if (!permitted) return mcpError('FORBIDDEN', 'Permission denied: tax.manage_global_rates');

  const [before] = await db.select().from(taxRates).where(eq(taxRates.id, input.id)).limit(1);
  if (!before) return mcpError('NOT_FOUND', `Tax rate ${input.id} not found`);
  const deletedAt = new Date();
  await db
    .update(taxRates)
    .set({ isActive: false, deletedAt, updatedAt: deletedAt, updatedBy: ctx.userId })
    .where(eq(taxRates.id, input.id));
  await db.insert(auditLog).values({
    id: generateId(),
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: 'delete',
    entityType: 'tax_rate',
    entityId: input.id,
    before: before as never,
    after: { deletedAt: deletedAt.toISOString(), isActive: false } as never,
  });
  return mcpSuccess({ id: input.id });
}

async function listTaxRulesHandler(input: z.infer<typeof ListTaxRulesSchema>, ctx: McpContext) {
  const parsed = ListTaxRulesSchema.safeParse(input);
  if (!parsed.success) return mcpError('INVALID_INPUT', String(parsed.error.issues));
  const permitted = await checkPermission(ctx, 'tax.view');
  if (!permitted) return mcpError('FORBIDDEN', 'Permission denied: tax.view');

  const rows = await db
    .select()
    .from(taxRules)
    .where(and(eq(taxRules.tenantId, ctx.tenantId), isNull(taxRules.deletedAt)))
    .orderBy(asc(taxRules.scopeKind), asc(taxRules.priority));
  return mcpSuccess({ items: rows });
}

async function upsertTaxRuleHandler(input: z.infer<typeof UpsertTaxRuleSchema>, ctx: McpContext) {
  const permitted = await checkPermission(ctx, 'tax.manage_global_rates');
  if (!permitted) return mcpError('FORBIDDEN', 'Permission denied: tax.manage_global_rates');

  const now = new Date();
  const values = {
    scopeKind: input.scope_kind,
    scopeId: input.scope_kind === 'global_default' ? null : (input.scope_id ?? null),
    taxCode: input.tax_code.trim().toUpperCase(),
    isAppliedDefault: input.is_applied_default,
    priority: input.priority,
    effectiveFrom: input.effective_from,
    effectiveUntil: input.effective_until ?? null,
    updatedAt: now,
    updatedBy: ctx.userId,
  };

  if (input.id) {
    const [before] = await db
      .select()
      .from(taxRules)
      .where(and(eq(taxRules.tenantId, ctx.tenantId), eq(taxRules.id, input.id)))
      .limit(1);
    if (!before) return mcpError('NOT_FOUND', `Tax rule ${input.id} not found`);
    await db
      .update(taxRules)
      .set(values)
      .where(and(eq(taxRules.tenantId, ctx.tenantId), eq(taxRules.id, input.id)));
    await db.insert(auditLog).values({
      id: generateId(),
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      action: 'update',
      entityType: 'tax_rule',
      entityId: input.id,
      before: before as never,
      after: values as never,
    });
    return mcpSuccess({ id: input.id });
  }

  const id = generateId();
  await db.insert(taxRules).values({
    id,
    tenantId: ctx.tenantId,
    ...values,
    createdBy: ctx.userId,
  });
  await db.insert(auditLog).values({
    id: generateId(),
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: 'create',
    entityType: 'tax_rule',
    entityId: id,
    before: null,
    after: values as never,
  });
  return mcpSuccess({ id });
}

async function deleteTaxRuleHandler(input: z.infer<typeof DeleteTaxRuleSchema>, ctx: McpContext) {
  const permitted = await checkPermission(ctx, 'tax.manage_global_rates');
  if (!permitted) return mcpError('FORBIDDEN', 'Permission denied: tax.manage_global_rates');

  const [before] = await db
    .select()
    .from(taxRules)
    .where(and(eq(taxRules.tenantId, ctx.tenantId), eq(taxRules.id, input.id)))
    .limit(1);
  if (!before) return mcpError('NOT_FOUND', `Tax rule ${input.id} not found`);
  const deletedAt = new Date();
  await db
    .update(taxRules)
    .set({ deletedAt, updatedAt: deletedAt, updatedBy: ctx.userId })
    .where(and(eq(taxRules.tenantId, ctx.tenantId), eq(taxRules.id, input.id)));
  await db.insert(auditLog).values({
    id: generateId(),
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: 'delete',
    entityType: 'tax_rule',
    entityId: input.id,
    before: before as never,
    after: { deletedAt: deletedAt.toISOString() } as never,
  });
  return mcpSuccess({ id: input.id });
}
