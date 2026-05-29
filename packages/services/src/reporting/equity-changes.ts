/**
 * reporting.equityChanges — SD §21.2
 *
 * Generates a Statement of Changes in Equity (Laporan Perubahan Ekuitas - SAK ETAP)
 * for a given date range.
 *
 * Permission: accounting.view / reporting.consolidated
 */

import { AppError } from '@erp/shared/errors';
import { type Result, err, ok, tryCatch } from '@erp/shared/result';
import type { AuditContext } from '@erp/shared/types';
import { requirePermission } from '../iam';
import { type TrialBalanceLine, trialBalance } from './trial-balance';
import { profitLoss } from './profit-loss';
import dayjs from 'dayjs';

export interface EquityChangesInput {
  startDate: string;
  endDate: string;
  locationId?: string;
}

export interface EquityChangesResult {
  startDate: string;
  endDate: string;
  locationId: string | null;

  // Components
  beginningCapital: bigint;
  beginningRetainedEarnings: bigint;
  totalBeginningEquity: bigint;

  netIncome: bigint;
  dividends: bigint;
  additionalCapital: bigint;

  endingCapital: bigint;
  endingRetainedEarnings: bigint;
  totalEndingEquity: bigint;
}

export async function equityChanges(
  input: EquityChangesInput,
  ctx: AuditContext,
): Promise<Result<EquityChangesResult>> {
  const permCheck = await requirePermission(
    ctx.userId,
    input.locationId ? 'accounting.view' : 'reporting.consolidated',
    input.locationId ? { locationId: input.locationId } : undefined,
  );
  if (!permCheck.ok) return permCheck;

  return tryCatch(
    async () => {
      // 1. Calculate beginning balance (as of startDate - 1 day)
      const priorDate = dayjs(input.startDate).subtract(1, 'day').format('YYYY-MM-DD');
      const tbStartRes = await trialBalance({ asOf: priorDate, locationId: input.locationId }, ctx);
      if (!tbStartRes.ok) throw tbStartRes.error;
      const tbStart = tbStartRes.value;

      let beginningCapital = 0n;
      let beginningRetainedEarnings = 0n;
      let historicalIncome = 0n;
      let beginningDividends = 0n;

      for (const line of tbStart.lines) {
        if (line.accountType === 'equity') {
          // balance here is based on normal balance.
          // Modal (credit normal) -> balance is credit - debit
          // Dividen (debit normal) -> balance is debit - credit
          if (line.accountCode === '3-1100') beginningCapital += line.balance;
          else if (line.accountCode === '3-1200') beginningDividends += line.balance; 
          else if (line.accountCode === '3-1300' || line.accountCode === '3-1400') {
            beginningRetainedEarnings += line.balance;
          }
        } else if (['income', 'expense', 'cogs'].includes(line.accountType)) {
          // income is credit normal (positive balance)
          // expense is debit normal (positive balance)
          if (line.accountType === 'income') historicalIncome += line.balance;
          else historicalIncome -= line.balance;
        }
      }
      
      // Retained earnings includes all unclosed historical net income
      beginningRetainedEarnings += historicalIncome;
      // Subtract dividends (since they reduce equity, but dividends are debit normal so their balance is positive)
      beginningRetainedEarnings -= beginningDividends;

      const totalBeginningEquity = beginningCapital + beginningRetainedEarnings;

      // 2. Get current period trial balance to find changes
      const tbEndRes = await trialBalance({ asOf: input.endDate, locationId: input.locationId }, ctx);
      if (!tbEndRes.ok) throw tbEndRes.error;
      const tbEnd = tbEndRes.value;

      let endingCapital = 0n;
      let endingDividends = 0n;

      for (const line of tbEnd.lines) {
        if (line.accountCode === '3-1100') endingCapital += line.balance;
        else if (line.accountCode === '3-1200') endingDividends += line.balance;
      }

      const additionalCapital = endingCapital - beginningCapital;
      const dividends = endingDividends - beginningDividends;

      // 3. Get net income for the current period
      const plRes = await profitLoss({ startDate: input.startDate, endDate: input.endDate, locationId: input.locationId }, ctx);
      if (!plRes.ok) throw plRes.error;
      const netIncome = plRes.value.netIncome;

      const endingRetainedEarnings = beginningRetainedEarnings + netIncome - dividends;
      const totalEndingEquity = endingCapital + endingRetainedEarnings;

      return {
        startDate: input.startDate,
        endDate: input.endDate,
        locationId: input.locationId ?? null,
        beginningCapital,
        beginningRetainedEarnings,
        totalBeginningEquity,
        netIncome,
        dividends,
        additionalCapital,
        endingCapital,
        endingRetainedEarnings,
        totalEndingEquity,
      };
    },
    (e) => AppError.internal('reporting.equityChanges.failed', e),
  );
}
