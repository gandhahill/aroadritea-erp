'use client';

import { useEffect } from 'react';

interface ConfirmDialogProps {
  message: string;
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'default';
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Brand-styled confirmation dialog. Replaces browser-native window.confirm().
 * Renders as a fixed overlay with a centered card; closes on Escape or backdrop click.
 */
export function ConfirmDialog({
  message,
  title = 'Konfirmasi',
  confirmLabel = 'Ya, lanjutkan',
  cancelLabel = 'Batal',
  tone = 'danger',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const confirmClasses =
    tone === 'danger'
      ? 'border-rose-200 bg-rose-600 text-white hover:bg-rose-700'
      : 'border-brand-jade/30 bg-brand-jade text-white hover:bg-brand-jade/90';

  return (
    <dialog
      open
      aria-labelledby="confirm-dialog-title"
      className="fixed inset-0 z-50 flex h-full w-full max-w-none items-center justify-center border-0 bg-black/40 px-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="w-full max-w-md rounded-xl border border-brand-jade/15 bg-brand-paper p-6 shadow-xl">
        <h2 id="confirm-dialog-title" className="text-base font-semibold text-brand-ink">
          {title}
        </h2>
        <p className="mt-2 whitespace-pre-line text-sm text-brand-ink/80">{message}</p>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-brand-jade/30 bg-brand-paper px-3 py-1.5 text-xs font-semibold text-brand-ink hover:bg-brand-jade-light"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors ${confirmClasses}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}

interface InlineAlertProps {
  message: string;
  tone?: 'error' | 'success' | 'info';
  onDismiss?: () => void;
}

/**
 * Inline alert banner. Replaces browser-native window.alert() in non-blocking flows.
 */
export function InlineAlert({ message, tone = 'error', onDismiss }: InlineAlertProps) {
  const toneClasses =
    tone === 'error'
      ? 'border-rose-200 bg-rose-50 text-rose-700'
      : tone === 'success'
        ? 'border-brand-jade/30 bg-brand-jade-light text-brand-jade'
        : 'border-brand-jade/20 bg-brand-paper text-brand-ink';

  return (
    <div
      role="alert"
      className={`flex items-start justify-between gap-3 rounded-md border px-3 py-2 text-xs font-medium ${toneClasses}`}
    >
      <span className="whitespace-pre-line">{message}</span>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 text-xs font-semibold underline-offset-2 hover:underline"
          aria-label="Tutup pesan"
        >
          Tutup
        </button>
      )}
    </div>
  );
}
