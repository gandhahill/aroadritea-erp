/**
 * accounting.journalAttachments — SD §25.10
 *
 * Manages metadata records for journal entry file attachments.
 * Actual file upload/download (R2/S3 presigned URLs) handled at API layer.
 */

import { db } from '@erp/db';
import { journalAttachments, journalEntries, journalLines } from '@erp/db/schema/accounting';
import { auditLog } from '@erp/db/schema/audit';
import { AppError } from '@erp/shared/errors';
import { generateId } from '@erp/shared/id';
import { type Result, err, ok, tryCatch } from '@erp/shared/result';
import type { AuditContext } from '@erp/shared/types';
import { and, eq } from 'drizzle-orm';
import { requirePermission } from '../iam';
import { type CreateJournalAttachmentInput, CreateJournalAttachmentSchema } from './schemas';

// --- Return types ---

export interface JournalAttachmentResult {
  id: string;
  journalEntryId: string;
  fileKey: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  uploadedBy: string | null;
  uploadedAt: string;
}

export interface JournalWithAttachmentsResult {
  journal: {
    id: string;
    number: string;
    postingDate: string;
    description: string;
    status: string;
    totalDebit: string;
    totalCredit: string;
  };
  lines: Array<{
    id: string;
    lineNo: number;
    accountId: string;
    description: string | null;
    debit: string;
    credit: string;
  }>;
  attachments: JournalAttachmentResult[];
}

// --- Helpers ---

function toAttachmentResult(row: typeof journalAttachments.$inferSelect): JournalAttachmentResult {
  return {
    id: row.id,
    journalEntryId: row.journalEntryId,
    fileKey: row.fileKey,
    fileName: row.fileName,
    fileSize: row.fileSize,
    mimeType: row.mimeType,
    uploadedBy: row.uploadedBy,
    uploadedAt: row.uploadedAt.toISOString(),
  };
}

// --- Service functions ---

/**
 * Create an attachment metadata record after file upload completes.
 */
export async function createJournalAttachment(
  input: CreateJournalAttachmentInput,
  ctx: AuditContext,
): Promise<Result<JournalAttachmentResult>> {
  const parsed = CreateJournalAttachmentSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      AppError.validation('accounting.attachment.validationFailed', {
        issues: parsed.error.issues,
      }),
    );
  }
  const data = parsed.data;

  const permCheck = await requirePermission(ctx.userId, 'accounting.journal.create', {
    locationId: ctx.locationId,
  });
  if (!permCheck.ok) return permCheck;

  const je = await db
    .select({ id: journalEntries.id })
    .from(journalEntries)
    .where(
      and(eq(journalEntries.id, data.journalEntryId), eq(journalEntries.tenantId, ctx.tenantId)),
    )
    .limit(1);

  if (!je[0]) {
    return err(
      AppError.notFound('accounting.journal.notFound', { journalId: data.journalEntryId }),
    );
  }

  return tryCatch(
    async () => {
      const id = generateId();
      const rows = await db
        .insert(journalAttachments)
        .values({
          id,
          journalEntryId: data.journalEntryId,
          fileKey: data.fileKey,
          fileName: data.fileName,
          fileSize: data.fileSize,
          mimeType: data.mimeType,
          uploadedBy: ctx.userId,
        })
        .returning();

      await db.insert(auditLog).values({
        id: generateId(),
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        action: 'create',
        entityType: 'journal_attachment',
        entityId: id,
        before: null,
        after: {
          id,
          journalEntryId: data.journalEntryId,
          fileName: data.fileName,
          fileSize: data.fileSize,
          mimeType: data.mimeType,
        },
        metadata: { ip: ctx.ipAddress ?? null, userAgent: ctx.userAgent ?? null },
      });

      return toAttachmentResult(rows[0]!);
    },
    (e) => {
      if (e instanceof AppError) return e;
      return AppError.internal('accounting.attachment.createFailed', e);
    },
  );
}

