'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { InlineAlert } from '@/components/confirm-dialog';
import { useTranslations } from 'next-intl';
import { closePeriodAction } from './actions';

interface ClosePeriodDialogProps {
  periodCode: string;
  draftCount: number;
  onClose: () => void;
  copy: {
    closePeriod: string;
    confirmClose: string;
    confirmCloseMessage: string;
    forceClose: string;
    draftWarning: string;
  };
}

export function ClosePeriodDialog({ periodCode, draftCount, onClose, copy }: ClosePeriodDialogProps) {
  const router = useRouter();
  const tc = useTranslations('common');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [force, setForce] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !isPending) onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, isPending]);

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const result = await closePeriodAction({ periodCode, force });
      if (result.ok) {
        onClose();
        router.refresh();
      } else {
        setError(result.error ?? 'Unknown error occurred');
      }
    });
  }

  const hasDrafts = draftCount > 0;
  const warningText = copy.draftWarning.replace('{count}', String(draftCount));

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isPending) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-xl border border-rose-200 bg-brand-paper p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-brand-ink">{copy.confirmClose} ({periodCode})</h2>
        <p className="mt-2 text-sm text-brand-ink/80">{copy.confirmCloseMessage}</p>

        {hasDrafts && (
          <div className="mt-4">
            <InlineAlert message={warningText} tone="error" />
            <div className="mt-3 flex items-center gap-2">
              <input 
                type="checkbox" 
                id="forceClose" 
                checked={force}
                onChange={(e) => setForce(e.target.checked)}
                disabled={isPending}
                className="h-4 w-4 rounded border-gray-300 text-rose-600 focus:ring-rose-600"
              />
              <label htmlFor="forceClose" className="text-sm font-medium text-brand-ink">
                {copy.forceClose}
              </label>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4">
            <InlineAlert message={error} tone="error" onDismiss={() => setError(null)} />
          </div>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="rounded-md border border-brand-jade/30 bg-brand-paper px-4 py-2 text-sm font-semibold text-brand-ink hover:bg-brand-jade-light disabled:opacity-50"
          >
            {tc('actions.cancel')}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isPending || (hasDrafts && !force)}
            className="rounded-md border border-rose-200 bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
          >
            {isPending ? 'Menyimpan...' : copy.closePeriod}
          </button>
        </div>
      </div>
    </div>
  );
}
