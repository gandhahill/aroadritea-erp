import { db } from '@erp/db';
import { journalEntries, journalLines } from '@erp/db/schema/accounting';
import { AppError } from '@erp/shared/errors';
import { type Result, err, ok, tryCatch } from '@erp/shared/result';
import type { AuditContext } from '@erp/shared/types';
import { and, eq } from 'drizzle-orm';
import { auditRecord } from '../audit';
import { requirePermission } from '../iam';

export async function deleteJournal(
  journalId: string,
  ctx: AuditContext,
): Promise<Result<void>> {
  const je = await db
    .select()
    .from(journalEntries)
    .where(and(eq(journalEntries.id, journalId), eq(journalEntries.tenantId, ctx.tenantId)))
    .then((rows) => rows[0]);

  if (!je) {
    return err(AppError.notFound('accounting.journal.notFound', { journalId }));
  }

  // Use the create permission for deleting drafts.
  const permCheck = await requirePermission(ctx.userId, 'accounting.journal.create', {
    locationId: je.locationId,
  });
  if (!permCheck.ok) return permCheck;

  if (je.status !== 'draft') {
    return err(
      AppError.businessRule('accounting.journal.cannotDelete', {
        journalId,
        currentStatus: je.status,
        reason: 'Only draft journal entries can be deleted.',
      }),
    );
  }

  return tryCatch(
    async () => {
      const deletedAt = new Date();
      await db.transaction(async (tx) => {
        await tx
          .update(journalEntries)
          .set({ deletedAt, updatedBy: ctx.userId, updatedAt: deletedAt })
          .where(eq(journalEntries.id, journalId));
      });

      await auditRecord({
        action: 'delete',
        entityType: 'journal_entry',
        entityId: journalId,
        before: { id: je.id, number: je.number, status: je.status },
        after: null,
        metadata: {
          ip: ctx.ipAddress ?? null,
          userAgent: ctx.userAgent ?? null,
        },
        ctx,
      });
    },
    (e) => AppError.internal('accounting.journal.deleteFailed', e),
  );
}
