import { db } from '@erp/db';
import { auditLog } from '@erp/db/schema/audit';
import { shiftExpenses, shifts, posSettings } from '@erp/db/schema/pos';
import { userNotifications } from '@erp/db/schema/notification';
import { users, userRoles, rolePermissions, roles, permissions } from '@erp/db/schema/auth';
import { AppError } from '@erp/shared/errors';
import { generateId } from '@erp/shared/id';
import { type Result, err, ok, tryCatch } from '@erp/shared/result';
import type { AuditContext } from '@erp/shared/types';
import { and, eq, inArray, isNull, or, sql } from 'drizzle-orm';
import { requirePermission } from '../iam';
import { createJournal } from '../accounting/create-journal';
import { autoPostJournalEntry } from './posting';
import {
  type RecordShiftExpenseInput,
  RecordShiftExpenseInputSchema,
  type ApproveShiftExpenseInput,
  ApproveShiftExpenseInputSchema,
} from './schemas';
import { auditRecord } from "../audit";

/**
 * Record an expense out of the cashier drawer.
 * Creates a pending shift expense and notifies accountants.
 */
export async function recordShiftExpense(
  input: RecordShiftExpenseInput,
  ctx: AuditContext,
): Promise<Result<{ id: string }>> {
  const parsed = RecordShiftExpenseInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      AppError.validation('pos.shiftExpense.validationFailed', { issues: parsed.error.issues }),
    );
  }
  const { shiftId, amount: amountStr, description, attachmentUrl } = parsed.data;

  return tryCatch(
    async () => {
      return await db.transaction(async (tx) => {
        // 1. Verify shift exists and is open
        const shift = await tx
          .select()
          .from(shifts)
          .where(and(eq(shifts.tenantId, ctx.tenantId), eq(shifts.id, shiftId)))
          .then((r) => r[0]);

        if (!shift) {
          throw AppError.notFound('pos.shift.notFound', { shiftId });
        }
        if (shift.status !== 'open') {
          throw AppError.businessRule('pos.shift.notOpen', { currentStatus: shift.status });
        }

        // 2. Permission check
        const permCheck = await requirePermission(ctx.userId, 'pos.shift.close', {
          locationId: shift.locationId,
        });
        if (!permCheck.ok) throw permCheck.error;

        // 3. Insert pending expense
        const expenseId = generateId();
        await tx.insert(shiftExpenses).values({
          id: expenseId,
          tenantId: ctx.tenantId,
          locationId: shift.locationId,
          shiftId,
          amount: BigInt(amountStr),
          description,
          attachmentUrl,
          status: 'pending_accounting',
          createdBy: ctx.userId,
          updatedBy: ctx.userId,
        });

        // 4. Notify accountants
        const accountants = await tx
          .select({ id: users.id })
          .from(users)
          .innerJoin(userRoles, eq(users.id, userRoles.userId))
          .innerJoin(roles, eq(userRoles.roleId, roles.id))
          .innerJoin(rolePermissions, eq(roles.id, rolePermissions.roleId))
          .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
          .where(
            and(
              eq(users.tenantId, ctx.tenantId),
              isNull(users.deletedAt),
              eq(permissions.code, 'accounting.journal.create'),
              or(
                isNull(userRoles.locationId),
                eq(userRoles.locationId, shift.locationId),
              ),
            ),
          );

        const uniqueAccountantIds = Array.from(new Set(accountants.map((u) => u.id)));

        if (uniqueAccountantIds.length > 0) {
          const notifications = uniqueAccountantIds.map((userId) => ({
            id: generateId(),
            tenantId: ctx.tenantId,
            userId,
            kind: 'shift_expense',
            title: `Pengeluaran Laci: ${description}`,
            body: `Kasir mencatat pengeluaran sebesar ${amountStr} dan membutuhkan penentuan akun jurnal.`,
            link: '/accounting/shift-expenses',
            createdBy: ctx.userId,
            updatedBy: ctx.userId,
          }));
          await tx.insert(userNotifications).values(notifications);
        }

        await tx.insert(auditLog).values({
          id: generateId(),
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          action: 'create',
          entityType: 'shift_expense',
          entityId: expenseId,
          before: null,
          after: { id: expenseId, shiftId, amount: amountStr, description, attachmentUrl },
          metadata: { ipAddress: ctx.ipAddress, userAgent: ctx.userAgent },
        });

        return { id: expenseId };
      });
    },
    (e) => {
      if (e instanceof AppError) return e;
      return AppError.internal('pos.shiftExpense.recordFailed', e);
    },
  );
}

