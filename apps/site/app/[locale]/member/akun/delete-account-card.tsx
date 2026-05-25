'use client';

/**
 * Delete account card — UU PDP / E23.
 *
 * Two-step deletion to avoid accidental clicks:
 *   1. User clicks "Hapus akun saya" → expands a textarea + confirm input.
 *   2. User must type the literal word "HAPUS" and (optionally) a
 *      reason → the server anonymises PII, clears the cookie, then
 *      redirects to /member/daftar.
 *
 * The server action handles every step; this component only
 * orchestrates the UX so the destructive operation cannot fire from a
 * single tap.
 */

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { deleteMyAccountAction } from '../../../../actions/member';

interface Props {
  locale: string;
  labels: {
    sectionTitle: string;
    sectionBody: string;
    openButton: string;
    confirmInputLabel: string;
    confirmInputHint: string;
    reasonLabel: string;
    reasonPlaceholder: string;
    cancel: string;
    commit: string;
    success: string;
  };
}

export function DeleteAccountCard({ locale, labels }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await deleteMyAccountAction({
        confirmation,
        reason: reason.trim() || undefined,
      });
      if (!res.success) {
        setError(res.error ?? 'Penghapusan gagal.');
        return;
      }
      setSuccess(true);
      // Slight delay so the user reads the confirmation banner.
      setTimeout(() => router.push(`/${locale}/member/daftar`), 1500);
    });
  }

  if (success) {
    return (
      <div className="mt-8 rounded-lg border border-emerald-300 bg-emerald-50 p-6 text-sm text-emerald-800">
        ✅ {labels.success}
      </div>
    );
  }

  return (
    <section className="mt-12 rounded-lg border border-rose-200 bg-rose-50/50 p-6">
      <h2 className="text-base font-semibold text-rose-700">{labels.sectionTitle}</h2>
      <p className="mt-2 text-sm leading-6 text-rose-800/80">{labels.sectionBody}</p>

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-4 rounded-md border border-rose-300 bg-white px-4 py-2 text-sm font-medium text-rose-700 hover:bg-rose-100"
        >
          {labels.openButton}
        </button>
      ) : (
        <form onSubmit={submit} className="mt-4 space-y-3">
          <label className="block text-sm">
            <span className="font-medium text-rose-700">{labels.reasonLabel}</span>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={labels.reasonPlaceholder}
              rows={2}
              maxLength={200}
              className="mt-1 w-full rounded-md border border-rose-200 bg-white px-3 py-2 text-sm text-brand-ink focus:border-rose-500 focus:outline-none"
            />
          </label>

          <label className="block text-sm">
            <span className="font-medium text-rose-700">{labels.confirmInputLabel}</span>
            <input
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              placeholder="HAPUS"
              required
              className="mt-1 w-full rounded-md border border-rose-200 bg-white px-3 py-2 text-sm uppercase tracking-widest text-rose-700 focus:border-rose-500 focus:outline-none"
            />
            <p className="mt-1 text-xs text-rose-700/70">{labels.confirmInputHint}</p>
          </label>

          {error ? (
            <div className="rounded-md border border-rose-300 bg-rose-100 px-3 py-2 text-xs text-rose-800">
              {error}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={pending || confirmation !== 'HAPUS'}
              className="rounded-md bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
            >
              {pending ? '…' : labels.commit}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setConfirmation('');
                setReason('');
                setError(null);
              }}
              disabled={pending}
              className="rounded-md border border-rose-200 bg-white px-4 py-2 text-sm text-rose-700 hover:bg-rose-100"
            >
              {labels.cancel}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
