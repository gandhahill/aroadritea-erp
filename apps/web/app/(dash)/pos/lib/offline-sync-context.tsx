/**
 * Offline Sync Context — wraps POS app with online/offline state + outbox status.
 *
 * Usage:
 *   <OfflineSyncProvider>
 *     <PosPage />
 *   </OfflineSyncProvider>
 *
 * Provides:
 *   - isOnline: boolean (heartbeat-based)
 *   - pendingCount: number (unsynced orders in outbox)
 *   - isSyncing: boolean (currently flushing outbox)
 *   - syncNow: () => Promise<void> (manual trigger)
 */

'use client';

import {
  type DbPendingOrder,
  countPendingOrders,
  flushOutbox,
  maxPendingOrderAttempts,
  startHeartbeat,
  startSyncScheduler,
} from '@erp/offline';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

// ─── Types ──────────────────────────────────────────────────────────────────────

interface OfflineSyncState {
  isOnline: boolean;
  pendingCount: number;
  isSyncing: boolean;
  failedRetryCount: number;
}

interface OfflineSyncActions {
  syncNow: () => Promise<void>;
  enqueueOrder: (
    order: Omit<
      DbPendingOrder,
      'attempts' | 'lastError' | 'nextRetryAt' | 'synced' | 'serverSaleNumber'
    >,
  ) => Promise<void>;
}

type OfflineSyncContextValue = OfflineSyncState & OfflineSyncActions;

const OfflineSyncContext = createContext<OfflineSyncContextValue | null>(null);

// ─── Provider ──────────────────────────────────────────────────────────────────

export function OfflineSyncProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [failedRetryCount, setFailedRetryCount] = useState(0);
  const cleanupRef = useRef<() => void>(() => {});

  const refreshOutboxStatus = useCallback(async () => {
    const [pending, failedRetries] = await Promise.all([
      countPendingOrders(),
      maxPendingOrderAttempts(),
    ]);
    setPendingCount(pending);
    setFailedRetryCount(failedRetries);
  }, []);

  // Start heartbeat + sync scheduler on mount
  useEffect(() => {
    // Initial pending count
    refreshOutboxStatus();

    // Heartbeat
    const stopHeartbeat = startHeartbeat((online) => {
      setIsOnline(online);
    });

    // Sync scheduler (online detection + outbox flush)
    const stopSync = startSyncScheduler();

    cleanupRef.current = () => {
      stopHeartbeat();
      stopSync();
    };

    return () => {
      cleanupRef.current();
    };
  }, [refreshOutboxStatus]);

  // Periodic refresh of pending count
  useEffect(() => {
    const interval = setInterval(async () => {
      await refreshOutboxStatus();
    }, 5000);
    return () => clearInterval(interval);
  }, [refreshOutboxStatus]);

  const syncNow = useCallback(async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      await flushOutbox();
      await refreshOutboxStatus();
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, refreshOutboxStatus]);

  const enqueueOrder = useCallback(
    async (
      order: Omit<
        DbPendingOrder,
        'attempts' | 'lastError' | 'nextRetryAt' | 'synced' | 'serverSaleNumber'
      >,
    ) => {
      // Dynamic import to avoid SSR issues (IndexedDB is browser-only)
      const { enqueueOrder: enq } = await import('@erp/offline');
      await enq({
        ...order,
        attempts: 0,
        lastError: null,
        nextRetryAt: null,
        synced: false,
        serverSaleNumber: null,
      });
      await refreshOutboxStatus();
    },
    [refreshOutboxStatus],
  );

  return (
    <OfflineSyncContext.Provider
      value={{ isOnline, pendingCount, isSyncing, failedRetryCount, syncNow, enqueueOrder }}
    >
      {children}
    </OfflineSyncContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useOfflineSync(): OfflineSyncContextValue {
  const ctx = useContext(OfflineSyncContext);
  if (!ctx) {
    throw new Error('useOfflineSync must be used inside <OfflineSyncProvider>');
  }
  return ctx;
}
