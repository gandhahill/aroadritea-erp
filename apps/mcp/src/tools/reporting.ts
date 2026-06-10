import type { PermissionCode } from '@erp/shared/types';
/**
 * Reporting MCP tools — SD §16.4, §21.2
 *
 * Tools:
 * - reporting.balance_sheet
 * - reporting.profit_loss
 * - reporting.cash_flow
 * - reporting.general_ledger
 * - reporting.trial_balance
 */

import { db } from '@erp/db';
import { accounts, journalEntries, journalLines } from '@erp/db/schema/accounting';
import { can } from '@erp/services/iam';
import {
  balanceSheet,
  cashFlow,
  financialStatementNotes,
  getDailySummary,
  getDonationReport,
  getHourlySales,
  profitLoss,
  trialBalance,
} from '@erp/services/reporting';
import type {
  BalanceSheetInput,
  CashFlowInput,
  DailySummaryParams,
  DonationReportParams,
  FinancialStatementNotesInput,
  HourlySalesParams,
  ProfitLossInput,
  TrialBalanceInput,
} from '@erp/services/reporting';
import { and, eq, gte, lte } from 'drizzle-orm';
import { z } from 'zod';
import type { McpContext } from '../context';
import { mcpError, mcpSuccess, serializeResult } from '../helpers';
import { GetOmzetHarianSchema, getOmzetHarianHandler } from './reporting-omzet';

async function checkPermission(ctx: McpContext, permission: PermissionCode, locationId: string) {
  return can(ctx.userId, permission, { locationId });
}

// --- Schemas ---

export const BalanceSheetSchema = z.object({
  as_of: z.string(),
  location_id: z.string().min(1, 'location_id is required for MCP access'),
  locale: z.enum(['id', 'en', 'zh']).optional().default('id'),
});

export const ProfitLossSchema = z.object({
  from: z.string(),
  to: z.string(),
  location_id: z.string().min(1, 'location_id is required for MCP access'),
  locale: z.enum(['id', 'en', 'zh']).optional().default('id'),
});

export const CashFlowSchema = z.object({
  from: z.string(),
  to: z.string(),
  location_id: z.string().min(1, 'location_id is required for MCP access'),
  cash_account_codes: z.array(z.string()).optional(),
  locale: z.enum(['id', 'en', 'zh']).optional().default('id'),
});

export const GeneralLedgerSchema = z.object({
  account_id: z.string(),
  from: z.string(),
  to: z.string(),
  location_id: z.string().min(1, 'location_id is required for MCP access'),
  limit: z.number().int().min(1).max(200).optional().default(100),
  offset: z.number().int().min(0).max(10_000).optional().default(0),
  locale: z.enum(['id', 'en', 'zh']).optional().default('id'),
});

export const TrialBalanceSchema = z.object({
  as_of: z.string(),
  location_id: z.string().min(1, 'location_id is required for MCP access'),
  locale: z.enum(['id', 'en', 'zh']).optional().default('id'),
});

export const FinancialStatementNotesSchema = z.object({
  period_start: z.string(),
  period_end: z.string(),
  reporting_date: z.string(),
  location_id: z.string().min(1, 'location_id is required for MCP access'),
  first_sak_ep_financial_statements: z.boolean().optional().default(false),
  previous_framework: z.string().optional(),
  locale: z.enum(['id', 'en', 'zh']).optional().default('id'),
});

export const DailySummarySchema = z.object({
  location_id: z.string(),
  start_date: z.string(),
  end_date: z.string(),
  cashier_id: z.string().optional(),
});

export const DonationReportSchema = z.object({
  start_date: z.string(),
  end_date: z.string(),
  location_id: z.string().min(1, 'location_id is required for MCP access'),
});

export const HourlySalesSchema = z.object({
  start_date: z.string(),
  end_date: z.string(),
  location_id: z.string().min(1, 'location_id is required for MCP access'),
  group_by: z.enum(['channel', 'day']).optional().default('channel'),
});

// --- Tool list ---

