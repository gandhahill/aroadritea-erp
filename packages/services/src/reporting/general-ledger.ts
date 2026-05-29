/**
 * reporting.generalLedger — SD §21.2
 *
 * Generates a General Ledger (Buku Besar) for a specific account,
 * showing beginning balance, transaction lines, and ending balance.
 *
 * Permission: accounting.view
 */

import { AppError } from '@erp/shared/errors';
import { type Result, err, ok, tryCatch } from '@erp/shared/result';
import type { AuditContext } from '@erp/shared/types';
import { requirePermission } from '../iam';
import { db, eq, and, lte, gte, sql, desc, asc, lt } from '@erp/db';
import { journalEntries, journalLines, accounts } from '@erp/db/schema/accounting';
import dayjs from 'dayjs';

export interface GeneralLedgerInput {
  accountId: string;
  startDate: string;
  endDate: string;
  locationId?: string;
}

export interface GeneralLedgerLine {
  journalEntryId: string;
  journalNumber: string;
  postingDate: string;
  description: string | null;
  debit: bigint;
  credit: bigint;
  balance: bigint;
}

export interface GeneralLedgerResult {
  accountId: string;
  accountCode: string;
  accountName: Record<string, string>;
  accountType: string;
  normalBalance: string;
  startDate: string;
  endDate: string;
  locationId: string | null;

  beginningBalance: bigint;
  lines: GeneralLedgerLine[];
  endingBalance: bigint;

  // Comparative period (e.g. same dates in previous month/year depending on range)
  comparativeBeginningBalance: bigint;
  comparativeEndingBalance: bigint;
}

