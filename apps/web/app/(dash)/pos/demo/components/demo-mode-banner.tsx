/**
 * Demo Mode Banner — "MODE DEMO" fixed top banner.
 *
 * ADR-0008:
 * - Background: brand-red (brand-primary), text white
 * - Fixed top, dismissable only by exiting demo mode
 * - Shows "MODE DEMO — Transaksi tidak masuk sistem"
 * - Also shows stale master data warning if applicable
 */

'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useDemoMode } from '../demo-mode-context';

interface DemoModeBannerProps {
  pendingCount?: number;
}

export function DemoModeBanner({ pendingCount }: DemoModeBannerProps) {
  const t = useTranslations('pos');
  const { isMasterStale, masterSnapshotAge, refreshSnapshot } = useDemoMode();
  const { isMasterStale: stale, masterSnapshotAge: age } = { isMasterStale, masterSnapshotAge };

  return (
    <div className="fixed inset-x-0 top-0 z-[100] flex items-center justify-between gap-2 bg-brand-red px-3 py-2 text-sm font-medium text-white shadow-lg">
      {/* Left: demo label */}
      <div className="flex items-center gap-2">
        <span className="inline-block rounded bg-white/20 px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-white">
          DEMO
        </span>
        <span className="text-sm font-medium text-white/90">{t('demo.bannerLabel')}</span>
      </div>

      {/* Right: stale warning + pending count */}
      <div className="flex items-center gap-3">
        {stale && (
          <button
            onClick={refreshSnapshot}
            className="flex items-center gap-1 rounded bg-yellow-500/20 px-2 py-0.5 text-xs text-yellow-100 hover:bg-yellow-500/30"
            title={age ? `${t('demo.staleData')} (${age})` : t('demo.staleData')}
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
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
              />
            </svg>
            {t('demo.refreshMaster')}
          </button>
        )}
        {pendingCount !== undefined && pendingCount > 0 && (
          <span className="rounded bg-yellow-500/20 px-2 py-0.5 text-xs font-medium text-yellow-100">
            {pendingCount} {t('demo.pendingOrders')}
          </span>
        )}
      </div>
    </div>
  );
}