export const reportingTools = [
  { name: 'reporting.balance_sheet', schema: BalanceSheetSchema, handler: balanceSheetHandler },
  { name: 'reporting.profit_loss', schema: ProfitLossSchema, handler: profitLossHandler },
  { name: 'reporting.cash_flow', schema: CashFlowSchema, handler: cashFlowHandler },
  { name: 'reporting.general_ledger', schema: GeneralLedgerSchema, handler: generalLedgerHandler },
  { name: 'reporting.trial_balance', schema: TrialBalanceSchema, handler: trialBalanceHandler },
  {
    name: 'reporting.financial_statement_notes',
    schema: FinancialStatementNotesSchema,
    handler: financialStatementNotesHandler,
    description:
      'Get SAK EP notes/CALK baseline, required statement checklist, and compliance warnings. SD §21.2.',
  },
  {
    name: 'reporting.get_daily_summary',
    schema: DailySummarySchema,
    handler: dailySummaryHandler,
    description:
      'Get daily sales summary (gross/net sales, payment breakdown, top products, shift summary). SD §25.5.',
  },
  {
    name: 'reporting.get_donations',
    schema: DonationReportSchema,
    handler: donationReportHandler,
    description:
      'Get donation summary report for a period (daily breakdown: date, amount, tx count, average). SD §25.11.6.',
  },
  {
    name: 'reporting.get_hourly_sales',
    schema: HourlySalesSchema,
    handler: hourlySalesHandler,
    description: 'Get hourly sales breakdown by channel or day (10–22 WIB). SD §25.6.',
  },
  {
    name: 'reporting.get_omzet_harian',
    schema: GetOmzetHarianSchema,
    handler: getOmzetHarianHandler,
    description:
      'Get daily PB1-exclusive omzet with fiscal adjustment. Returns gross, PB1 amount, net omzet, adjustment, fiscal omzet. SoT §21.3b / SD §25.5b.',
  },
] as const;

// --- Handlers ---

async function balanceSheetHandler(input: z.infer<typeof BalanceSheetSchema>, ctx: McpContext) {
  const permitted = await checkPermission(ctx, 'reporting.view', input.location_id);
  if (!permitted) return mcpError('FORBIDDEN', 'Permission denied: reporting.view');

  const params: BalanceSheetInput = {
    asOf: input.as_of,
    locationId: input.location_id,
  };
  const result = await balanceSheet(params, {
    userId: ctx.userId,
    tenantId: ctx.tenantId,
    locationId: input.location_id ?? 'system',
  });

  return serializeResult(result);
}

async function profitLossHandler(input: z.infer<typeof ProfitLossSchema>, ctx: McpContext) {
  const permitted = await checkPermission(ctx, 'reporting.view', input.location_id);
  if (!permitted) return mcpError('FORBIDDEN', 'Permission denied: reporting.view');

  const params: ProfitLossInput = {
    from: input.from,
    to: input.to,
    locationId: input.location_id,
  };
  const result = await profitLoss(params, {
    userId: ctx.userId,
    tenantId: ctx.tenantId,
    locationId: input.location_id ?? 'system',
  });

  return serializeResult(result);
}

async function cashFlowHandler(input: z.infer<typeof CashFlowSchema>, ctx: McpContext) {
  const permitted = await checkPermission(ctx, 'reporting.view', input.location_id);
  if (!permitted) return mcpError('FORBIDDEN', 'Permission denied: reporting.view');

  const params: CashFlowInput = {
    from: input.from,
    to: input.to,
    locationId: input.location_id,
    cashAccountCodes: input.cash_account_codes,
  };
  const result = await cashFlow(params, {
    userId: ctx.userId,
    tenantId: ctx.tenantId,
    locationId: input.location_id ?? 'system',
  });

  return serializeResult(result);
}

async function generalLedgerHandler(input: z.infer<typeof GeneralLedgerSchema>, ctx: McpContext) {
  const permitted = await checkPermission(ctx, 'reporting.view', input.location_id);
  if (!permitted) return mcpError('FORBIDDEN', 'Permission denied: reporting.view');

  // Get account info
  const [account] = await db
    .select({ id: accounts.id, code: accounts.code, name: accounts.name })
    .from(accounts)
    .where(and(eq(accounts.tenantId, ctx.tenantId), eq(accounts.id, input.account_id)))
    .limit(1);

  if (!account) return mcpError('NOT_FOUND', `Account ${input.account_id} not found`);

  const locale = input.locale ?? (ctx.locale as 'id' | 'en' | 'zh');

  // Get journal lines with date range filter
  const lines = await db
    .select({
      id: journalLines.id,
      description: journalLines.description,
      debit: journalLines.debit,
      credit: journalLines.credit,
      partnerId: journalLines.partnerId,
      postingDate: journalEntries.postingDate,
      jeNumber: journalEntries.number,
      jeDescription: journalEntries.description,
    })
    .from(journalLines)
    .innerJoin(journalEntries, eq(journalLines.journalEntryId, journalEntries.id))
    .where(
      and(
        eq(journalLines.accountId, input.account_id),
        eq(journalEntries.tenantId, ctx.tenantId),
        eq(journalEntries.locationId, input.location_id),
        eq(journalEntries.status, 'posted'),
        gte(journalEntries.postingDate, input.from),
        lte(journalEntries.postingDate, input.to),
      ),
    )
    .orderBy(journalEntries.postingDate)
    .limit(input.limit)
    .offset(input.offset);

  const accountName =
    (account.name as Record<string, string>)[locale] ?? (account.name as Record<string, string>).id;

  return mcpSuccess({
    account: {
      id: account.id,
      code: account.code,
      name: accountName,
    },
    from: input.from,
    to: input.to,
    location_id: input.location_id,
    limit: input.limit,
    offset: input.offset,
    lines: lines.map((l) => ({
      id: l.id,
      posting_date: l.postingDate,
      journal_number: l.jeNumber,
      journal_description: l.jeDescription,
      description: l.description,
      debit: l.debit.toString(),
      credit: l.credit.toString(),
      partner_id: l.partnerId,
    })),
  });
}

