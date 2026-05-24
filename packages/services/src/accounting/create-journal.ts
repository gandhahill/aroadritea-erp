/**
 * accounting.createJournal — SD §20, §21.1
 *
 * Creates a draft journal entry with validated, balanced lines.
 * Returns Result<JournalEntry> — never throws.
 *
 * Business rules enforced:
 * - Period must exist and be 'open'
 * - All accounts must be postable and active
 * - Lines must balance (total debit === total credit)
 * - At least 2 lines
 * - Each line: debit > 0 XOR credit > 0 (enforced by DB CHECK, validated here too)
 * - Total amounts must be > 0 (no zero-value JE)
 *
 * Permission: accounting.journal.create (checked via requirePermission)
 */

import { db } from '@erp/db';
import {
  accountingPeriods,
  accounts,
  journalEntries,
  journalLines,
} from '@erp/db/schema/accounting';
import { AppError } from '@erp/shared/errors';
import { generateId } from '@erp/shared/id';
import { type Result, err, ok, tryCatch } from '@erp/shared/result';
import type { AuditContext } from '@erp/shared/types';
import { and, eq, inArray } from 'drizzle-orm';
import { requirePermission } from '../iam';
import { generateJournalNumber } from '../shared/number-generator';
import { type CreateJournalInput, CreateJournalInputSchema } from './schemas';
import { auditRecord } from "../audit";
import { claimIdempotency, releaseIdempotencyClaim, saveIdempotency } from '../shared/idempotency';

// --- Return type ---

export interface JournalEntryResult {
  id: string;
  number: string;
  postingDate: string;
  locationId: string;
  periodId: string;
  description: string;
  status: string;
  totalDebit: bigint;
  totalCredit: bigint;
  lines: JournalLineResult[];
}

export interface JournalLineResult {
  id: string;
  lineNo: number;
  accountId: string;
  locationId: string;
  description: string | null;
  debit: bigint;
  credit: bigint;
  taxCode: string | null;
  partnerId: string | null;
  dueDate: string | null;
  reminderDaysBefore: number | null;
  expectedLossRateBps: number | null;
}

// --- Service function ---

/**
 * Create a new journal entry in 'draft' status.
 *
 * @param input - Raw input (will be Zod-validated inside)
 * @param ctx - Audit context (userId, tenantId, locationId, etc.)
 * @returns Result<JournalEntryResult>
 */
