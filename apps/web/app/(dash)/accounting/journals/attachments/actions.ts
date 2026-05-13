/**
 * journal-attachments — Server Actions for journal attachment UI.
 *
 * Wraps the journal-attachments service.
 * File upload is handled at API layer (R2/S3 presigned URLs).
 */

'use server';

import { getSession } from '@/lib/auth';
import {
  type JournalAttachmentResult,
  createJournalAttachment,
  deleteJournalAttachment,
  listJournalAttachments,
} from '@erp/services/accounting';
import type { AuditContext } from '@erp/shared/types';
import { redirect } from 'next/navigation';

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
  const result = await deleteJournalAttachment(attachmentId, ctx);
  if (!result.ok) return { error: result.error.message };
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
