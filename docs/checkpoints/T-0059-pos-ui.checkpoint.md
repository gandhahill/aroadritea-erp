# T-0059+0060 Checkpoint — POS UI Shift + Order Entry

**Task**: POS UI — shift status bar + shift open/close modal + order entry page
**Status**: 🔄 IN_PROGRESS
**Date**: 2026-05-09

---

## Phase 1: i18n keys — DONE
- Added `pos.*` keys to `id.json`, `en.json`, `zh.json`

---

## Phase 2: Server Actions — NEXT

Files to create:
- `apps/web/app/(dash)/pos/actions.ts` — fetchOpenShift, fetchProducts, createSaleAction, openShiftAction, closeShiftAction, refundAction, voidAction
- `apps/web/app/(dash)/pos/layout.tsx` — POS shell with shift status bar
- `apps/web/app/(dash)/pos/page.tsx` — order entry page
- `apps/web/app/(dash)/pos/shift-status-bar.tsx` — shift indicator + open/close modal
- `apps/web/app/(dash)/pos/product-search.tsx` — product search component
- `apps/web/app/(dash)/pos/order-cart.tsx` — cart / order lines
- `apps/web/app/(dash)/pos/payment-modal.tsx` — payment entry modal
- `apps/web/app/(dash)/pos/channel-selector.tsx` — channel type selector
- `apps/web/app/(dash)/pos/actions.ts` — server actions

Key data needed:
- `products` table (from T-0050 — already exists in schema)
- `product_variants`, `categories` from T-0050
- `shifts` from T-0057
- `openShift`, `closeShift` services from shift-service.ts

---

## Next Step

Create `apps/web/app/(dash)/pos/actions.ts` — server actions file with:
1. `fetchOpenShift(tenantId, locationId)` — calls `getOpenShift`
2. `fetchProducts(tenantId, categoryId?)` — reads products table
3. `createSaleAction(input: CreateSaleInput, ctx)` — calls `createSale`
4. `openShiftAction(input: OpenShiftInput, ctx)` — calls `openShift`
5. `closeShiftAction(input: CloseShiftInput, ctx)` — calls `closeShift`
6. `refundAction(input: RefundSaleInput, ctx)` — calls `refundSale`
7. `voidAction(input: VoidSaleInput, ctx)` — calls `voidSale`
