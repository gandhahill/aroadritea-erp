/**
 * Offline Banner — "X transaksi pending sync" warning
 *
 * SD §35.1.1:
 * - Offline: banner kuning "Offline — N transaksi pending sync"
 * - Online: hide banner
 * - Red notification if 3 consecutive retries failed (with "Coba lagi sekarang" button)
 */

'use client';

import { useTranslations } from 'next-intl';
import { useOfflineSync } from '../lib/offline-sync-context';

export function OfflineBanner() {
  const t = useTranslations('pos.offline');
  const { isOnline, pendingCount, isSyncing, syncNow } = useOfflineSync();

  if (isOnline && pendingCount === 0) return null;

  const isOffline = !isOnline;
  const isCritical = false; // TODO: track consecutive failures > 3

  const bgClass = isCritical
    ? 'bg-red-600 text-white'
    : isOffline
      ? 'bg-amber-400 text-amber-950'
      : 'bg-amber-100 text-amber-800';

  return (
    <div
      className={`flex items-center justify-center gap-3 px-4 py-2 text-sm font-medium ${bgClass}`}
    >
      {isOffline ? (
        <span>{t('offlineMessage', { count: pendingCount })}</span>
      ) : (
        <span>{t('pendingMessage', { count: pendingCount })}</span>
      )}

      {isSyncing && <span className="text-xs opacity-80">{t('syncing')}</span>}

      {!isSyncing && pendingCount > 0 && (
        <button
          type="button"
          onClick={syncNow}
          className="ml-2 rounded px-2 py-0.5 text-xs font-semibold underline underline-offset-2 hover:opacity-80"
        >
          {t('retryNow')}
        </button>
      )}
    </div>
  );
}
