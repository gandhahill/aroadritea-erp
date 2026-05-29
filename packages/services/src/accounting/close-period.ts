/**
 * accounting.closePeriod + getPeriodStatus — SD §20.4, §21.1
 *
 * Period lifecycle: open → closing → closed
 *
 * closePeriod transitions:
 * - First call on 'open' period → status becomes 'closing'
 *   (no new postings allowed, reversals go to next period)
 * - Second call on 'closing' period → status becomes 'closed'
 *   (fully locked, no changes at all)
 *
 * Before transitioning to 'closing':
 * - Check for draft JEs in the period → reject unless force=true
 *
 * Closing entry generation (SD §20.4):
 * - Only at fiscal year-end (last month of fiscal year)
 * - Revenue & expense accounts → Income Summary → Retained Earnings
 * - This is a separate step triggered when closing the final period
 *   of a fiscal year. For now, implemented as a flag check.
 *
 * Permission: accounting.period.close
 */

import { and, eq, inArray, lte, sql } from 'drizzle-orm';
import { accounts, journalEntries, journalLines, accountingPeriods } from '@erp/db/schema/accounting';
import { locations } from '@erp/db/schema/auth';
import type { AuditContext } from '@erp/shared/types';
import { auditRecord } from '../audit';
import { requirePermission } from '../iam';
import {
  type ClosePeriodInput,
  ClosePeriodInputSchema,
  type GetPeriodStatusInput,
  GetPeriodStatusInputSchema,
} from './schemas';
import { createJournal } from './create-journal';
import { postJournal } from './post-journal';
import { db } from '@erp/db';
import { AppError } from '@erp/shared/errors';
import { generateId } from '@erp/shared/id';
import { type Result, err, ok, tryCatch } from '@erp/shared/result';

// --- Return types ---

export interface PeriodStatusResult {
  id: string;
  code: string;
  startDate: string;
  endDate: string;
  status: string;
  closedAt: Date | null;
  closedBy: string | null;
  draftJournalCount: number;
  postedJournalCount: number;
}

export interface ClosePeriodResult {
  id: string;
  code: string;
  previousStatus: string;
  newStatus: string;
  closedAt: Date | null;
  closedBy: string | null;
}

// --- getPeriodStatus ---

/**
 * Get the status of a period including journal counts.
 * Useful for MCP tool `accounting.get_period_status`.
 */
export async function getPeriodStatus(
  input: GetPeriodStatusInput,
  ctx: AuditContext,
): Promise<Result<PeriodStatusResult>> {
  // Validate
  const parsed = GetPeriodStatusInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      AppError.validation('accounting.period.validationFailed', {
        issues: parsed.error.issues,
      }),
    );
  }

  // Permission check
  const permCheck = await requirePermission(ctx.userId, 'accounting.period.close');
  if (!permCheck.ok) return permCheck;

  // Fetch period
  const period = await db
    .select()
    .from(accountingPeriods)
    .where(
      and(
        eq(accountingPeriods.tenantId, ctx.tenantId),
        eq(accountingPeriods.code, parsed.data.periodCode),
      ),
    )
    .then((rows) => rows[0]);

  if (!period) {
    return err(
      AppError.notFound('accounting.period.notFound', {
        periodCode: parsed.data.periodCode,
      }),
    );
  }

  // Count draft and posted JEs in this period
  const draftCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(journalEntries)
    .where(
      and(
        eq(journalEntries.tenantId, ctx.tenantId),
        eq(journalEntries.periodId, period.id),
        eq(journalEntries.status, 'draft'),
      ),
    )
    .then((rows) => Number(rows[0]?.count ?? 0));

  const postedCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(journalEntries)
    .where(
      and(
        eq(journalEntries.tenantId, ctx.tenantId),
        eq(journalEntries.periodId, period.id),
        eq(journalEntries.status, 'posted'),
      ),
    )
    .then((rows) => Number(rows[0]?.count ?? 0));

  return ok({
    id: period.id,
    code: period.code,
    startDate: period.startDate,
    endDate: period.endDate,
    status: period.status,
    closedAt: period.closedAt,
    closedBy: period.closedBy,
    draftJournalCount: draftCount,
    postedJournalCount: postedCount,
  });
}

