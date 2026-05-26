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
  expenses: ProfitLossSection;
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
          balance,
        });
      }

      // Sort by account code
      allLines.sort((a, b) => a.accountCode.localeCompare(b.accountCode));

      // Group into sections
      const revenue = buildSection('Revenue', allLines, 'income');
      const cogs = buildSection('Cost of Goods Sold', allLines, 'cogs');
      const expenses = buildSection('Operating Expenses', allLines, 'expense');

      const grossProfit = revenue.total - cogs.total;
      const netIncome = grossProfit - expenses.total;

      return {
        from: input.from,
        to: input.to,
        locationId: input.locationId ?? null,
        revenue,
        cogs,
        grossProfit,
        expenses,
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
  accountType: string,
): ProfitLossSection {
  const lines = allLines.filter((l) => l.accountType === accountType);
  const total = lines.reduce((sum, l) => sum + l.balance, 0n);
  return { label, lines, total };
}
