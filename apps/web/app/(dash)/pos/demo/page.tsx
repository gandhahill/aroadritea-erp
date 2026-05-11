/**
 * Demo POS Page — entry point for `/pos/demo`
 *
 * If demo mode not yet activated: shows activation screen (snapshot master data).
 * If master data missing/stale: shows error with refresh button.
 * If activated: renders DemoPosClient with full demo POS.
 */

'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useDemoMode } from './demo-mode-context';
import { DemoPosClient } from './demo-pos-client';
import { hasNoMasterData } from '@erp/offline';

export default function DemoPosPage() {
  const t = useTranslations('pos');
  const {
    isDemoMode,
    activateDemo,
    snapshotLoading,
    snapshotError,
    refreshSnapshot,
  } = useDemoMode();

  const [initializing, setInitializing] = useState(true);
  const [noMasterData, setNoMasterData] = useState(false);

  // Auto-activate demo mode on page load
  useEffect(() => {
    async function init() {
      if (!isDemoMode && !snapshotLoading) {
        await activateDemo();
      }
      // Check if master data is available
      const empty = await hasNoMasterData();
      setNoMasterData(empty);
      setInitializing(false);
    }
    init();
  }, [isDemoMode, snapshotLoading, activateDemo]);

  // Loading state
  if (initializing || snapshotLoading) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center">
        <div className="mb-4 h-10 w-10 animate-spin rounded-full border-4 border-brand-cream-3 border-t-brand-red" />
        <p className="text-sm text-brand-ink-3">{t('demo.loadingSnapshot')}</p>
        <p className="mt-1 text-xs text-brand-ink-3">Memuat data master dari IndexedDB...</p>
      </div>
    );
  }

  // Error state (snapshot failed)
  if (snapshotError) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-6">
        <div className="mb-4 rounded-full bg-red-100 p-4">
          <svg className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
        </div>
        <h2 className="mb-2 text-lg font-semibold text-brand-ink">{t('demo.snapshotFailed')}</h2>
        <p className="mb-1 text-sm text-red-600">{snapshotError}</p>
        <p className="mb-6 text-center text-xs text-brand-ink-3">
          Pastikan Anda sudah pernah menggunakan POS produksi.<br />
          Data master (produk, harga, modifier) harus tersimpan di IndexedDB browser.
        </p>
        <button
          onClick={refreshSnapshot}
          className="rounded-lg bg-brand-red px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-red-dark"
        >
          {t('demo.retrySnapshot')}
        </button>
      </div>
    );
  }

  // No master data (production IndexedDB empty)
  if (noMasterData) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-6">
        <div className="mb-4 rounded-full bg-yellow-100 p-4">
          <svg className="h-8 w-8 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
          </svg>
        </div>
        <h2 className="mb-2 text-lg font-semibold text-brand-ink">{t('demo.noMasterData')}</h2>
        <p className="mb-6 text-center text-sm text-brand-ink-3">
          Data master POS belum tersedia.<br />
          Buka POS produksi terlebih dahulu untuk memuat data, lalu kembali ke mode demo.
        </p>
        <a
          href="/pos"
          className="rounded-lg border border-brand-cream-3 px-6 py-2.5 text-sm font-medium text-brand-ink hover:bg-brand-cream-2"
        >
          {t('demo.openProductionPOS')}
        </a>
      </div>
    );
  }

  // Demo mode active — render full demo POS
  return <DemoPosClient />;
}
