/**
 * reporting.balanceSheet — SD §21.2
 *
 * Generates a Balance Sheet (Neraca) as of a given date.
 * Groups accounts into Assets, Liabilities, and Equity sections.
 * Accounting equation: Assets = Liabilities + Equity
 *
 * Permission: accounting.view
 */

import { AppError } from '@erp/shared/errors';
import { type Result, err, ok, tryCatch } from '@erp/shared/result';
import type { AuditContext } from '@erp/shared/types';
import { requirePermission } from '../iam';
import { type TrialBalanceLine, trialBalance } from './trial-balance';

// --- Types ---

export interface BalanceSheetInput {
  /** As-of date (inclusive). Format: YYYY-MM-DD. */
  asOf: string;
  /** Optional location filter. NULL = consolidated. */
  locationId?: string;
}

export interface BalanceSheetSection {
  label: string;
  accounts: Array<{
    accountCode: string;
    accountName: Record<string, string>;
    balance: bigint;
  }>;
  total: bigint;
}

export interface BalanceSheetResult {
  asOf: string;
  locationId: string | null;
  assets: BalanceSheetSection;
  liabilities: BalanceSheetSection;
  equity: BalanceSheetSection;
  /** Retained earnings from income - cogs - expense (current period P&L). */
  retainedEarnings: bigint;
  /** Total equity including retained earnings. */
  totalEquityWithRetained: bigint;
  /** Liabilities + Equity (should equal Assets). */
  totalLiabilitiesAndEquity: bigint;
  /** Whether the balance sheet is balanced (Assets = L + E). */
  isBalanced: boolean;
  isPreliminary: boolean;
}

// --- Service function ---

export async function balanceSheet(
  input: BalanceSheetInput,
  ctx: AuditContext,
): Promise<Result<BalanceSheetResult>> {
  const permCheck = await requirePermission(
    ctx.userId,
    'accounting.view',
    input.locationId ? { locationId: input.locationId } : undefined,
  );
  if (!permCheck.ok) return permCheck;

  return tryCatch(
    async () => {
      // Get trial balance first
      const tbResult = await trialBalance({ asOf: input.asOf, locationId: input.locationId }, ctx);

      if (!tbResult.ok) throw tbResult.error;
      const tb = tbResult.value;

      // Classify accounts into sections
      const assets = filterSection(tb.lines, ['asset'], 'Assets');
      const liabilities = filterSection(tb.lines, ['liability'], 'Liabilities');
      const equity = filterSection(tb.lines, ['equity'], 'Equity');

      // Calculate retained earnings = income - cogs - expense
      const incomeTotal = sumBalances(tb.lines, ['income']);
      const cogsTotal = sumBalances(tb.lines, ['cogs']);
      const expenseTotal = sumBalances(tb.lines, ['expense']);
      const retainedEarnings = incomeTotal - cogsTotal - expenseTotal;

      const totalEquityWithRetained = equity.total + retainedEarnings;
      const totalLiabilitiesAndEquity = liabilities.total + totalEquityWithRetained;

      return {
        asOf: input.asOf,
        locationId: input.locationId ?? null,
        assets,
        liabilities,
        equity,
        retainedEarnings,
        totalEquityWithRetained,
        totalLiabilitiesAndEquity,
        isBalanced: assets.total === totalLiabilitiesAndEquity,
        isPreliminary: tb.isPreliminary,
      };
    },
    (e) => AppError.internal('reporting.balanceSheet.failed', e),
  );
}

// --- Helpers ---

function filterSection(
  lines: TrialBalanceLine[],
  types: string[],
  label: string,
): BalanceSheetSection {
  const filtered = lines.filter((l) => types.includes(l.accountType));
  const accounts = filtered.map((l) => ({
    accountCode: l.accountCode,
    accountName: l.accountName,
    balance: l.balance,
  }));
  const total = filtered.reduce((sum, l) => sum + l.balance, 0n);
  return { label, accounts, total };
}

function sumBalances(lines: TrialBalanceLine[], types: string[]): bigint {
  return lines.filter((l) => types.includes(l.accountType)).reduce((sum, l) => sum + l.balance, 0n);
}
