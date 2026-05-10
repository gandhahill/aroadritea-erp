# T-0061 Checkpoint — PWA Setup: Serwist + IndexedDB outbox + offline sync

**Status**: 🟨 IN PROGRESS
**Started**: 2026-05-10
**Owner**: Claude Opus 4.6

---

## Progress so far

- [x] Added `serwist @serwist/next idb` dependencies to `apps/web/package.json`
- [x] Created `apps/web/public/manifest.json` (PWA manifest, standalone display, theme brand-red)
- [x] Updated `apps/web/next.config.ts` to integrate Serwist plugin (`withSerwist`)
- [x] Created placeholder `apps/web/service-worker/index.ts`

---

## What remains (SD §14, §35.1.1)

1. **IndexedDB schema** (`packages/offline/src/indexeddb.ts`): `products`, `variants`, `modifiers`, `tax_rates`, `pending_orders`, `meta`
2. **Sync engine** (`apps/web/app/(dash)/pos/lib/offline-sync.ts`): outbox flush, exponential backoff, online detection
3. **Offline banner** (`apps/web/app/(dash)/pos/components/offline-banner.tsx`): "X transaksi pending sync" (yellow)
4. **POS layout update**: wrap with `OfflineSyncProvider`, show banner
5. **POS page update**: hook cart submit → write to outbox → call sync engine
6. **Sync endpoint** (`apps/web/app/api/sync/pos/route.ts`): T-0062
7. **PWA meta in root layout**: `display: standalone`, icons, `theme_color`
8. **TypeScript types** for Serwist work in `service-worker/`

---

## Next step

🟩 DONE — committed as `1d70ba0` — typecheck clean — pushed to GitHub.

All Phase 1 backlog tasks now complete. Ready for Phase 2.

Steps:
1. Create dir `packages/offline/` with `package.json`
2. Write `src/indexeddb.ts` with stores: `products`, `variants`, `modifiers`, `tax_rates`, `pending_orders`, `meta`
3. Write `src/sync.ts` — outbox flush + exponential backoff (SD §35.1.1 table)
4. Create `apps/web/app/(dash)/pos/lib/offline-sync.ts` — React hook `useOfflineSync`
5. Then create `apps/web/app/api/sync/pos/route.ts` (T-0062)

---
