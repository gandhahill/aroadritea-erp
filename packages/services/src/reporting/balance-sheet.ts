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
  /** SAK EP Bab 4: current vs non-current asset split (subset of `assets`). */
  currentAssets: BalanceSheetSection;
  nonCurrentAssets: BalanceSheetSection;
  liabilities: BalanceSheetSection;
  /** SAK EP Bab 4: current vs non-current liability split (subset of `liabilities`). */
  currentLiabilities: BalanceSheetSection;
  nonCurrentLiabilities: BalanceSheetSection;
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
    input.locationId ? 'accounting.view' : 'reporting.consolidated',
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
      // Assets are debit-normal; contra-assets (e.g. accumulated depreciation)
      // are credit-normal and must be negated to reduce the asset total.
      const assets = filterSection(tb.lines, ['asset'], 'Assets', 'debit');
      const liabilities = filterSection(tb.lines, ['liability'], 'Liabilities', 'credit');
      const equity = filterSection(tb.lines, ['equity'], 'Equity', 'credit');

      // SAK EP Bab 4: present current vs non-current. Only `current_asset` /
      // `current_liability` subtypes are current; everything else (fixed_asset,
      // contra_asset, long_term_liability, …) is non-current. Note: a
      // contra-asset allowance for doubtful debts is technically a current
      // contra-account, but accumulated depreciation dominates this F&B COA, so
      // contra_asset defaults to non-current here.
      const currentAssets = filterSection(
        tb.lines,
        ['asset'],
        'Current Assets',
        'debit',
        (l) => l.accountSubtype === 'current_asset',
      );
      const nonCurrentAssets = filterSection(
        tb.lines,
        ['asset'],
        'Non-Current Assets',
        'debit',
        (l) => l.accountSubtype !== 'current_asset',
      );
      const currentLiabilities = filterSection(
        tb.lines,
        ['liability'],
        'Current Liabilities',
        'credit',
        (l) => l.accountSubtype === 'current_liability',
      );
      const nonCurrentLiabilities = filterSection(
        tb.lines,
        ['liability'],
        'Non-Current Liabilities',
        'credit',
        (l) => l.accountSubtype !== 'current_liability',
      );

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
        currentAssets,
        nonCurrentAssets,
        liabilities,
        currentLiabilities,
        nonCurrentLiabilities,
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

/**
 * Filter trial balance lines into a balance sheet section.
 *
 * The sectionNormal parameter indicates the expected normal balance for the
 * section: 'debit' for assets, 'credit' for liabilities and equity.
 *
 * Contra accounts (e.g. Akumulasi Penyusutan is an asset with credit-normal)
 * have their balance negated so they correctly REDUCE the section total.
 * Without this, contra-assets would be added to the asset total instead of
 * subtracted, causing an imbalance equal to 2× the contra balance.
 */
function filterSection(
  lines: TrialBalanceLine[],
  types: string[],
  label: string,
  sectionNormal: 'debit' | 'credit' = 'debit',
  predicate?: (line: TrialBalanceLine) => boolean,
): BalanceSheetSection {
  const filtered = lines.filter(
    (l) => types.includes(l.accountType) && (predicate ? predicate(l) : true),
  );
  const accounts = filtered.map((l) => {
    // If the account's normal balance direction differs from the section's,
    // negate it (e.g. contra-asset in the asset section).
    const adjustedBalance = l.normalBalance === sectionNormal ? l.balance : -l.balance;
    return {
      accountCode: l.accountCode,
      accountName: l.accountName,
      balance: adjustedBalance,
    };
  });
  const total = accounts.reduce((sum, a) => sum + a.balance, 0n);
  return { label, accounts, total };
}

function sumBalances(lines: TrialBalanceLine[], types: string[]): bigint {
  return lines.filter((l) => types.includes(l.accountType)).reduce((sum, l) => sum + l.balance, 0n);
}
