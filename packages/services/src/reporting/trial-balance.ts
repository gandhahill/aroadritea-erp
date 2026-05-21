/**
 * reporting.trialBalance — SD §21.2
 *
 * Generates a Trial Balance (Neraca Saldo) as of a given date.
 * Aggregates all posted journal lines per account, computing net balance.
 *
 * Permission: accounting.view
 */

import { db } from '@erp/db';
import {
  accountingPeriods,
  accounts,
  journalEntries,
  journalLines,
} from '@erp/db/schema/accounting';
import { AppError } from '@erp/shared/errors';
import { type Result, ok, tryCatch } from '@erp/shared/result';
import type { AuditContext } from '@erp/shared/types';
import { and, eq, lte, sql } from 'drizzle-orm';
import { requirePermission } from '../iam';

// --- Types ---

export interface TrialBalanceInput {
  /** As-of date (inclusive). Format: YYYY-MM-DD. */
  asOf: string;
  /** Optional location filter. NULL = all locations (consolidated). */
  locationId?: string;
}

export interface TrialBalanceLine {
  accountId: string;
  accountCode: string;
  accountName: Record<string, string>;
  accountType: string;
  normalBalance: string;
  totalDebit: bigint;
  totalCredit: bigint;
  /** Net balance: debit-credit for debit-normal, credit-debit for credit-normal. */
  balance: bigint;
}

export interface TrialBalanceResult {
  asOf: string;
  locationId: string | null;
  lines: TrialBalanceLine[];
  totalDebit: bigint;
  totalCredit: bigint;
  isPreliminary: boolean;
}

// --- Service function ---

export async function trialBalance(
  input: TrialBalanceInput,
  ctx: AuditContext,
): Promise<Result<TrialBalanceResult>> {
  const permCheck = await requirePermission(
    ctx.userId,
    'accounting.view',
    input.locationId ? { locationId: input.locationId } : undefined,
  );
  if (!permCheck.ok) return permCheck;

  return tryCatch(
    async () => {
      // Build conditions for posted journals up to asOf date
      const jeConditions = [
        eq(journalEntries.tenantId, ctx.tenantId),
        eq(journalEntries.status, 'posted'),
        lte(journalEntries.postingDate, input.asOf),
      ];

      // Location filter on journal lines
      const lineConditions: ReturnType<typeof eq>[] = [];
      if (input.locationId) {
        lineConditions.push(eq(journalLines.locationId, input.locationId));
      }

      // Aggregate debit/credit per account from posted journals
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

      // Fetch account details
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

      let grandTotalDebit = 0n;
      let grandTotalCredit = 0n;

      const lines: TrialBalanceLine[] = [];

      for (const row of rows) {
        const acct = acctMap.get(row.accountId);
        if (!acct) continue;

        const totalDebit = BigInt(row.totalDebit);
        const totalCredit = BigInt(row.totalCredit);
        grandTotalDebit += totalDebit;
        grandTotalCredit += totalCredit;

        const balance =
          acct.normalBalance === 'debit' ? totalDebit - totalCredit : totalCredit - totalDebit;

        lines.push({
          accountId: acct.id,
          accountCode: acct.code,
          accountName: acct.name as Record<string, string>,
          accountType: acct.type,
          normalBalance: acct.normalBalance,
          totalDebit,
          totalCredit,
          balance,
        });
      }

      // Sort by account code
      lines.sort((a, b) => a.accountCode.localeCompare(b.accountCode));

      const closingPeriods = await db
        .select({ id: accountingPeriods.id })
        .from(accountingPeriods)
        .where(
          and(
            eq(accountingPeriods.tenantId, ctx.tenantId),
            eq(accountingPeriods.status, 'closing'),
            lte(accountingPeriods.startDate, input.asOf),
          ),
        );

      return {
        asOf: input.asOf,
        locationId: input.locationId ?? null,
        lines,
        totalDebit: grandTotalDebit,
        totalCredit: grandTotalCredit,
        isPreliminary: closingPeriods.length > 0,
      };
    },
    (e) => AppError.internal('reporting.trialBalance.failed', e),
  );
}
