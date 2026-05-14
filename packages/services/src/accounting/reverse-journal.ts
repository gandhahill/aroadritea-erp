/**
 * accounting.reverseJournal — SD §20.6, §21.1
 *
 * Creates a reversal journal entry for a posted JE.
 * Returns Result<JournalEntryResult> — never throws.
 *
 * Reversal mechanics (SD §20.6):
 * - A posted JE cannot be edited. To cancel it, create a NEW JE
 *   with amounts reversed (debit↔credit).
 * - Original JE: status → 'reversed', reversedByJeId → new JE id.
 * - New reversal JE: status → 'posted' immediately (no draft step).
 * - The reversal's posting date can be different from the original
 *   (e.g., next month for correction) — but must be in an open period.
 *
 * Business rules:
 * - Original JE must exist and be 'posted'
 * - Cannot reverse a JE that is already reversed
 * - Reversal posting date must be in an open period
 * - Permission: accounting.journal.reverse
 * - Audit log for both the original status change and the new reversal
 */

import { db } from '@erp/db';
import { accountingPeriods, journalEntries, journalLines } from '@erp/db/schema/accounting';
import { auditLog } from '@erp/db/schema/audit';
import { AppError } from '@erp/shared/errors';
import { generateId } from '@erp/shared/id';
import { type Result, err, ok, tryCatch } from '@erp/shared/result';
import type { AuditContext } from '@erp/shared/types';
import { and, eq } from 'drizzle-orm';
import { requirePermission } from '../iam';
import type { JournalEntryResult, JournalLineResult } from './create-journal';
import { generateJournalNumber } from './number-generator';
import { type ReverseJournalInput, ReverseJournalInputSchema } from './schemas';

// --- Service function ---

/**
 * Reverse a posted journal entry by creating a mirror JE with swapped amounts.
 *
 * @param input - { journalId, postingDate }
 * @param ctx - Audit context
 * @returns Result<JournalEntryResult> — the NEW reversal JE
 */