async function trialBalanceHandler(input: z.infer<typeof TrialBalanceSchema>, ctx: McpContext) {
  const permitted = await checkPermission(ctx, 'reporting.view', input.location_id);
  if (!permitted) return mcpError('FORBIDDEN', 'Permission denied: reporting.view');

  const params: TrialBalanceInput = {
    asOf: input.as_of,
    locationId: input.location_id,
  };
  const result = await trialBalance(params, {
    userId: ctx.userId,
    tenantId: ctx.tenantId,
    locationId: input.location_id ?? 'system',
  });

  return serializeResult(result);
}

async function financialStatementNotesHandler(
  input: z.infer<typeof FinancialStatementNotesSchema>,
  ctx: McpContext,
) {
  const permitted = await checkPermission(ctx, 'reporting.view', input.location_id);
  if (!permitted) return mcpError('FORBIDDEN', 'Permission denied: reporting.view');

  const params: FinancialStatementNotesInput = {
    periodStart: input.period_start,
    periodEnd: input.period_end,
    reportingDate: input.reporting_date,
    locationId: input.location_id,
    firstSakEpFinancialStatements: input.first_sak_ep_financial_statements,
    previousFramework: input.previous_framework,
  };
  const result = await financialStatementNotes(params, {
    userId: ctx.userId,
    tenantId: ctx.tenantId,
    locationId: input.location_id,
  });

  return serializeResult(result);
}

async function dailySummaryHandler(input: z.infer<typeof DailySummarySchema>, ctx: McpContext) {
  const permitted = await checkPermission(ctx, 'reporting.view', input.location_id);
  if (!permitted) return mcpError('FORBIDDEN', 'Permission denied: reporting.view');

  const params: DailySummaryParams = {
    locationId: input.location_id,
    startDate: input.start_date,
    endDate: input.end_date,
    cashierId: input.cashier_id,
  };
  const result = await getDailySummary(params, {
    userId: ctx.userId,
    tenantId: ctx.tenantId,
    locationId: input.location_id,
  });

  return serializeResult(result);
}

async function donationReportHandler(input: z.infer<typeof DonationReportSchema>, ctx: McpContext) {
  const permitted = await checkPermission(ctx, 'reporting.view', input.location_id);
  if (!permitted) return mcpError('FORBIDDEN', 'Permission denied: reporting.view');

  const params: DonationReportParams = {
    startDate: input.start_date,
    endDate: input.end_date,
    locationId: input.location_id,
  };
  const result = await getDonationReport(params, {
    userId: ctx.userId,
    tenantId: ctx.tenantId,
    locationId: input.location_id ?? 'system',
  });

  return serializeResult(result);
}

async function hourlySalesHandler(input: z.infer<typeof HourlySalesSchema>, ctx: McpContext) {
  const permitted = await checkPermission(ctx, 'reporting.view', input.location_id);
  if (!permitted) return mcpError('FORBIDDEN', 'Permission denied: reporting.view');

  const params: HourlySalesParams = {
    startDate: input.start_date,
    endDate: input.end_date,
    locationId: input.location_id ?? 'system',
    groupBy: input.group_by,
  };
  const result = await getHourlySales(params, {
    userId: ctx.userId,
    tenantId: ctx.tenantId,
    locationId: input.location_id ?? 'system',
  });

  return serializeResult(result);
}
