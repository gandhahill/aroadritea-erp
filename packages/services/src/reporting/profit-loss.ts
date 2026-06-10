/**
 * reporting.profitLoss — SD §21.2
 *
 * Generates a Profit & Loss statement (Laba Rugi) for a date range.
 * Sections: Revenue, COGS, Gross Profit, Operating Expenses, Net Income.
 *
 * Permission: accounting.view
 */

import { db } from '@erp/db';
import { accounts, journalEntries, journalLines } from '@erp/db/schema/accounting';
import { AppError } from '@erp/shared/errors';
import { type Result, ok, tryCatch } from '@erp/shared/result';
import type { AuditContext } from '@erp/shared/types';
import { and, eq, gte, lte, sql } from 'drizzle-orm';
import { requirePermission } from '../iam';

// --- Types ---

export interface ProfitLossInput {
  /** Start date (inclusive). Format: YYYY-MM-DD. */
  from: string;
  /** End date (inclusive). Format: YYYY-MM-DD. */
  to: string;
  /** Optional location filter. NULL = consolidated. */
  locationId?: string;
}

export interface ProfitLossLine {
  accountCode: string;
  accountName: Record<string, string>;
  accountType: string;
  accountSubtype: string;
  balance: bigint;
}

export interface ProfitLossSection {
  label: string;
  lines: ProfitLossLine[];
  total: bigint;
}

export interface ProfitLossResult {
  from: string;
  to: string;
  locationId: string | null;
  revenue: ProfitLossSection;
  cogs: ProfitLossSection;
  grossProfit: bigint;
  /** Operating expenses only (excludes finance costs and income tax). */
  expenses: ProfitLossSection;
  /** Operating profit = grossProfit - operating expenses (SAK EP Bab 5). */
  operatingProfit: bigint;
  /** Other income (account subtype `other_income`, e.g. interest income). */
  otherIncome: ProfitLossSection;
  /** Finance costs (account subtype `non_operating`, e.g. interest/bank fees). */
  financeCosts: ProfitLossSection;
  /** Income tax expense (account subtype `income_tax`). */
  incomeTaxExpense: ProfitLossSection;
  /** Profit before income tax. */
  profitBeforeTax: bigint;
  netIncome: bigint;
  isPreliminary: boolean;
}

// --- Service function ---

export async function profitLoss(
  input: ProfitLossInput,
  ctx: AuditContext,
): Promise<Result<ProfitLossResult>> {
  const permCheck = await requirePermission(
    ctx.userId,
    input.locationId ? 'accounting.view' : 'reporting.consolidated',
    input.locationId ? { locationId: input.locationId } : undefined,
  );
  if (!permCheck.ok) return permCheck;

  return tryCatch(
    async () => {
      // Build conditions for posted journals in date range
      const jeConditions = [
        eq(journalEntries.tenantId, ctx.tenantId),
        eq(journalEntries.status, 'posted'),
        gte(journalEntries.postingDate, input.from),
        lte(journalEntries.postingDate, input.to),
      ];

      const lineConditions: ReturnType<typeof eq>[] = [];
      if (input.locationId) {
        lineConditions.push(eq(journalLines.locationId, input.locationId));
      }

      // Aggregate debit/credit per account for P&L account types
      const rows = await db
        .select({
          accountId: journalLines.accountId,
          totalDebit: sql<string>`COALESCE(SUM(${journalLines.debit}), 0)`,
          totalCredit: sql<string>`COALESCE(SUM(${journalLines.credit}), 0)`,
        })
        .from(journalLines)
        .innerJoin(journalEntries, eq(journalLines.journalEntryId, journalEntries.id))
        .where(and(...jeConditions, ...lineConditions))
        .groupBy(journalLines.accountId);

      // Fetch account details (only P&L types)
      const acctRows = await db
        .select({
          id: accounts.id,
          code: accounts.code,
          name: accounts.name,
          type: accounts.type,
          subtype: accounts.subtype,
          normalBalance: accounts.normalBalance,
        })
        .from(accounts)
        .where(eq(accounts.tenantId, ctx.tenantId));

      const acctMap = new Map(acctRows.map((a) => [a.id, a]));

      // Build lines with balances
      const allLines: ProfitLossLine[] = [];

      for (const row of rows) {
        const acct = acctMap.get(row.accountId);
        if (!acct) continue;
        // Only include P&L account types
        if (!['income', 'cogs', 'expense'].includes(acct.type)) continue;

        const totalDebit = BigInt(row.totalDebit);
        const totalCredit = BigInt(row.totalCredit);

        // Balance: for income (credit-normal) = credit - debit
        //          for cogs/expense (debit-normal) = debit - credit
        const balance =
          acct.normalBalance === 'credit' ? totalCredit - totalDebit : totalDebit - totalCredit;

        allLines.push({
          accountCode: acct.code,
          accountName: acct.name as Record<string, string>,
          accountType: acct.type,
          accountSubtype: acct.subtype ?? '',
          balance,
        });
      }

      // Sort by account code
      allLines.sort((a, b) => a.accountCode.localeCompare(b.accountCode));

      // Group into sections per SAK EP Bab 5 (function-of-expense layout).
      // Operating revenue excludes `other_income` (e.g. interest income).
      const revenue = buildSection(
        'Revenue',
        allLines,
        (l) => l.accountType === 'income' && l.accountSubtype !== 'other_income',
      );
      const cogs = buildSection('Cost of Goods Sold', allLines, (l) => l.accountType === 'cogs');
      // Operating expenses = expense accounts that are NOT finance costs or income
      // tax. Unknown/empty subtypes default to operating so nothing is dropped.
      const expenses = buildSection(
        'Operating Expenses',
        allLines,
        (l) =>
          l.accountType === 'expense' &&
          l.accountSubtype !== 'non_operating' &&
          l.accountSubtype !== 'income_tax',
      );
      const otherIncome = buildSection(
        'Other Income',
        allLines,
        (l) => l.accountType === 'income' && l.accountSubtype === 'other_income',
      );
      const financeCosts = buildSection(
        'Finance Costs',
        allLines,
        (l) => l.accountType === 'expense' && l.accountSubtype === 'non_operating',
      );
      const incomeTaxExpense = buildSection(
        'Income Tax Expense',
        allLines,
        (l) => l.accountType === 'expense' && l.accountSubtype === 'income_tax',
      );

      const grossProfit = revenue.total - cogs.total;
      const operatingProfit = grossProfit - expenses.total;
      const profitBeforeTax = operatingProfit + otherIncome.total - financeCosts.total;
      const netIncome = profitBeforeTax - incomeTaxExpense.total;

      return {
        from: input.from,
        to: input.to,
        locationId: input.locationId ?? null,
        revenue,
        cogs,
        grossProfit,
        expenses,
        operatingProfit,
        otherIncome,
        financeCosts,
        incomeTaxExpense,
        profitBeforeTax,
        netIncome,
        isPreliminary: false,
      };
    },
    (e) => AppError.internal('reporting.profitLoss.failed', e),
  );
}

// --- Helpers ---

function buildSection(
  label: string,
  allLines: ProfitLossLine[],
  predicate: (line: ProfitLossLine) => boolean,
): ProfitLossSection {
  const lines = allLines.filter(predicate);
  const total = lines.reduce((sum, l) => sum + l.balance, 0n);
  return { label, lines, total };
}