export async function getGeneralLedger(
  input: GeneralLedgerInput,
  ctx: AuditContext,
): Promise<Result<GeneralLedgerResult>> {
  const permCheck = await requirePermission(
    ctx.userId,
    input.locationId ? 'accounting.view' : 'reporting.consolidated',
    input.locationId ? { locationId: input.locationId } : undefined,
  );
  if (!permCheck.ok) return permCheck;

  return tryCatch(
    async () => {
      // Fetch account details
      const [account] = await db
        .select()
        .from(accounts)
        .where(and(eq(accounts.id, input.accountId), eq(accounts.tenantId, ctx.tenantId)))
        .limit(1);

      if (!account) throw AppError.notFound('reporting.generalLedger.accountNotFound');

      const isDebitNormal = account.normalBalance === 'debit';

      // Build conditions for posted journals
      const baseJeConditions = [
        eq(journalEntries.tenantId, ctx.tenantId),
        eq(journalEntries.status, 'posted'),
      ];

      const lineConditions: ReturnType<typeof eq>[] = [
        eq(journalLines.accountId, input.accountId)
      ];
      if (input.locationId) {
        lineConditions.push(eq(journalLines.locationId, input.locationId));
      }

      // 1. Calculate Beginning Balance (before startDate)
      const beginningRows = await db
        .select({
          totalDebit: sql<string>`COALESCE(SUM(${journalLines.debit}), 0)`,
          totalCredit: sql<string>`COALESCE(SUM(${journalLines.credit}), 0)`,
        })
        .from(journalLines)
        .innerJoin(journalEntries, eq(journalLines.journalEntryId, journalEntries.id))
        .where(and(...baseJeConditions, lt(journalEntries.postingDate, input.startDate), ...lineConditions));

      const begDebit = BigInt(beginningRows[0]?.totalDebit || 0n);
      const begCredit = BigInt(beginningRows[0]?.totalCredit || 0n);
      const beginningBalance = isDebitNormal ? begDebit - begCredit : begCredit - begDebit;

      // 2. Fetch Journal Lines for the period
      const currentRows = await db
        .select({
          journalEntryId: journalEntries.id,
          journalNumber: journalEntries.number,
          postingDate: journalEntries.postingDate,
          description: journalLines.description,
          debit: journalLines.debit,
          credit: journalLines.credit,
        })
        .from(journalLines)
        .innerJoin(journalEntries, eq(journalLines.journalEntryId, journalEntries.id))
        .where(
          and(
            ...baseJeConditions,
            gte(journalEntries.postingDate, input.startDate),
            lte(journalEntries.postingDate, input.endDate),
            ...lineConditions
          )
        )
        .orderBy(asc(journalEntries.postingDate), asc(journalEntries.createdAt));

      let runningBalance = beginningBalance;
      const lines: GeneralLedgerLine[] = [];

      for (const row of currentRows) {
        const d = BigInt(row.debit);
        const c = BigInt(row.credit);
        
        if (isDebitNormal) {
          runningBalance = runningBalance + d - c;
        } else {
          runningBalance = runningBalance + c - d;
        }

        lines.push({
          journalEntryId: row.journalEntryId,
          journalNumber: row.journalNumber,
          postingDate: row.postingDate,
          description: row.description,
          debit: d,
          credit: c,
          balance: runningBalance,
        });
      }

      const endingBalance = runningBalance;

      // 3. Comparative Period (Previous month/year depending on length)
      // For simplicity, let's just do previous year same period (e.g., Year over Year comparative)
      // or previous month if it's less than 31 days.
      const start = dayjs(input.startDate);
      const end = dayjs(input.endDate);
      const days = end.diff(start, 'day');
      
      let compStart, compEnd;
      if (days > 31) {
        // Previous year
        compStart = start.subtract(1, 'year').format('YYYY-MM-DD');
        compEnd = end.subtract(1, 'year').format('YYYY-MM-DD');
      } else {
        // Previous month
        compStart = start.subtract(1, 'month').format('YYYY-MM-DD');
        compEnd = end.subtract(1, 'month').format('YYYY-MM-DD');
      }

      const compBeginningRows = await db
        .select({
          totalDebit: sql<string>`COALESCE(SUM(${journalLines.debit}), 0)`,
          totalCredit: sql<string>`COALESCE(SUM(${journalLines.credit}), 0)`,
        })
        .from(journalLines)
        .innerJoin(journalEntries, eq(journalLines.journalEntryId, journalEntries.id))
        .where(and(...baseJeConditions, lt(journalEntries.postingDate, compStart), ...lineConditions));

      const compBegDebit = BigInt(compBeginningRows[0]?.totalDebit || 0n);
      const compBegCredit = BigInt(compBeginningRows[0]?.totalCredit || 0n);
      const comparativeBeginningBalance = isDebitNormal ? compBegDebit - compBegCredit : compBegCredit - compBegDebit;

      const compCurrentRows = await db
        .select({
          totalDebit: sql<string>`COALESCE(SUM(${journalLines.debit}), 0)`,
          totalCredit: sql<string>`COALESCE(SUM(${journalLines.credit}), 0)`,
        })
        .from(journalLines)
        .innerJoin(journalEntries, eq(journalLines.journalEntryId, journalEntries.id))
        .where(
          and(
            ...baseJeConditions,
            gte(journalEntries.postingDate, compStart),
            lte(journalEntries.postingDate, compEnd),
            ...lineConditions
          )
        );

      const compCurrDebit = BigInt(compCurrentRows[0]?.totalDebit || 0n);
      const compCurrCredit = BigInt(compCurrentRows[0]?.totalCredit || 0n);
      const compNetChange = isDebitNormal ? compCurrDebit - compCurrCredit : compCurrCredit - compCurrDebit;
      
      const comparativeEndingBalance = comparativeBeginningBalance + compNetChange;

      return {
        accountId: account.id,
        accountCode: account.code,
        accountName: account.name as Record<string, string>,
        accountType: account.type,
        normalBalance: account.normalBalance,
        startDate: input.startDate,
        endDate: input.endDate,
        locationId: input.locationId ?? null,
        beginningBalance,
        lines,
        endingBalance,
        comparativeBeginningBalance,
        comparativeEndingBalance,
      };
    },
    (e) => AppError.internal('reporting.generalLedger.failed', e),
  );
}
