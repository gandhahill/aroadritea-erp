/**
 * accounting.postJournal — SD §20, §21.1
 *
 * Transitions a journal entry from 'draft' → 'posted'.
 * Returns Result<JournalEntryResult> — never throws.
 *
 * Business rules enforced:
 * - JE must exist
 * - JE status must be 'draft'
 * - Period must still be 'open' (closing/closed → reject per SD §20.4)
 * - Re-validate balance (defense in depth)
 * - Optimistic lock via version column (SD §8.4)
 * - Sets postedAt = now, postedBy = ctx.userId, status = 'posted'
 *
 * Permission: accounting.journal.post
 */

import { eq, and } from 'drizzle-orm';
import { db } from '@erp/db';
import {
  journalEntries,
  journalLines,
  accountingPeriods,
} from '@erp/db/schema/accounting';
import { auditLog } from '@erp/db/schema/audit';
import { type Result, ok, err, tryCatch } from '@erp/shared/result';
import { AppError } from '@erp/shared/errors';
import { generateId } from '@erp/shared/id';
import type { AuditContext } from '@erp/shared/types';
import { requirePermission } from '../iam';
import { PostJournalInputSchema, type PostJournalInput } from './schemas';
import type { JournalEntryResult, JournalLineResult } from './create-journal';

// --- Service function ---

/**
 * Post a draft journal entry, making it final.
 *
 * @param input - { journalId }
 * @param ctx - Audit context (userId, tenantId, etc.)
 * @returns Result<JournalEntryResult>
 */
export async function postJournal(
  input: PostJournalInput,
  ctx: AuditContext,
): Promise<Result<JournalEntryResult>> {
  // 1. Validate input with Zod (SD §10.4)
  const parsed = PostJournalInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      AppError.validation('accounting.journal.validationFailed', {
        issues: parsed.error.issues,
      }),
    );
  }
  const { journalId } = parsed.data;

  // 2. Fetch the journal entry
  const je = await db
    .select()
    .from(journalEntries)
    .where(
      and(
        eq(journalEntries.id, journalId),
        eq(journalEntries.tenantId, ctx.tenantId),
      ),
    )
    .then((rows) => rows[0]);

  if (!je) {
    return err(AppError.notFound('accounting.journal.notFound', { journalId }));
  }

  // 3. Permission check (use JE's locationId for scope)
  const permCheck = await requirePermission(ctx.userId, 'accounting.journal.post', {
    locationId: je.locationId,
  });
  if (!permCheck.ok) return permCheck;

  // 4. Status check: must be 'draft'
  if (je.status !== 'draft') {
    return err(
      AppError.businessRule('accounting.journal.notDraft', {
        journalId,
        currentStatus: je.status,
      }),
    );
  }

  // 5. Re-validate balance (defense in depth)
  if (je.totalDebit !== je.totalCredit) {
    return err(
      AppError.businessRule('accounting.journal.notBalanced', {
        totalDebit: je.totalDebit.toString(),
        totalCredit: je.totalCredit.toString(),
      }),
    );
  }

  // 6. Reject zero-value JE
  if (je.totalDebit === 0n) {
    return err(AppError.businessRule('accounting.journal.zeroAmount'));
  }

  // 7. Verify period is still open (SD §20.4)
  const period = await db
    .select()
    .from(accountingPeriods)
    .where(
      and(
        eq(accountingPeriods.id, je.periodId),
        eq(accountingPeriods.tenantId, ctx.tenantId),
      ),
    )
    .then((rows) => rows[0]);

  if (!period) {
    return err(
      AppError.businessRule('accounting.journal.periodNotFound', {
        periodId: je.periodId,
      }),
    );
  }

  if (period.status !== 'open') {
    return err(
      AppError.businessRule('accounting.journal.periodClosed', {
        periodCode: period.code,
        periodStatus: period.status,
      }),
    );
  }

  // 8. Fetch lines for the result
  const lines = await db
    .select()
    .from(journalLines)
    .where(eq(journalLines.journalEntryId, journalId));

  // 9. Update JE status to 'posted' with optimistic lock
  const now = new Date();

  return tryCatch(
    async () => {
      const updated = await db
        .update(journalEntries)
        .set({
          status: 'posted',
          postedAt: now,
          postedBy: ctx.userId,
          updatedBy: ctx.userId,
          updatedAt: now,
          version: je.version + 1,
        })
        .where(
          and(
            eq(journalEntries.id, journalId),
            eq(journalEntries.version, je.version), // optimistic lock
          ),
        )
        .returning();

      if (!updated || updated.length === 0) {
        throw AppError.conflict('accounting.journal.concurrentModification', {
          journalId,
          expectedVersion: je.version,
        });
      }

      // 10. Write audit log (SD §15) — action = 'post'
      await db.insert(auditLog).values({
        id: generateId(),
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        action: 'post',
        entityType: 'journal_entry',
        entityId: journalId,
        before: {
          status: 'draft',
          version: je.version,
        },
        after: {
          status: 'posted',
          postedAt: now.toISOString(),
          postedBy: ctx.userId,
          version: je.version + 1,
        },
        metadata: {
          ip: ctx.ipAddress ?? null,
          userAgent: ctx.userAgent ?? null,
        },
      });

      // Build result
      const result: JournalEntryResult = {
        id: je.id,
        number: je.number,
        postingDate: je.postingDate,
        locationId: je.locationId,
        periodId: je.periodId,
        description: je.description,
        status: 'posted',
        totalDebit: je.totalDebit,
        totalCredit: je.totalCredit,
        lines: lines.map((l): JournalLineResult => ({
          id: l.id,
          lineNo: l.lineNo,
          accountId: l.accountId,
          locationId: l.locationId,
          description: l.description,
          debit: l.debit,
          credit: l.credit,
          taxCode: l.taxCode,
          partnerId: l.partnerId,
        })),
      };

      return result;
    },
    (e) => {
      if (e instanceof AppError) return e;
      return AppError.internal('accounting.journal.postFailed', e);
    },
  );
}
