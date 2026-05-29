import { db } from '@erp/db';
import { journalEntries, journalLines, accounts, accountingPeriods } from '@erp/db/schema/accounting';
import { AppError } from '@erp/shared/errors';
import { type Result, err, ok } from '@erp/shared/result';
import type { AuditContext } from '@erp/shared/types';
import { eq, and, gte, lte, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { requirePermission } from '../iam';

export const GetProfitAndLossInputSchema = z.object({
  locationId: z.string().optional(), // If not provided, returns consolidated
  startDate: z.string().date(),
  endDate: z.string().date(),
});

export type GetProfitAndLossInput = z.infer<typeof GetProfitAndLossInputSchema>;

export interface ProfitAndLossResult {
  revenue: Record<string, bigint>; // Account ID -> Balance
  cogs: Record<string, bigint>;
  expenses: Record<string, bigint>;
  totalRevenue: bigint;
  totalCogs: bigint;
  grossProfit: bigint;
  totalExpenses: bigint;
  netProfit: bigint;
}

export async function getProfitAndLoss(
  input: GetProfitAndLossInput,
  ctx: AuditContext,
): Promise<Result<ProfitAndLossResult>> {
  const parsed = GetProfitAndLossInputSchema.safeParse(input);
  if (!parsed.success) return err(AppError.validation('common.errors.validationFailed', { issues: parsed.error.issues }));
  const { locationId, startDate, endDate } = parsed.data;

  // View permission is needed to view reporting.
  const permCheck = await requirePermission(ctx.userId, 'accounting.reports', locationId ? { locationId } : undefined);
  if (!permCheck.ok) return permCheck;

  // 1. Fetch relevant accounts (income, cogs, expense)
  const relevantAccounts = await db
    .select({ id: accounts.id, type: accounts.type, normalBalance: accounts.normalBalance })
    .from(accounts)
    .where(
      and(
        eq(accounts.tenantId, ctx.tenantId),
        inArray(accounts.type, ['income', 'cogs', 'expense'])
      )
    );

  const accountMap = new Map(relevantAccounts.map((a) => [a.id, a]));

  // 2. Fetch journal lines in date range
  const journalJoinConditions = locationId
    ? and(
        eq(journalEntries.id, journalLines.journalEntryId),
        eq(journalEntries.tenantId, ctx.tenantId),
        eq(journalEntries.status, 'posted'),
        gte(journalEntries.postingDate, startDate),
        lte(journalEntries.postingDate, endDate),
        eq(journalLines.locationId, locationId) // Filter by location at line level
      )
    : and(
        eq(journalEntries.id, journalLines.journalEntryId),
        eq(journalEntries.tenantId, ctx.tenantId),
        eq(journalEntries.status, 'posted'),
        gte(journalEntries.postingDate, startDate),
        lte(journalEntries.postingDate, endDate)
      );

  const lines = await db
    .select({
      accountId: journalLines.accountId,
      debit: journalLines.debit,
      credit: journalLines.credit,
    })
    .from(journalLines)
    .innerJoin(journalEntries, journalJoinConditions);

  // 3. Aggregate balances
  const result: ProfitAndLossResult = {
    revenue: {},
    cogs: {},
    expenses: {},
    totalRevenue: 0n,
    totalCogs: 0n,
    grossProfit: 0n,
    totalExpenses: 0n,
    netProfit: 0n,
  };

  for (const line of lines) {
    const account = accountMap.get(line.accountId);
    if (!account) continue;

    // Calculate balance based on normal balance
    // normalBalance 'credit' means credit increases balance, debit decreases.
    const debit = BigInt(line.debit);
    const credit = BigInt(line.credit);
    const netChange = account.normalBalance === 'credit' ? credit - debit : debit - credit;

    if (account.type === 'income') {
      result.revenue[account.id] = (result.revenue[account.id] || 0n) + netChange;
      result.totalRevenue += netChange;
    } else if (account.type === 'cogs') {
      result.cogs[account.id] = (result.cogs[account.id] || 0n) + netChange;
      result.totalCogs += netChange;
    } else if (account.type === 'expense') {
      result.expenses[account.id] = (result.expenses[account.id] || 0n) + netChange;
      result.totalExpenses += netChange;
    }
  }

  result.grossProfit = result.totalRevenue - result.totalCogs;
  result.netProfit = result.grossProfit - result.totalExpenses;

  return ok(result);
}
