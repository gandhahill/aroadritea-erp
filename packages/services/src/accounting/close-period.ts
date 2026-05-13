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

import { db } from '@erp/db';
import { accountingPeriods, journalEntries } from '@erp/db/schema/accounting';
import { auditLog } from '@erp/db/schema/audit';
import { AppError } from '@erp/shared/errors';
import { generateId } from '@erp/shared/id';
import { type Result, err, ok, tryCatch } from '@erp/shared/result';
import type { AuditContext } from '@erp/shared/types';
import { and, eq, sql } from 'drizzle-orm';
import { requirePermission } from '../iam';
import {
  type ClosePeriodInput,
  ClosePeriodInputSchema,
  type GetPeriodStatusInput,
  GetPeriodStatusInputSchema,
} from './schemas';

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

  // 6. Update period status
  const now = new Date();
  const closedAt = newStatus === 'closed' ? now : null;
  const closedBy = newStatus === 'closed' ? ctx.userId : null;

  return tryCatch(
    async () => {
      await db
        .update(accountingPeriods)
        .set({
          status: newStatus,
          closedAt,
          closedBy,
          updatedAt: now,
          updatedBy: ctx.userId,
        })
        .where(eq(accountingPeriods.id, period.id));

      // 7. Audit log
      await db.insert(auditLog).values({
        id: generateId(),
        tenantId: ctx.tenantId,
        userId: ctx.userId,
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