export async function reverseJournal(
  input: ReverseJournalInput,
  ctx: AuditContext,
): Promise<Result<JournalEntryResult>> {
  // 1. Validate input with Zod
  const parsed = ReverseJournalInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      AppError.validation('accounting.journal.validationFailed', {
        issues: parsed.error.issues,
      }),
    );
  }
  const { journalId, postingDate } = parsed.data;

  // 2. Fetch the original journal entry
  const originalJe = await db
    .select()
    .from(journalEntries)
    .where(and(eq(journalEntries.id, journalId), eq(journalEntries.tenantId, ctx.tenantId)))
    .then((rows) => rows[0]);

  if (!originalJe) {
    return err(AppError.notFound('accounting.journal.notFound', { journalId }));
  }

  // 3. Permission check (use original JE's locationId)
  const permCheck = await requirePermission(ctx.userId, 'accounting.journal.reverse', {
    locationId: originalJe.locationId,
  });
  if (!permCheck.ok) return permCheck;

  // 4. Status check: must be 'posted'
  if (originalJe.status !== 'posted') {
    return err(
      AppError.businessRule('accounting.journal.cannotReverse', {
        journalId,
        currentStatus: originalJe.status,
        reason:
          originalJe.status === 'draft'
            ? 'Cannot reverse a draft JE. Delete it instead.'
            : 'This JE has already been reversed.',
      }),
    );
  }

  // 5. Find open period for the reversal posting date
  const reversalPeriodMonth = postingDate.substring(0, 7);
  const reversalPeriod = await db
    .select()
    .from(accountingPeriods)
    .where(
      and(
        eq(accountingPeriods.tenantId, ctx.tenantId),
        eq(accountingPeriods.code, reversalPeriodMonth),
      ),
    )
    .then((rows) => rows[0]);

  if (!reversalPeriod) {
    return err(
      AppError.businessRule('accounting.journal.periodNotFound', {
        periodCode: reversalPeriodMonth,
      }),
    );
  }

  if (reversalPeriod.status !== 'open') {
    return err(
      AppError.businessRule('accounting.journal.periodClosed', {
        periodCode: reversalPeriodMonth,
        periodStatus: reversalPeriod.status,
      }),
    );
  }

  // 6. Fetch original lines
  const originalLines = await db
    .select()
    .from(journalLines)
    .where(eq(journalLines.journalEntryId, journalId));

  if (originalLines.length === 0) {
    return err(AppError.internal('accounting.journal.noLines', { journalId }));
  }

  // 7. Generate reversal JE ID and number
  const reversalJeId = generateId();
  const reversalNumber = await generateJournalNumber(ctx.tenantId, postingDate);
  const now = new Date();

  // 8. Build reversed lines (swap debit↔credit)
  const reversedLineValues = originalLines.map((line, idx) => ({
    id: generateId(),
    journalEntryId: reversalJeId,
    lineNo: idx + 1,
    accountId: line.accountId,
    locationId: line.locationId,
    description: line.description,
    debit: line.credit, // swap: original credit → reversal debit
    credit: line.debit, // swap: original debit → reversal credit
    taxCode: line.taxCode,
    partnerId: line.partnerId,
  }));

  // 9. Execute: create reversal JE + update original JE + audit
  return tryCatch(
    async () => {
      // 9a. Insert reversal JE (status = 'posted' immediately)
      await db.insert(journalEntries).values({
        id: reversalJeId,
        tenantId: ctx.tenantId,
        locationId: originalJe.locationId,
        periodId: reversalPeriod.id,
        postingDate,
        number: reversalNumber,
        description: `Reversal of ${originalJe.number}: ${originalJe.description}`,
        referenceType: originalJe.referenceType,
        referenceId: originalJe.referenceId,
        status: 'posted',
        postedAt: now,
        postedBy: ctx.userId,
        reversedByJeId: null,
        totalDebit: originalJe.totalCredit, // swapped totals
        totalCredit: originalJe.totalDebit,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      });

      // 9b. Insert reversed lines
      await db.insert(journalLines).values(reversedLineValues);

      // 9c. Update original JE: status → 'reversed', link to reversal
      await db
        .update(journalEntries)
        .set({
          status: 'reversed',
          reversedByJeId: reversalJeId,
          updatedBy: ctx.userId,
          updatedAt: now,
          version: originalJe.version + 1,
        })
        .where(
          and(eq(journalEntries.id, journalId), eq(journalEntries.version, originalJe.version)),
        );

      // 9d. Audit log — reversal creation
      await db.insert(auditLog).values({
        id: generateId(),
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        action: 'create',
        entityType: 'journal_entry',
        entityId: reversalJeId,
        before: null,
        after: {
          id: reversalJeId,
          number: reversalNumber,
          status: 'posted',
          reversalOf: originalJe.number,
          totalDebit: originalJe.totalCredit.toString(),
          totalCredit: originalJe.totalDebit.toString(),
        },
        metadata: {
          ip: ctx.ipAddress ?? null,
          userAgent: ctx.userAgent ?? null,
        },
      });

      // 9e. Audit log — original JE status change
      await db.insert(auditLog).values({
        id: generateId(),
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        action: 'reverse',
        entityType: 'journal_entry',
        entityId: journalId,
        before: {
          status: 'posted',
          version: originalJe.version,
        },
        after: {
          status: 'reversed',
          reversedByJeId: reversalJeId,
          version: originalJe.version + 1,
        },
        metadata: {
          ip: ctx.ipAddress ?? null,
          userAgent: ctx.userAgent ?? null,
        },
      });

      // Build result (return the NEW reversal JE)
      const result: JournalEntryResult = {
        id: reversalJeId,
        number: reversalNumber,
        postingDate,
        locationId: originalJe.locationId,
        periodId: reversalPeriod.id,
        description: `Reversal of ${originalJe.number}: ${originalJe.description}`,
        status: 'posted',
        totalDebit: originalJe.totalCredit,
        totalCredit: originalJe.totalDebit,
        lines: reversedLineValues.map(
          (lv): JournalLineResult => ({
            id: lv.id,
            lineNo: lv.lineNo,
            accountId: lv.accountId,
            locationId: lv.locationId,
            description: lv.description,
            debit: lv.debit,
            credit: lv.credit,
            taxCode: lv.taxCode,
            partnerId: lv.partnerId,
          }),
        ),
      };

      return result;
    },
    (e) => {
      if (e instanceof AppError) return e;
      return AppError.internal('accounting.journal.reverseFailed', e);
    },
  );
}