/**
 * List all attachments for a journal entry.
 */
export async function listJournalAttachments(
  journalEntryId: string,
  ctx: AuditContext,
): Promise<Result<JournalAttachmentResult[]>> {
  const permCheck = await requirePermission(ctx.userId, 'accounting.view', {
    locationId: ctx.locationId,
  });
  if (!permCheck.ok) return permCheck;

  const je = await db
    .select({ id: journalEntries.id })
    .from(journalEntries)
    .where(and(eq(journalEntries.id, journalEntryId), eq(journalEntries.tenantId, ctx.tenantId)))
    .limit(1);

  if (!je[0]) {
    return err(AppError.notFound('accounting.journal.notFound', { journalId: journalEntryId }));
  }

  const rows = await db
    .select()
    .from(journalAttachments)
    .where(eq(journalAttachments.journalEntryId, journalEntryId));

  return ok(rows.map(toAttachmentResult));
}

/**
 * Delete an attachment record (soft — removes metadata; actual file cleanup deferred to worker).
 */
export async function deleteJournalAttachment(
  attachmentId: string,
  ctx: AuditContext,
): Promise<Result<void>> {
  const permCheck = await requirePermission(ctx.userId, 'accounting.journal.create', {
    locationId: ctx.locationId,
  });
  if (!permCheck.ok) return permCheck;

  const rows = await db
    .select()
    .from(journalAttachments)
    .where(eq(journalAttachments.id, attachmentId))
    .limit(1);

  const attachment = rows[0];
  if (!attachment) {
    return err(AppError.notFound('accounting.attachment.notFound', { attachmentId }));
  }

  return tryCatch(
    async () => {
      await db.delete(journalAttachments).where(eq(journalAttachments.id, attachmentId));

      await db.insert(auditLog).values({
        id: generateId(),
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        action: 'delete',
        entityType: 'journal_attachment',
        entityId: attachmentId,
        before: {
          fileName: attachment.fileName,
          fileKey: attachment.fileKey,
          journalEntryId: attachment.journalEntryId,
        },
        after: null,
        metadata: { ip: ctx.ipAddress ?? null, userAgent: ctx.userAgent ?? null },
      });

      return undefined;
    },
    (e) => {
      if (e instanceof AppError) return e;
      return AppError.internal('accounting.attachment.deleteFailed', e);
    },
  );
}

/**
 * Get a journal entry with its lines and attachments (for MCP).
 */
export async function getJournalWithAttachments(
  journalId: string,
  ctx: AuditContext,
): Promise<Result<JournalWithAttachmentsResult>> {
  const permCheck = await requirePermission(ctx.userId, 'accounting.view', {
    locationId: ctx.locationId,
  });
  if (!permCheck.ok) return permCheck;

  const jeRows = await db
    .select()
    .from(journalEntries)
    .where(and(eq(journalEntries.id, journalId), eq(journalEntries.tenantId, ctx.tenantId)))
    .limit(1);

  const je = jeRows[0];
  if (!je) {
    return err(AppError.notFound('accounting.journal.notFound', { journalId }));
  }

  const [lines, attachments] = await Promise.all([
    db.select().from(journalLines).where(eq(journalLines.journalEntryId, journalId)),
    db.select().from(journalAttachments).where(eq(journalAttachments.journalEntryId, journalId)),
  ]);

  return ok({
    journal: {
      id: je.id,
      number: je.number,
      postingDate: je.postingDate,
      description: je.description,
      status: je.status,
      totalDebit: je.totalDebit.toString(),
      totalCredit: je.totalCredit.toString(),
    },
    lines: lines.map((l) => ({
      id: l.id,
      lineNo: l.lineNo,
      accountId: l.accountId,
      description: l.description,
      debit: l.debit.toString(),
      credit: l.credit.toString(),
    })),
    attachments: attachments.map(toAttachmentResult),
  });
}
