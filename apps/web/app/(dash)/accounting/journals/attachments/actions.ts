/**
 * journal-attachments — Server Actions for journal attachment UI.
 *
 * Wraps the journal-attachments service and stores uploaded files on the
 * server filesystem or JOURNAL_UPLOAD_DIR.
 */

'use server';

import { getSession } from '@/lib/auth';
import {
  createJournalAttachmentFileKey,
  deleteJournalAttachmentFile,
  writeJournalAttachmentFile,
} from '@/lib/journal-attachment-storage';
import { db, eq, journalAttachments } from '@erp/db';
import {
  createJournalAttachment,
  deleteJournalAttachment,
  listJournalAttachments,
} from '@erp/services/accounting';
import type { AuditContext } from '@erp/shared/types';
import { redirect } from 'next/navigation';

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

function buildCtx(session: Awaited<ReturnType<typeof getSession>>): AuditContext {
  const user = session?.user as Record<string, unknown> | null;
  return {
    userId: (user?.id as string) ?? 'unknown',
    tenantId: (user?.tenantId as string) ?? 'default',
    locationId: (user?.locationId as string) ?? '',
  };
}

export async function fetchJournalAttachments(journalEntryId: string) {
  const session = await getSession();
  if (!session) redirect('/login');

  const ctx = buildCtx(session);
  const result = await listJournalAttachments(journalEntryId, ctx);
  if (!result.ok) return { error: result.error.message };
  return { data: result.value };
}

export async function deleteAttachmentAction(attachmentId: string) {
  const session = await getSession();
  if (!session) redirect('/login');

  const ctx = buildCtx(session);
  const [attachment] = await db
    .select({ fileKey: journalAttachments.fileKey })
    .from(journalAttachments)
    .where(eq(journalAttachments.id, attachmentId))
    .limit(1);

  const result = await deleteJournalAttachment(attachmentId, ctx);
  if (!result.ok) return { error: result.error.message };
  if (attachment?.fileKey) await deleteJournalAttachmentFile(attachment.fileKey);
  return { data: result.value };
}

export async function createAttachmentAction(input: {
  journalEntryId: string;
  fileKey: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}) {
  const session = await getSession();
  if (!session) redirect('/login');

  const ctx = buildCtx(session);
  const result = await createJournalAttachment(input, ctx);
  if (!result.ok) return { error: result.error.message };
  return { data: result.value };
}

export async function uploadAttachmentAction(formData: FormData) {
  const session = await getSession();
  if (!session) redirect('/login');

  const journalEntryId = String(formData.get('journalEntryId') ?? '');
  const file = formData.get('file');
  if (!journalEntryId) return { error: 'Journal entry ID wajib ada.' };
  if (!(file instanceof File) || file.size === 0) return { error: 'Pilih file lampiran.' };
  if (file.size > MAX_ATTACHMENT_BYTES) return { error: 'Ukuran file maksimal 10 MB.' };

  const fileKey = createJournalAttachmentFileKey(journalEntryId, file.name);
  await writeJournalAttachmentFile(fileKey, file);

  const ctx = buildCtx(session);
  const result = await createJournalAttachment(
    {
      journalEntryId,
      fileKey,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type || 'application/octet-stream',
    },
    ctx,
  );
  if (!result.ok) {
    await deleteJournalAttachmentFile(fileKey);
    return { error: result.error.message };
  }
  return { data: result.value };
}
