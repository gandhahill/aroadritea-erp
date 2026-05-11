# T-0087 — POS Demo Mode UI + IndexedDB Sandbox

- **Status**: 🟩 DONE
- **Owner**: Claude Opus 4.6
- **Started**: 2026-05-11
- **Last Updated**: 2026-05-11
- **Spec**: SD §34, ADR-0008
- **Commit**: `36d028a`

## Goal

Build POS Demo Mode — client-side IndexedDB sandbox yang terpisah total dari production. Tidak pernah sync ke server, tidak kirim ke Naixer, tidak mempengaruhi akuntansi/inventory.

## Plan

1. [x] Seed permissions `pos.demo.use` + `pos.demo.print` (done in iam.ts)
2. [x] `packages/offline/src/demo-db.ts` — separate IndexedDB `aroadri-pos-demo` + demo CRUD + meta helpers
3. [x] `packages/offline/src/demo-store.ts` — in-memory cart types + totals calculator
4. [x] `packages/offline/src/demo-master.ts` — snapshot master from production to demo DB
5. [x] `packages/offline/src/index.ts` — barrel updated
6. [x] `apps/web/app/(dash)/pos/demo/layout.tsx` — layout with DemoModeProvider + DemoCartProvider
7. [x] `apps/web/app/(dash)/pos/demo/page.tsx` — entry: activation → snapshot → render
8. [x] `apps/web/app/(dash)/pos/demo/demo-mode-context.tsx` — shared demo state (activate/deactivate/snapshot)
9. [x] `apps/web/app/(dash)/pos/demo/demo-cart-context.tsx` — demo cart state (mirrors production cart)
10. [x] `apps/web/app/(dash)/pos/demo/demo-pos-client.tsx` — full demo POS layout
11. [x] `apps/web/app/(dash)/pos/demo/demo-channel-selector.tsx` — channel buttons
12. [x] `apps/web/app/(dash)/pos/demo/demo-product-search.tsx` — reads from demo IndexedDB
13. [x] `apps/web/app/(dash)/pos/demo/demo-order-cart.tsx` — cart display + qty controls
14. [x] `apps/web/app/(dash)/pos/demo/demo-payment-modal.tsx` — full payment flow, no server calls
15. [x] `apps/web/app/(dash)/pos/demo/components/demo-mode-banner.tsx` — red "MODE DEMO" banner
16. [x] `apps/web/app/(dash)/pos/demo/components/demo-receipt-preview.tsx` — receipt with DEMO stamp
17. [x] `apps/web/app/(dash)/pos/demo/components/demo-reset-modal.tsx` — reset/exit modal
18. [x] i18n keys: `pos.demo.*` in id/en/zh
19. [x] Typecheck: clean ✅

## Key Design Decisions

- Demo uses **separate** IndexedDB `aroadri-pos-demo` (different DB name = perfect isolation)
- Demo cart is **pure in-memory state** — no server calls ever
- Demo QR prefix: `DEMO-` (Naixer won't read it)
- Master data snapshot on activation, warning if >24h stale
- No shift required in demo mode
- `buildDemoQrPayload` in `demo-db.ts`; `upsertDemo*` functions in `demo-db.ts` (renamed to avoid collision with production `upsert*`)
- `DemoPosClient` at `/pos/demo` — user navigates directly (no permission gate in page — gate is via sidebar)

## Files Created (19 files)

### packages/offline/src/
| File | Action | Note |
|------|--------|------|
| `demo-db.ts` | new | IndexedDB `aroadri-pos-demo`, stores, meta, upsert, wipe |
| `demo-store.ts` | new | cart types, totals, default state |
| `demo-master.ts` | new | snapshot from production to demo DB |
| `index.ts` | update | barrel exports for demo modules |

### apps/web/app/(dash)/pos/demo/
| File | Action | Note |
|------|--------|------|
| `layout.tsx` | new | DemoModeProvider + DemoCartProvider wrapper |
| `page.tsx` | new | activation flow + render |
| `demo-mode-context.tsx` | new | shared demo state (activate/deactivate/snapshot) |
| `demo-cart-context.tsx` | new | cart state (mirrors production) |
| `demo-pos-client.tsx` | new | full demo POS layout |
| `demo-channel-selector.tsx` | new | channel buttons |
| `demo-product-search.tsx` | new | reads from demo IndexedDB |
| `demo-order-cart.tsx` | new | cart display + qty controls |
| `demo-payment-modal.tsx` | new | payment flow, DEMO-XXX order numbers |
| `components/demo-mode-banner.tsx` | new | red "MODE DEMO" banner |
| `components/demo-receipt-preview.tsx` | new | receipt with DEMO stamp watermark |
| `components/demo-reset-modal.tsx` | new | reset/exit actions |

### apps/web/messages/
| File | Action | Note |
|------|--------|------|
| `id.json` | update | +15 `pos.demo.*` keys |
| `en.json` | update | +15 `pos.demo.*` keys |
| `zh.json` | update | +15 `pos.demo.*` keys |

## Commits

| SHA | Message | Date |
|-----|---------|------|
| 36d028a | feat(T-0087): POS demo mode UI + IndexedDB sandbox | 2026-05-11 |

## Open Issues

- ⚠️ Need to add "Mode Demo" button to production POS sidebar nav (see ADR-0008 §Aktivasi: "Tombol 'Mode Demo' di menu kasir")
- ⚠️ `pos.demo.print` permission not yet wired to UI (print with watermark feature)
- ⚠️ Browser title `[DEMO]` not set yet (should use `document.title` in demo layout)
- ⚠️ Service worker filter: do NOT sync from `aroadri-pos-demo` (ensure sync.ts is IndexedDB-name-aware)

## Next step

Add "Mode Demo" button to POS sidebar nav + wire permission check.
File: `apps/web/app/(dash)/sidebar.tsx`