/**
 * Approve a pending shift expense and post its journal entry.
 */
export async function approveShiftExpense(
  input: ApproveShiftExpenseInput,
  ctx: AuditContext,
): Promise<Result<{ id: string; journalEntryId: string }>> {
  const parsed = ApproveShiftExpenseInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      AppError.validation('pos.shiftExpense.validationFailed', { issues: parsed.error.issues }),
    );
  }
  const { expenseId, accountId } = parsed.data;

  return tryCatch(
    async () => {
      const expense = await db
        .select()
        .from(shiftExpenses)
        .where(and(eq(shiftExpenses.tenantId, ctx.tenantId), eq(shiftExpenses.id, expenseId)))
        .then((r) => r[0]);

      if (!expense) {
        throw AppError.notFound('pos.shiftExpense.notFound', { expenseId });
      }

      if (expense.status !== 'pending_accounting') {
        throw AppError.businessRule('pos.shiftExpense.notPending', { status: expense.status });
      }

      const permCheck = await requirePermission(ctx.userId, 'accounting.journal.create', {
        locationId: expense.locationId,
      });
      if (!permCheck.ok) throw permCheck.error;

      // Get Cash Account from posSettings
      const setting = await db
        .select({ cashCode: posSettings.cashAccountCode })
        .from(posSettings)
        .where(
          and(
            eq(posSettings.tenantId, ctx.tenantId),
            eq(posSettings.locationId, expense.locationId),
          ),
        )
        .then((r) => r[0]);

      const cashCode = setting?.cashCode ?? '1-1100';

      // We need the cashAccount's ID, not its code, for createJournal.
      // We will look it up inside createJournal flow or here.
      const cashAcctRow = await db.query.accounts.findFirst({
        where: (a, { and, eq }) => and(eq(a.tenantId, ctx.tenantId), eq(a.code, cashCode)),
      });

      if (!cashAcctRow) {
        throw AppError.businessRule('accounting.pettyCash.accountsMissing', { cashCode });
      }

      const today = new Date().toISOString().slice(0, 10);
      const amountStr = expense.amount.toString();

      // Create the journal
      const journalRes = await createJournal(
        {
          postingDate: today,
          locationId: expense.locationId,
          description: `Pengeluaran Laci Kasir: ${expense.description}`,
          referenceType: 'manual',
          referenceId: expense.id,
          lines: [
            {
              accountId, // Debit the expense account chosen by accountant
              locationId: expense.locationId,
              description: expense.description,
              debit: amountStr,
              credit: '0',
            },
            {
              accountId: cashAcctRow.id, // Credit Cash
              locationId: expense.locationId,
              description: `Kas keluar - ${expense.description}`,
              debit: '0',
              credit: amountStr,
            },
          ],
        },
        ctx,
      );

      if (!journalRes.ok) throw journalRes.error;

      // Auto-post the journal
      const postRes = await autoPostJournalEntry(journalRes.value.id, ctx, 'pos.shiftExpense');
      if (!postRes.ok) throw postRes.error;

      // Update the expense status
      await db
        .update(shiftExpenses)
        .set({
          status: 'journaled',
          accountId,
          journalEntryId: journalRes.value.id,
          updatedBy: ctx.userId,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(shiftExpenses.tenantId, ctx.tenantId),
            eq(shiftExpenses.id, expense.id)
          )
        );

      await auditRecord({
            action: 'update',
            entityType: 'shift_expense',
            entityId: expense.id,
            before: expense,
            after: { ...expense, status: 'journaled', accountId, journalEntryId: journalRes.value.id },
            metadata: { ipAddress: ctx.ipAddress, userAgent: ctx.userAgent },
            ctx,
          });

      return { id: expense.id, journalEntryId: journalRes.value.id };
    },
    (e) => {
      if (e instanceof AppError) return e;
      return AppError.internal('pos.shiftExpense.approveFailed', e);
    },
  );
}
