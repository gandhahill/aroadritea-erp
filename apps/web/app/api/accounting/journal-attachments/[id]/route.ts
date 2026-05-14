import { getSession } from '@/lib/auth';
import { readJournalAttachmentFile } from '@/lib/journal-attachment-storage';
import { and, db, eq, journalAttachments, journalEntries } from '@erp/db';
import { requirePermission } from '@erp/services/iam';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const user = session.user as Record<string, unknown>;
  const userId = String(user.id ?? '');
  const tenantId = String(user.tenantId ?? 'default');

  const [row] = await db
    .select({
      id: journalAttachments.id,
      fileKey: journalAttachments.fileKey,
      fileName: journalAttachments.fileName,
      mimeType: journalAttachments.mimeType,
      locationId: journalEntries.locationId,
    })
    .from(journalAttachments)
    .innerJoin(journalEntries, eq(journalEntries.id, journalAttachments.journalEntryId))
    .where(and(eq(journalAttachments.id, id), eq(journalEntries.tenantId, tenantId)))
    .limit(1);

  if (!row) return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });

  const permitted = await requirePermission(userId, 'accounting.view', {
    locationId: row.locationId,
  });
  if (!permitted.ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const file = await readJournalAttachmentFile(row.fileKey);
    return new NextResponse(new Uint8Array(file), {
      headers: {
        'Content-Type': row.mimeType || 'application/octet-stream',
        'Content-Length': String(file.byteLength),
        'Content-Disposition': `attachment; filename="${safeHeaderFileName(row.fileName)}"`,
        'Cache-Control': 'private, max-age=0, no-store',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Attachment file not found' }, { status: 404 });
  }
}

function safeHeaderFileName(fileName: string): string {
  return fileName.replace(/["\\\r\n]/g, '_');
}
