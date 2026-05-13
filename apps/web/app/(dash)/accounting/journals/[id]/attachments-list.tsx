/**
 * JournalAttachmentsList — client component for journal attachment UI.
 *
 * Lists attachments for a journal entry, supports delete, and shows
 * upload button (actual upload deferred to R2/S3 API layer).
 */

'use client';

import { useState, useTransition } from 'react';
import { createAttachmentAction, deleteAttachmentAction } from '../attachments/actions';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Number.parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

interface Attachment {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  uploadedBy: string | null;
  uploadedAt: string;
}

interface Props {
  journalEntryId: string;
  initialAttachments: Attachment[];
}

export function JournalAttachmentsList({ journalEntryId, initialAttachments }: Props) {
  const [attachments, setAttachments] = useState<Attachment[]>(initialAttachments);
  const [isPending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showUploadInfo, setShowUploadInfo] = useState(false);

  async function handleDelete(attachmentId: string) {
    if (!confirm('Hapus lampiran ini?')) return;
    setDeletingId(attachmentId);
    startTransition(async () => {
      const result = await deleteAttachmentAction(attachmentId);
      if (result.error) {
        alert(`Gagal menghapus: ${result.error}`);
      } else {
        setAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
      }
      setDeletingId(null);
    });
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-brand-ink">Lampiran</h3>
          <p className="mt-0.5 text-xs text-brand-ink-3">Bukti transaksi atau dokumen pendukung.</p>
        </div>
        <button
          onClick={() => setShowUploadInfo((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-brand-cream-3 bg-white px-3 py-1.5 text-xs font-medium text-brand-ink transition-colors hover:bg-brand-cream-1"
        >
          <svg
            className="h-3.5 w-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
            />
          </svg>
          Unggah Lampiran
        </button>
      </div>

      {/* Upload info panel */}
      {showUploadInfo && (
        <div className="rounded-lg border border-brand-gold/30 bg-brand-gold/5 px-4 py-3">
          <p className="text-sm font-medium text-brand-ink">Unggah Lampiran</p>
          <p className="mt-1 text-xs text-brand-ink-3">
            Upload file via R2/S3 presigned URL. API endpoint{' '}
            <code className="rounded bg-brand-cream-2 px-1 py-0.5 text-xs">
              POST /api/files/upload
            </code>{' '}
            akan diaktifkan setelah penyimpanan objek dikonfigurasi. Hubungi administrator.
          </p>
          <button
            onClick={() => setShowUploadInfo(false)}
            className="mt-2 text-xs text-brand-ember-5 hover:underline"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Attachment list */}
      {attachments.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-brand-cream-3 py-8 text-center">
          <svg
            className="h-8 w-8 text-brand-cream-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
            />
          </svg>
          <p className="mt-2 text-sm text-brand-ink-3">Belum ada lampiran.</p>
        </div>
      ) : (
        <ul className="divide-y divide-brand-cream-2 rounded-lg border border-brand-cream-3 overflow-hidden">
          {attachments.map((att) => (
            <li key={att.id} className="flex items-center gap-3 bg-card px-4 py-3">
              {/* File icon */}
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-brand-cream-2">
                <svg
                  className="h-4.5 w-4.5 text-brand-ink-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                  />
                </svg>
              </div>

              {/* File info */}
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-medium text-brand-ink" title={att.fileName}>
                  {att.fileName}
                </p>
                <p className="text-xs text-brand-ink-3">
                  {formatBytes(att.fileSize)} &middot; {att.mimeType} &middot;{' '}
                  {formatDate(att.uploadedAt)}
                  {att.uploadedBy && ` &middot; oleh ${att.uploadedBy}`}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <button className="inline-flex items-center gap-1 rounded-md border border-brand-cream-3 bg-white px-2.5 py-1.5 text-xs font-medium text-brand-ember-5 transition-colors hover:bg-brand-ember-5 hover:text-white">
                  <svg
                    className="h-3.5 w-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
                    />
                  </svg>
                  Unduh
                </button>
                <button
                  onClick={() => handleDelete(att.id)}
                  disabled={deletingId === att.id || isPending}
                  className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-white px-2.5 py-1.5 text-xs font-medium text-rose-500 transition-colors hover:bg-rose-50 disabled:opacity-50"
                >
                  {deletingId === att.id ? (
                    <>
                      <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                      </svg>
                      Menghapus...
                    </>
                  ) : (
                    <>
                      <svg
                        className="h-3.5 w-3.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                      Hapus
                    </>
                  )}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
