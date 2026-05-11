/**
 * Demo Reset / Exit Modal — "Reset Demo" and "Keluar Mode Demo" actions.
 *
 * ADR-0008:
 * - "Reset Demo": wipes demo order history only (keeps master snapshot)
 * - "Keluar Mode Demo": wipes entire `aroadri-pos-demo` + redirects to /pos
 */

'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useDemoMode } from '../demo-mode-context';
import { useRouter } from 'next/navigation';
import { wipeDemoDb } from '@erp/offline';

interface DemoResetModalProps {
  onClose: () => void;
}

export function DemoResetModal({ onClose }: DemoResetModalProps) {
  const t = useTranslations('pos');
  const { clearDemoOrders } = useDemoMode();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleResetDemoOrders() {
    clearDemoOrders();
    onClose();
  }

  function handleExitDemoMode() {
    startTransition(async () => {
      try {
        await wipeDemoDb();
        router.push('/pos');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Exit failed');
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 flex w-full max-w-sm flex-col rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
        <div className="border-b border-brand-cream-3 px-5 py-4">
          <h2 className="text-base font-semibold text-brand-ink">{t('demo.demoSettings')}</h2>
        </div>

        <div className="flex flex-col gap-3 p-5">
          {/* Reset demo orders only */}
          <button
            onClick={handleResetDemoOrders}
            className="flex items-center gap-3 rounded-lg border border-brand-cream-3 bg-brand-cream-2 px-4 py-3 text-left transition-all hover:border-brand-cream-3 hover:bg-brand-cream-3"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-cream-3 text-sm">
              <svg className="h-4 w-4 text-brand-ink-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
            </span>
            <div>
              <p className="text-sm font-medium text-brand-ink">{t('demo.resetDemo')}</p>
              <p className="text-xs text-brand-ink-3">{t('demo.resetDemoDesc')}</p>
            </div>
          </button>

          {/* Exit demo mode */}
          <button
            onClick={handleExitDemoMode}
            disabled={isPending}
            className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-left transition-all hover:border-red-300 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100 text-sm">
              <svg className="h-4 w-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75" />
              </svg>
            </span>
            <div>
              <p className="text-sm font-semibold text-red-700">{t('demo.exitDemoMode')}</p>
              <p className="text-xs text-red-500">{t('demo.exitDemoModeDesc')}</p>
            </div>
          </button>

          {error && (
            <p className="rounded-md bg-red-50 p-3 text-xs text-red-700">{error}</p>
          )}
        </div>

        <div className="border-t border-brand-cream-3 p-5">
          <button
            onClick={onClose}
            className="h-10 w-full rounded-lg border border-brand-cream-3 text-sm font-medium text-brand-ink-2 hover:bg-brand-cream-2"
          >
            {t('cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}