// --- closePeriod ---

/**
 * Close a period: open → closing → closed.
 *
 * @param input - { periodCode, force? }
 * @param ctx - Audit context
 */
export async function closePeriod(
  input: ClosePeriodInput,
  ctx: AuditContext,
): Promise<Result<ClosePeriodResult>> {
  // 1. Validate input
  const parsed = ClosePeriodInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      AppError.validation('accounting.period.validationFailed', {
        issues: parsed.error.issues,
      }),
    );
  }
  const { periodCode, force } = parsed.data;

  // 2. Permission check
  const permCheck = await requirePermission(ctx.userId, 'accounting.period.close');
  if (!permCheck.ok) return permCheck;

  // 3. Fetch period
  const period = await db
    .select()
    .from(accountingPeriods)
    .where(
      and(eq(accountingPeriods.tenantId, ctx.tenantId), eq(accountingPeriods.code, periodCode)),
    )
    .then((rows) => rows[0]);

  if (!period) {
    return err(AppError.notFound('accounting.period.notFound', { periodCode }));
  }

  // 4. Determine transition
  const previousStatus = period.status;
  let newStatus: string;

  if (previousStatus === 'open') {
    newStatus = 'closing';
  } else if (previousStatus === 'closing') {
    newStatus = 'closed';
  } else {
    // Already closed
    return err(
      AppError.businessRule('accounting.period.alreadyClosed', {
        periodCode,
        status: previousStatus,
      }),
    );
  }

  // 5. If transitioning to 'closing', check for draft JEs
  if (newStatus === 'closing' && !force) {
    const draftCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(journalEntries)
      .where(
        and(
          eq(journalEntries.tenantId, ctx.tenantId),
          eq(journalEntries.periodId, period.id),
          eq(journalEntries.status, 'draft'),
        ),
      )
      .then((rows) => Number(rows[0]?.count ?? 0));

    if (draftCount > 0) {
      return err(
        AppError.businessRule('accounting.period.hasDraftJournals', {
          periodCode,
          draftCount,
        }),
      );
    }
  }

  // 6. Generate closing entries if this is the fiscal year end and we are closing it
  if (newStatus === 'closing' && periodCode.endsWith('-12')) {
    // Determine the default location for the closing JEs
    const loc = await db
      .select({ id: locations.id })
      .from(locations)
      .where(eq(locations.tenantId, ctx.tenantId))
      .limit(1)
      .then((r) => r[0]);

    if (loc) {
      // Find nominal accounts with non-zero balances as of period.endDate
      const nominalBalances = await db
        .select({
          accountId: journalLines.accountId,
          normalBalance: accounts.normalBalance,
          totalDebit: sql<string>`COALESCE(SUM(${journalLines.debit}), 0)`,
          totalCredit: sql<string>`COALESCE(SUM(${journalLines.credit}), 0)`,
        })
        .from(journalLines)
        .innerJoin(journalEntries, eq(journalLines.journalEntryId, journalEntries.id))
        .innerJoin(accounts, eq(journalLines.accountId, accounts.id))
        .where(
          and(
            eq(journalEntries.tenantId, ctx.tenantId),
            eq(journalEntries.status, 'posted'),
            lte(journalEntries.postingDate, period.endDate),
            inArray(accounts.type, ['income', 'expense', 'cogs'])
          )
        )
        .groupBy(journalLines.accountId, accounts.normalBalance);

      const linesToClose: { accountId: string; debit: bigint; credit: bigint }[] = [];
      let netIncomeDebit = 0n;
      let netIncomeCredit = 0n;

      for (const row of nominalBalances) {
        const debit = BigInt(row.totalDebit);
        const credit = BigInt(row.totalCredit);
        const isDebitNormal = row.normalBalance === 'debit';
        const balance = isDebitNormal ? debit - credit : credit - debit;

        if (balance === 0n) continue;

        let closeDebit = 0n;
        let closeCredit = 0n;

        if (isDebitNormal) {
          if (balance > 0n) closeCredit = balance;
          else closeDebit = -balance;
        } else {
          if (balance > 0n) closeDebit = balance;
          else closeCredit = -balance;
        }

        linesToClose.push({
          accountId: row.accountId,
          debit: closeDebit,
          credit: closeCredit,
        });

        netIncomeDebit += closeCredit;
        netIncomeCredit += closeDebit;
      }

      if (linesToClose.length > 0) {
        const isumAcct = await db
          .select({ id: accounts.id })
          .from(accounts)
          .where(and(eq(accounts.tenantId, ctx.tenantId), eq(accounts.code, '3-1300')))
          .limit(1)
          .then((r) => r[0]);
        const reAcct = await db
          .select({ id: accounts.id })
          .from(accounts)
          .where(and(eq(accounts.tenantId, ctx.tenantId), eq(accounts.code, '3-1400')))
          .limit(1)
          .then((r) => r[0]);

        if (isumAcct && reAcct) {
          const isumDebit = netIncomeDebit > netIncomeCredit ? netIncomeDebit - netIncomeCredit : 0n;
          const isumCredit = netIncomeCredit > netIncomeDebit ? netIncomeCredit - netIncomeDebit : 0n;

          // Add Income Summary line to balance JE 1
          linesToClose.push({
            accountId: isumAcct.id,
            debit: isumDebit,
            credit: isumCredit,
          });

          // Create and post JE 1 (Nominal -> Income Summary)
          const je1 = await createJournal(
            {
              postingDate: period.endDate,
              locationId: loc.id,
              description: `Closing Entry - Nominal Accounts to Income Summary (${period.code})`,
              referenceType: 'manual',
              lines: linesToClose.map((l) => ({
                accountId: l.accountId,
                locationId: loc.id,
                debit: l.debit.toString(),
                credit: l.credit.toString(),
              })),
            },
            ctx
          );

          if (je1.ok) {
            await postJournal({ journalId: je1.value.id }, ctx);
          }

          // Create and post JE 2 (Income Summary -> Retained Earnings)
          if (isumDebit > 0n || isumCredit > 0n) {
            const je2 = await createJournal(
              {
                postingDate: period.endDate,
                locationId: loc.id,
                description: `Closing Entry - Income Summary to Retained Earnings (${period.code})`,
                referenceType: 'manual',
                lines: [
                  {
                    accountId: isumAcct.id,
                    locationId: loc.id,
                    debit: isumCredit.toString(), // reverse
                    credit: isumDebit.toString(),
                  },
                  {
                    accountId: reAcct.id,
                    locationId: loc.id,
                    debit: isumDebit.toString(),
                    credit: isumCredit.toString(),
                  },
                ],
              },
              ctx
            );

            if (je2.ok) {
              await postJournal({ journalId: je2.value.id }, ctx);
            }
          }
        }
      }
    }
  }

  // 7. Update period status
  const now = new Date();
  const closedAt = newStatus === 'closed' ? now : null;
  const closedBy = newStatus === 'closed' ? ctx.userId : null;

  return tryCatch(
    async () => {
      // Atomic claim: only one concurrent caller may transition the
      // period out of `previousStatus`. Returning rows guards against
      // double-close (and double audit logs).
      const updated = await db
        .update(accountingPeriods)
        .set({
          status: newStatus,
          closedAt,
          closedBy,
          updatedAt: now,
          updatedBy: ctx.userId,
        })
        .where(
          and(eq(accountingPeriods.id, period.id), eq(accountingPeriods.status, previousStatus)),
        )
        .returning({ id: accountingPeriods.id });

      if (!updated || updated.length === 0) {
        throw AppError.conflict('accounting.period.concurrentModification', {
          periodCode,
          expectedStatus: previousStatus,
        });
      }

      // 7. Audit log
      await auditRecord({
        action: newStatus === 'closed' ? 'close' : 'closing',
        entityType: 'accounting_period',
        entityId: period.id,
        before: { status: previousStatus },
        after: {
          status: newStatus,
          closedAt: closedAt?.toISOString() ?? null,
          closedBy,
        },
        metadata: {
          ip: ctx.ipAddress ?? null,
          userAgent: ctx.userAgent ?? null,
        },
        ctx,
      });

      return {
        id: period.id,
        code: periodCode,
        previousStatus,
        newStatus,
        closedAt,
        closedBy,
      };
    },
    (e) => {
      if (e instanceof AppError) return e;
      return AppError.internal('accounting.period.closeFailed', e);
    },
  );
}
