/**
 * Service Worker — Serwist v9 (SD §14, §35.1.1)
 *
 * Source file: service-worker/index.ts
 * Built to: public/sw.js (via @serwist/next InjectManifest plugin)
 *
 * Offline strategy:
 * - Pre-cache: all /pos/* routes, fonts, logo (build time via globPatterns)
 * - Runtime: network-first for GET, cache fallback
 * - Background sync: POST /api/sync/pos via syncOrder() via message from client
 * - Fallback page: /~offline (custom offline page)
 *
 * ⚠️ ADR-0008: Do NOT sync from `aroadri-pos-demo` IndexedDB.
 * The sync engine lives client-side (packages/offline/sync.ts) and only
 * targets `aroadri-pos` (production). The SW only handles navigation/documents.
 *
 * Usage: `SerwistProvider` from `@serwist/next/react` handles registration.
 */

import { defaultCache } from '@serwist/next/worker';
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist';
import { Serwist } from 'serwist';

declare const self: ServiceWorkerGlobalScope;

// Declare the injection point manifest — Serwist injects the precache
// manifest array here during the build step (injectionPoint: 'self.__SW_MANIFEST')
declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  // Runtime caching strategies per route type (SD §35.1.1)
  runtimeCaching: defaultCache,
  // Fallback for navigation requests when offline
  fallbacks: {
    entries: [
      {
        url: '/~offline',
        matcher({ request }) {
          return request.destination === 'document';
        },
      },
    ],
  },
});

// Register message handler for manual sync trigger from client
self.addEventListener('message', (event: ExtendableMessageEvent) => {
  if (event.data?.type === 'SYNC_ORDERS') {
    // Forward sync request to the client-side sync engine
    // The client monitors pending_orders in IndexedDB and calls /api/sync/pos
    // Here we just broadcast back that sync is triggered
    // Real sync happens client-side (IndexedDB → fetch → server)
    event.waitUntil(
      self.clients.matchAll({ type: 'window' }).then((clients) => {
        for (const client of [...clients]) {
          client.postMessage({ type: 'SYNC_TRIGGERED' });
        }
      }),
    );
  }
});

serwist.addEventListeners();
