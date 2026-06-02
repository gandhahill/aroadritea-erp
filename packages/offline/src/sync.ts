/**
 * POS sync engine — client-side offline queue management
 *
 * SD §35.1.1:
 * - Heartbeat: ping GET /api/healthz every 60 seconds
 * - Outbox flush: Background Sync API when available; fallback setInterval 30s
 * - Exponential backoff: 30 → 60 → 120 → 300 → 600s (cap 1 hour)
 * - Idempotency: header Idempotency-Key: <client_order_uuid>
 * - UX: "Offline — N transaksi pending sync" (yellow banner)
 *
 * This module is the bridge between IndexedDB outbox and the server sync API.
 */

import {
  type DbPendingOrder,
  getPendingOrders,
  markOrderRetry,
  markOrderSynced,
} from './indexeddb';

// ─── Config ───────────────────────────────────────────────────────────────────

/** Cap for exponential backoff in milliseconds (1 hour). */
const BACKOFF_CAP_MS = 60 * 60 * 1000;

/** Base backoff in milliseconds (30 seconds). */
const BACKOFF_BASE_MS = 30 * 1000;

/** Heartbeat interval in milliseconds (60 seconds). */
const HEARTBEAT_INTERVAL_MS = 60 * 1000;

/** Sync attempt interval fallback in milliseconds (30 seconds). */
const SYNC_INTERVAL_MS = 30 * 1000;

/** Server sync endpoint. */
const SYNC_ENDPOINT = '/api/sync/pos';

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** Compute exponential backoff delay for a given attempt count. */
function backoffDelay(attempts: number): number {
  const delay = BACKOFF_BASE_MS * Math.pow(2, attempts);
  return Math.min(delay, BACKOFF_CAP_MS);
}

/** Check if a pending order is ready to retry (nextRetryAt has passed). */
function isReadyToRetry(order: DbPendingOrder): boolean {
  if (!order.nextRetryAt) return true; // never tried or cleared
  return new Date(order.nextRetryAt) <= new Date();
}

// ─── Core sync ────────────────────────────────────────────────────────────────

/**
 * Flush one order to the server.
 * Uses the client_order_uuid as Idempotency-Key to guarantee at-most-once semantics.
 *
 * Returns true if the order was synced successfully (or was already synced).
 */
async function syncOrder(order: DbPendingOrder): Promise<boolean> {
  try {
    const response = await fetch(SYNC_ENDPOINT, {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': order.clientOrderUuid,
      },
      body: JSON.stringify({
        clientOrderUuid: order.clientOrderUuid,
        createdAtClient: order.createdAtClient,
        payload: order.payload,
      }),
    });

    if (response.ok) {
      const data = (await response.json()) as { saleNumber?: string };
      await markOrderSynced(order.clientOrderUuid, data.saleNumber ?? '');
      return true;
    }

    if (response.status === 409) {
      // Already processed (idempotent duplicate) — treat as success
      const data = (await response.json()) as { saleNumber?: string };
      await markOrderSynced(order.clientOrderUuid, data.saleNumber ?? '');
      return true;
    }

    if (response.status === 422 || response.status === 400) {
      // Keep validation failures pending; stale master data or server config can be fixed.
      const errorBody = await response.text().catch(() => 'validation error');
      await markOrderRetry(
        order.clientOrderUuid,
        `[${response.status}] ${errorBody}`,
        new Date(Date.now() + BACKOFF_CAP_MS).toISOString(),
      );
      return false;
    }

    // 5xx or network error — retry with backoff
    const nextRetryAt = new Date(Date.now() + backoffDelay(order.attempts)).toISOString();
    await markOrderRetry(order.clientOrderUuid, `HTTP ${response.status}`, nextRetryAt);
    return false;
  } catch (err) {
    // Network error
    const nextRetryAt = new Date(Date.now() + backoffDelay(order.attempts)).toISOString();
    await markOrderRetry(
      order.clientOrderUuid,
      err instanceof Error ? err.message : 'network error',
      nextRetryAt,
    );
    return false;
  }
}

/**
 * Flush all ready pending orders to the server.
 * Called on: app startup, online event, and periodic interval.
 */
export async function flushOutbox(): Promise<{ synced: number; failed: number }> {
  const pending = await getPendingOrders();
  const ready = pending.filter(isReadyToRetry);

  let synced = 0;
  let failed = 0;

  // Sync one at a time to avoid overwhelming the server
  for (const order of ready) {
    const success = await syncOrder(order);
    if (success) synced++;
    else failed++;
  }

  return { synced, failed };
}

// ─── Online detection ─────────────────────────────────────────────────────────

/** Check network connectivity via navigator.onLine + heartbeat. */
async function isOnline(): Promise<boolean> {
  if (!navigator.onLine) return false;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    const res = await fetch('/api/healthz', {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return res.ok;
  } catch {
    return false;
  }
}

// ─── Background Sync (Service Worker integration) ──────────────────────────────
// Serwist supports BackgroundSyncAPI via `BackgroundSyncPlugin`.
// The actual SW registration happens in service-worker/index.ts.
// This file exposes a function the SW can call via postMessage.

/**
 * Register Background Sync event in the service worker.
 * Fallback: start an interval-based sync loop when BackgroundSync is unavailable.
 */
export function startSyncScheduler(): () => void {
  // Try to use Background Sync API via service worker message
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({ type: 'SYNC_ORDERS' });
  }

  // Fallback: polling interval (works in all browsers, even if SW not ready)
  const intervalId = setInterval(async () => {
    if (await isOnline()) {
      await flushOutbox();
    }
  }, SYNC_INTERVAL_MS);

  // Also flush immediately when coming back online
  const handleOnline = () => {
    void flushOutbox();
  };
  window.addEventListener('online', handleOnline);

  // Return cleanup function
  return () => {
    clearInterval(intervalId);
    window.removeEventListener('online', handleOnline);
  };
}

// ─── Heartbeat ────────────────────────────────────────────────────────────────

/**
 * Start network heartbeat (ping /api/healthz every 60s).
 * This is separate from sync — it's just to update the UI online/offline state.
 */
export function startHeartbeat(onStatusChange: (online: boolean) => void): () => void {
  let lastOnline = navigator.onLine;

  const intervalId = setInterval(async () => {
    const online = await isOnline();
    if (online !== lastOnline) {
      lastOnline = online;
      onStatusChange(online);
    }
  }, HEARTBEAT_INTERVAL_MS);

  const handleOnline = () => onStatusChange(true);
  const handleOffline = () => onStatusChange(false);
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  return () => {
    clearInterval(intervalId);
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}