export async function createJournal(
  input: CreateJournalInput,
  ctx: AuditContext,
): Promise<Result<JournalEntryResult>> {
  // 1. Permission check
  const permCheck = await requirePermission(ctx.userId, 'accounting.journal.create', {
    locationId: input.locationId,
  });
  if (!permCheck.ok) return permCheck;

  // 2. Validate input with Zod (SD §10.4)
  const parsed = CreateJournalInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      AppError.validation('accounting.journal.validationFailed', {
        issues: parsed.error.issues,
      }),
    );
  }
  const data = parsed.data;

  let claimedIdempotencyId: string | null = null;
  if (data.idempotencyKey) {
    const claimResult = await claimIdempotency(data.locationId, data.idempotencyKey, 'accounting.createJournal');
    if (!claimResult.ok) return claimResult;
    claimedIdempotencyId = claimResult.value.id;
  }

  // 3. Parse line amounts to bigint and validate debit/credit exclusivity
  const parsedLines = data.lines.map((line, idx) => {
    const debit = BigInt(line.debit);
    const credit = BigInt(line.credit);
    return { ...line, debit, credit, lineNo: idx + 1 };
  });

  // 4. Validate each line: debit > 0 XOR credit > 0 (SD §21.1 edge case)
  for (const line of parsedLines) {
    if (line.debit === 0n && line.credit === 0n) {
      return err(
        AppError.businessRule('accounting.journal.lineZero', {
          lineNo: line.lineNo,
        }),
      );
    }
    if (line.debit > 0n && line.credit > 0n) {
      return err(
        AppError.businessRule('accounting.journal.lineBothDebitCredit', {
          lineNo: line.lineNo,
        }),
      );
    }
  }

  // 5. Balance check: total debit === total credit (SD §5.4, §20)
  const totalDebit = parsedLines.reduce((sum, l) => sum + l.debit, 0n);
  const totalCredit = parsedLines.reduce((sum, l) => sum + l.credit, 0n);

  if (totalDebit !== totalCredit) {
    return err(
      AppError.businessRule('accounting.journal.notBalanced', {
        totalDebit: totalDebit.toString(),
        totalCredit: totalCredit.toString(),
      }),
    );
  }

  // 6. Reject zero-value JE (SD §21.1 edge case)
  if (totalDebit === 0n) {
    return err(AppError.businessRule('accounting.journal.zeroAmount'));
  }

  // 7. Find open period for posting date
  const periodMonth = data.postingDate.substring(0, 7); // 'YYYY-MM'
  const period = await db
    .select()
    .from(accountingPeriods)
    .where(
      and(eq(accountingPeriods.tenantId, ctx.tenantId), eq(accountingPeriods.code, periodMonth)),
    )
    .then((rows) => rows[0]);

  if (!period) {
    return err(
      AppError.businessRule('accounting.journal.periodNotFound', {
        periodCode: periodMonth,
      }),
    );
  }

  if (period.status !== 'open') {
    return err(
      AppError.businessRule('accounting.journal.periodClosed', {
        periodCode: periodMonth,
        periodStatus: period.status,
      }),
    );
  }

  // 8. Validate accounts: exist, active, postable
  const accountIds = [...new Set(parsedLines.map((l) => l.accountId))];
  const foundAccounts = await db
    .select({
      id: accounts.id,
      isActive: accounts.isActive,
      isPostable: accounts.isPostable,
      code: accounts.code,
    })
    .from(accounts)
    .where(and(eq(accounts.tenantId, ctx.tenantId), inArray(accounts.id, accountIds)));

  const accountMap = new Map(foundAccounts.map((a) => [a.id, a]));

  // Check all referenced accounts exist
  for (const accId of accountIds) {
    const acc = accountMap.get(accId);
    if (!acc) {
      return err(AppError.notFound('accounting.journal.accountNotFound', { accountId: accId }));
    }
    if (!acc.isActive) {
      return err(
        AppError.businessRule('accounting.journal.accountInactive', {
          accountId: accId,
          accountCode: acc.code,
        }),
      );
    }
    if (!acc.isPostable) {
      return err(
        AppError.businessRule('accounting.journal.accountNotPostable', {
          accountId: accId,
          accountCode: acc.code,
        }),
      );
    }
  }

  // 9. Generate JE number and ID
  const jeId = generateId();
  const jeNumber = await generateJournalNumber(ctx.tenantId, data.postingDate);

  // 10. Insert journal entry + lines in a transaction-like flow
  //     (Neon HTTP driver doesn't support true transactions, but inserts are
  //      atomic per statement. We insert JE first, then lines. If lines fail,
  //      the JE is orphaned in draft status — acceptable for draft.)
  const result = await tryCatch(
    async () => {
      // Insert journal entry
      await db.insert(journalEntries).values({
        id: jeId,
        tenantId: ctx.tenantId,
        locationId: data.locationId,
        periodId: period.id,
        postingDate: data.postingDate,
        number: jeNumber,
        description: data.description,
        referenceType: data.referenceType ?? 'manual',
        referenceId: data.referenceId ?? null,
        status: 'draft',
        totalDebit: totalDebit,
        totalCredit: totalCredit,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      });

      // Insert journal lines
      const lineValues = parsedLines.map((line) => ({
        id: generateId(),
        journalEntryId: jeId,
        lineNo: line.lineNo,
        accountId: line.accountId,
        locationId: line.locationId,
        description: line.description ?? null,
        debit: line.debit,
        credit: line.credit,
        taxCode: line.taxCode ?? null,
        partnerId: line.partnerId ?? null,
        dueDate: line.dueDate ?? null,
        reminderDaysBefore: line.reminderDaysBefore ?? null,
        expectedLossRateBps: line.expectedLossRateBps ?? null,
      }));

      await db.insert(journalLines).values(lineValues);

      // 11. Write audit log (SD §15)
      await auditRecord({
            action: 'create',
            entityType: 'journal_entry',
            entityId: jeId,
            before: null,
            after: {
                    id: jeId,
                    number: jeNumber,
                    postingDate: data.postingDate,
                    status: 'draft',
                    totalDebit: totalDebit.toString(),
                    totalCredit: totalCredit.toString(),
                    lineCount: lineValues.length,
                  },
            metadata: {
                    ip: ctx.ipAddress ?? null,
                    userAgent: ctx.userAgent ?? null,
                  },
            ctx,
          });

      const resultObj: JournalEntryResult = {
        id: jeId,
        number: jeNumber,
        postingDate: data.postingDate,
        locationId: data.locationId,
        periodId: period.id,
        description: data.description,
        status: 'draft',
        totalDebit,
        totalCredit,
        lines: lineValues.map((lv) => ({
          id: lv.id,
          lineNo: lv.lineNo,
          accountId: lv.accountId,
          locationId: lv.locationId,
          description: lv.description,
          debit: lv.debit,
          credit: lv.credit,
          taxCode: lv.taxCode,
          partnerId: lv.partnerId,
          dueDate: lv.dueDate,
          reminderDaysBefore: lv.reminderDaysBefore,
          expectedLossRateBps: lv.expectedLossRateBps,
        })),
      };

      return resultObj;
    },
    (e) => AppError.internal('accounting.journal.createFailed', e),
  );

  if (result.ok && data.idempotencyKey && claimedIdempotencyId) {
    await saveIdempotency(db, data.locationId, data.idempotencyKey, 201, result.value);
  } else if (!result.ok && claimedIdempotencyId) {
    await releaseIdempotencyClaim(claimedIdempotencyId, 500, { error: 'journal_create_failed' });
  }

  return result;
}
