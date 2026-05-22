'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { InlineAlert } from '@/components/confirm-dialog';
import { openPeriodAction } from './actions';

interface OpenPeriodDialogProps {
  onClose: () => void;
  copy: {
    openPeriod: string;
    openPeriodSubtitle: string;
    code: string;
    startDate: string;
    endDate: string;
  };
}

export function OpenPeriodDialog({ onClose, copy }: OpenPeriodDialogProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !isPending) onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, isPending]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    
    const periodCode = formData.get('periodCode') as string;
    const startDate = formData.get('startDate') as string;
    const endDate = formData.get('endDate') as string;

    startTransition(async () => {
      const result = await openPeriodAction({ periodCode, startDate, endDate });
      if (result.ok) {
        onClose();
        router.refresh();
      } else {
        setError(result.error ?? 'Unknown error occurred');
      }
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isPending) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-xl border border-brand-jade/15 bg-brand-paper p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-brand-ink">{copy.openPeriod}</h2>
        <p className="mt-2 text-sm text-brand-muted">{copy.openPeriodSubtitle}</p>
        
        {error && (
          <div className="mt-4">
            <InlineAlert message={error} tone="error" onDismiss={() => setError(null)} />
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-brand-ink">{copy.code}</label>
            <input
              name="periodCode"
              required
              pattern="^\d{4}-\d{2}$"
              placeholder="YYYY-MM"
              className="w-full rounded-md border border-brand-ink/20 px-3 py-2 text-sm"
              disabled={isPending}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-brand-ink">{copy.startDate}</label>
            <input
              name="startDate"
              type="date"
              required
              className="w-full rounded-md border border-brand-ink/20 px-3 py-2 text-sm"
              disabled={isPending}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-brand-ink">{copy.endDate}</label>
            <input
              name="endDate"
              type="date"
              required
              className="w-full rounded-md border border-brand-ink/20 px-3 py-2 text-sm"
              disabled={isPending}
            />
          </div>

          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="rounded-md border border-brand-jade/30 bg-brand-paper px-4 py-2 text-sm font-semibold text-brand-ink hover:bg-brand-jade-light disabled:opacity-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-md border border-brand-jade/30 bg-brand-jade px-4 py-2 text-sm font-semibold text-white hover:bg-brand-jade/90 disabled:opacity-50"
            >
              {isPending ? 'Menyimpan...' : copy.openPeriod}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
