import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const LOCAL_FILE_PREFIX = 'local:';

export function createJournalAttachmentFileKey(journalEntryId: string, fileName: string): string {
  return `${LOCAL_FILE_PREFIX}${journalEntryId}/${randomUUID()}-${sanitizeFileName(fileName)}`;
}

export async function writeJournalAttachmentFile(fileKey: string, file: File): Promise<void> {
  const filePath = resolveLocalFilePath(fileKey);
  await mkdir(path.dirname(filePath), { recursive: true });
  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(filePath, bytes, { flag: 'wx' });
}

export async function readJournalAttachmentFile(fileKey: string): Promise<Buffer> {
  return readFile(resolveLocalFilePath(fileKey));
}

export async function statJournalAttachmentFile(fileKey: string) {
  return stat(resolveLocalFilePath(fileKey));
}

export async function deleteJournalAttachmentFile(fileKey: string): Promise<void> {
  await rm(resolveLocalFilePath(fileKey), { force: true });
}

function resolveLocalFilePath(fileKey: string): string {
  if (!fileKey.startsWith(LOCAL_FILE_PREFIX)) {
    throw new Error('Unsupported journal attachment storage key.');
  }

  const relativeKey = fileKey.slice(LOCAL_FILE_PREFIX.length);
  const root = path.resolve(
    process.env.JOURNAL_UPLOAD_DIR ??
      path.join(process.cwd(), '..', '..', 'storage', 'journal-attachments'),
  );
  const resolved = path.resolve(root, relativeKey);

  if (!resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error('Invalid journal attachment storage key.');
  }

  return resolved;
}

function sanitizeFileName(fileName: string): string {
  const cleaned = fileName.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  return cleaned || 'attachment';
}
