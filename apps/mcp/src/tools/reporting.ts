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

import { z } from 'zod';
import { db } from '@erp/db';
import { accounts, journalEntries, journalLines } from '@erp/db/schema/accounting';
import { eq, and, gte, lte } from 'drizzle-orm';
import { balanceSheet, trialBalance, profitLoss, getDailySummary, getDonationReport, getHourlySales } from '@erp/services/reporting';
import type { BalanceSheetInput, TrialBalanceInput, ProfitLossInput, DailySummaryParams, DonationReportParams, HourlySalesParams } from '@erp/services/reporting';
import { can } from '@erp/services/iam';
import { mcpError, mcpSuccess, serializeResult } from '../helpers';
import type { McpContext } from '../context';
import { getOmzetHarianHandler, GetOmzetHarianSchema } from './reporting-omzet';

async function checkPermission(ctx: McpContext, permission: string) {
  return can(ctx.userId, permission);
}

// --- Schemas ---

export const BalanceSheetSchema = z.object({
  as_of: z.string(),
  location_id: z.string().optional(),
  locale: z.enum(['id', 'en', 'zh']).optional().default('id'),
});

export const ProfitLossSchema = z.object({
  from: z.string(),
  to: z.string(),
  location_id: z.string().optional(),
  locale: z.enum(['id', 'en', 'zh']).optional().default('id'),
});

export const CashFlowSchema = z.object({
  from: z.string(),
  to: z.string(),
  locale: z.enum(['id', 'en', 'zh']).optional().default('id'),
});

export const GeneralLedgerSchema = z.object({
  account_id: z.string(),
  from: z.string(),
  to: z.string(),
  locale: z.enum(['id', 'en', 'zh']).optional().default('id'),
});

export const TrialBalanceSchema = z.object({
  as_of: z.string(),
  location_id: z.string().optional(),
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
  location_id: z.string().optional(),
});

export const HourlySalesSchema = z.object({
  start_date: z.string(),
  end_date: z.string(),
  location_id: z.string().optional(),
  group_by: z.enum(['channel', 'day']).optional().default('channel'),
});

// --- Tool list ---

export const reportingTools = [
  { name: 'reporting.balance_sheet', schema: BalanceSheetSchema, handler: balanceSheetHandler },
  { name: 'reporting.profit_loss', schema: ProfitLossSchema, handler: profitLossHandler },
  { name: 'reporting.cash_flow', schema: CashFlowSchema, handler: cashFlowHandler },
  { name: 'reporting.general_ledger', schema: GeneralLedgerSchema, handler: generalLedgerHandler },
  { name: 'reporting.trial_balance', schema: TrialBalanceSchema, handler: trialBalanceHandler },
  { name: 'reporting.get_daily_summary', schema: DailySummarySchema, handler: dailySummaryHandler, description: 'Get daily sales summary (gross/net sales, payment breakdown, top products, shift summary). SD §25.5.' },
  { name: 'reporting.get_donations', schema: DonationReportSchema, handler: donationReportHandler, description: 'Get donation summary report for a period (daily breakdown: date, amount, tx count, average). SD §25.11.6.' },
  { name: 'reporting.get_hourly_sales', schema: HourlySalesSchema, handler: hourlySalesHandler, description: 'Get hourly sales breakdown by channel or day (10–22 WIB). SD §25.6.' },
  { name: 'reporting.get_omzet_harian', schema: GetOmzetHarianSchema, handler: getOmzetHarianHandler, description: 'Get daily PB1-exclusive omzet with fiscal adjustment. Returns gross, PB1 amount, net omzet, adjustment, fiscal omzet. SoT §21.3b / SD §25.5b.' },
] as const;

// --- Handlers ---

async function balanceSheetHandler(input: z.infer<typeof BalanceSheetSchema>, ctx: McpContext) {
  const permitted = await checkPermission(ctx, 'reporting.view');
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
  const permitted = await checkPermission(ctx, 'reporting.view');
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
  const permitted = await checkPermission(ctx, 'reporting.view');
  if (!permitted) return mcpError('FORBIDDEN', 'Permission denied: reporting.view');

  // Cash Flow Statement: simplified indirect method
  // Actual implementation would use indirect method: Net Income +/- non-cash items +/- working capital changes
  return mcpSuccess({
    from: input.from,
    to: input.to,
    locale: input.locale,
    note: 'Cash Flow Statement. Full implementation requires working capital tracking per period. Currently returns placeholder.',
  });
}

async function generalLedgerHandler(input: z.infer<typeof GeneralLedgerSchema>, ctx: McpContext) {
  const permitted = await checkPermission(ctx, 'reporting.view');
  if (!permitted) return mcpError('FORBIDDEN', 'Permission denied: reporting.view');

  // Get account info
  const [account] = await db
    .select({ id: accounts.id, code: accounts.code, name: accounts.name })
    .from(accounts)
    .where(eq(accounts.id, input.account_id))
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
        eq(journalEntries.status, 'posted'),
        gte(journalEntries.postingDate, input.from),
        lte(journalEntries.postingDate, input.to),
      ),
    )
    .orderBy(journalEntries.postingDate);

  const accountName = (account.name as Record<string, string>)[locale] ?? (account.name as Record<string, string>)['id'];

  return mcpSuccess({
    account: {
      id: account.id,
      code: account.code,
      name: accountName,
    },
    from: input.from,
    to: input.to,
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
  const permitted = await checkPermission(ctx, 'reporting.view');
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

async function dailySummaryHandler(input: z.infer<typeof DailySummarySchema>, ctx: McpContext) {
  const permitted = await checkPermission(ctx, 'reporting.view');
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
  const permitted = await checkPermission(ctx, 'reporting.view');
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
  const permitted = await checkPermission(ctx, 'reporting.view');
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
