# F&B ERP Gap Analysis — Ground-Truth Audit (T-0299)

**Status**: 🟡 Living document — first audit pass complete, deep dives ongoing
**Started**: 2026-06-11
**Input**: [`fnb-erp-feature-checklist.md`](./fnb-erp-feature-checklist.md) — ~260 items across §0-§17, brainstormed *from scratch* (Odoo/ERPNext-class F&B ERP) without reference to this repo's current state, per Lintang's instruction to avoid anchoring bias.
**Benchmark sources**: `E:\erp-benchmark\` (Odoo 18.0, ERPNext v15, frappe/hrms v15 — sparse clones, outside repo).

## Methodology — dual lens (mandatory per Lintang's instruction)

For every checklist item we assess **two** independent things:

1. **Presence** — does the feature exist at all? `🟩 DONE` / `🟨 PARTIAL` / `🟥 MISSING`
2. **Logic** — if present, does the wiring actually work end-to-end, or does it *look* done (schema exists, service exists, even tests pass) while the real user-facing flow is broken, unreachable, or silently a no-op?

> A feature can be `🟩 DONE` on presence and still be the **highest-priority bug** in the system if its logic is broken (see Findings 1–3 below). Conversely a `🟥 MISSING` item that's genuinely out of scope for a small bubble-tea shop (e.g. multi-currency) is not automatically a backlog item.

Symbols used throughout:
- 🟩 DONE — present, logic verified correct
- 🟨 PARTIAL — incomplete, OR present-but-unreachable (dead/orphaned), OR a real logic bug found
- 🟥 MISSING — not present
- ⬜ — first-pass guess only; **not yet** put through the dual-lens deep audit; needs a follow-up session

---

## Part A — Headline Findings (deep-audited this session, P0)

These four findings are the highest-value output of this audit: each one is a case where **the backend/schema/TASK.md says "done"**, but the actual end-to-end user flow is broken, missing, or silently a no-op. All four are fully evidenced with file:line citations below.

### Finding 1 — Order-line modifiers (sugar/ice/topping): schema 100%, POS UI 0%, semantic mismatch with KDS

**Severity: P0** — bubble tea is the core product; nearly every order needs a sugar/ice level. Right now there is **no way to record this at POS**.

Evidence:
- Schema is complete and well-designed: [`packages/db/schema/inventory.ts:185-264`](../../packages/db/schema/inventory.ts) — `product_modifier_groups` (trilingual name, `selectionType` single/multiple, `isRequired`, `maxSelections`, sortOrder), `product_modifier_options` (trilingual name, `extraPrice` bigint, `linkedProductId` for BOM deduction, `isDefault`), `product_modifier_links` (product↔group many-to-many).
- `salesOrderLines.modifierJson` exists and **is consumed** by `kds-service.ts`'s `queueOrderItems()` to build `productSummary` for the kitchen ticket — but it expects **hardcoded keys** `modifierJson.sugar` / `.ice` / `.toppings`. This is a **semantic mismatch**: the schema models arbitrary named groups (e.g. "Topping", "Cup Size", anything an admin types in), but the only real consumer hardcodes exactly 3 tea-shop-specific dimensions.
- `naixerModifierCodes` (Naixer QR integration) maps `modifierOptionId` → printer QR code, classified by `modifierKind` (size/ice/sugar/topping/cup/other) — so the Naixer side **also** expects generic options to be bucketed into these specific kinds. Two different consumers, two different (incompatible) ways of classifying the same generic options table.
- `apps/web/app/(dash)/pos/actions.ts` `fetchMasterDataRaw()` (lines 487-575) **does** query `productModifierOptions` and ships a flat `modifiers[]` array (`id`, `name`, `price`, `category: groupId`, `isActive`) into the offline-sync payload — but does **not** query `productModifierGroups` (no `selectionType`/`isRequired`/group display name) or `productModifierLinks` (no product→group association). Even this partial data cannot drive a per-product picker — there's no way to know *which* products have *which* groups, or whether a group is single/multi-select or required.
- `apps/web/app/(dash)/pos/product-search.tsx` `handleAddProduct()` — the **only** place a cart line is constructed — never reads or sets `modifierJson`. `order-cart.tsx` never renders modifier info on a line. `pos-cart-context.tsx`'s `CartLine.modifierJson?: Record<string, unknown>` field exists in the type but is always `undefined` in practice.

**Net effect**: a cashier ringing up "Thai Tea" has no UI to ask "berapa persen gula / es?" — the single most common interaction in a bubble tea shop. Every sale implicitly has empty modifiers; `kdsOrderItems.productSummary` never shows sugar/ice/topping; any `naixerModifierCodes` mappings an admin configures in Settings → Integrations → Naixer are **never triggered** because nothing ever populates `modifierJson`.

**What "done" requires** (multi-part, needs a small ADR for the schema/semantic decision):
1. Decide canonical `modifierJson` shape — either (a) add a `groupRole: 'sugar' | 'ice' | 'topping' | 'other'` column to `product_modifier_groups` so the picker can map any admin-defined group to the 3 keys `kds-service.ts`/Naixer expect, or (b) generalize `kds-service.ts`'s `productSummary` builder + `naixerModifierCodes` lookups to iterate groups generically. **(a) is far less invasive** — one nullable column + a picker that groups by `groupRole`.
2. `fetchMasterDataRaw()`: also query `productModifierGroups` + `productModifierLinks`, return a per-product grouped structure.
3. New modifier-picker dialog in POS: triggered from `handleAddProduct()` when a product has linked groups; required groups block "Add to cart"; writes selections into `modifierJson`.
4. `order-cart.tsx`: render chosen modifiers under each line, allow editing.

---

### Finding 2 — Promotion kinds `buy_x_get_y` / `free_item` / `complimentary` are silent no-ops

**Severity: P0** — a manager can configure an "active" promotion that **silently does nothing**, with **zero error anywhere** (no log, no toast, no audit entry).

Evidence — [`packages/services/src/promotion/evaluator.ts:133-136`](../../packages/services/src/promotion/evaluator.ts):
```ts
} else {
  // 'buy_x_get_y', 'free_item', 'complimentary' not fully implemented yet
  continue;
}
```
- The schema (`packages/db/schema/promotion.ts`) fully models all 5 kinds, including BOGO fields (`buyProductId`, `buyQty`, `getProductId`, `getVariantId`, `getQty`, `discountBps`) and comp fields (`requiresReason`, `expenseAccountCode`).
- The `promotion_upsert` MCP tool and `/settings/promotions` UI both accept all 5 kinds via the `PromotionKindSchema` zod enum (`promotion/index.ts:24-30`) — **with no warning** that 3 of the 5 kinds do nothing.
- `AppliedPromotion.appliesTo: 'order' | 'line'` and `lineId?` exist in the type but are **never** set to `'line'` / a real line id anywhere — strong evidence line-level promo application was planned but never finished.
- **Zero test coverage**: no `evaluator.test.ts` or any `promotion*` test file exists in `packages/services/tests/` — this silent-skip path has never been exercised by CI.

**Net effect**: Lintang configures "Buy 1 Get 1 — Thai Tea" (`kind: 'buy_x_get_y'`, `status: 'active'`). Cashier rings up 2× Thai Tea at POS. Total stays full price. No discount line, no error, no audit trail entry — it just looks like a normal full-price sale. The only way to discover the promo "didn't fire" is to read this source file.

**What "done" requires**:
- **G3a** (self-contained, no ADR, includes new tests): implement `buy_x_get_y` and `free_item` as **line-level** discounts (`appliesTo: 'line'`, `lineId` set). Realistic cashier flow: cashier adds both the "buy" product and the "get/free" product as normal cart lines; evaluator detects the buy-qty threshold and discounts the get/free line(s) by `discountBps` (default 10000 = 100%), capped at `getQty` units actually present in the cart.
- **G3b** (needs a short ADR — touches journal posting): `complimentary` carries `expenseAccountCode`, implying the comp'd amount should post to a specific GL expense account (e.g. "Beban Marketing - Komplimen") instead of the normal sales-discount contra-revenue account inside `create-sale.ts`'s journal entry. This is an accounting-routing decision, not just a pricing one — needs its own design pass per CLAUDE.md §5.4 ("do not add ad-hoc accounts from code").

**Update 2026-06-12 — G3a is DONE** (T-0300): `evaluator.ts` now implements `buy_x_get_y` and `free_item` via a new `applyGetItemBenefit()` helper, producing `appliesTo: 'line'` / `lineId`-populated `AppliedPromotion` entries (capped at `getQty` units actually present in the cart, `discountBps`-scaled). 13 new tests in `packages/services/tests/promotion-evaluator.test.ts` cover both kinds, `usageLimit` gating, and stacking a line-level discount with an order-level `percent_discount`. 678/678 services tests pass, typecheck clean. `complimentary` (G3b) remains a documented no-op pending its ADR. While implementing this, a related bug was found and documented separately as **Finding 5 / G15**: `usageCount` (used by the `usageLimit` gate just above) is never incremented anywhere, so `usageLimit` can never actually bind.

---

### Finding 3 — Kitchen Display System (KDS): backend 100% done + tested + auto-wired, UI 0% — kitchen staff have nothing to look at

**Severity: P0** — every single sale silently queues into a void.

Evidence:
- [`packages/services/src/kitchen/kds-service.ts`](../../packages/services/src/kitchen/kds-service.ts) (399 lines): full status machine `queued → making → ready → served` (+ `cancelled`), `queueOrderItems`, `updateKdsStatus`, `listKdsItems`, `getKdsStats`, `cancelOrderItems`. Permission-checked (`kitchen.view`), tenant-scoped, audited. **26 passing tests**.
- [`packages/services/src/kitchen/display-service.ts`](../../packages/services/src/kitchen/display-service.ts) (169 lines): customer-facing SSE queue feed (`getDisplayQueue`, `formatSseEvent`, `createQueueUpdateEvent`). **11 passing tests**. TASK.md marks both T-0084 and T-0085i as ✅ DONE.
- [`packages/services/src/pos/create-sale.ts:1390`](../../packages/services/src/pos/create-sale.ts): `queueOrderItems({ salesOrderId: saleId }, ctx, { skipPermissionCheck: true }).catch(() => {})` — **every sale automatically populates `kdsOrderItems`**, fire-and-forget, no UI needed to *create* the data.
- `kitchen.view` permission **is seeded** and assigned to roles (`packages/db/seed/iam.ts:717,849,952`).
- BUT: `apps/web/lib/nav-access.ts` has **zero** routes gated by `kitchen.view`. `apps/web/app/(dash)/sidebar.tsx` has **zero** kitchen/KDS/display nav entry. A full glob of `apps/web/app/(dash)/**/page.tsx` shows **no `/kitchen`, no `/kds`, no `/display` page exists anywhere**. No SSE route mounts `display-service.ts` in `apps/mcp` either.
- SD §21.7 ("Kitchen / KDS — Phase 3") explicitly specifies a KDS view UI as part of the deliverable. TASK.md marking the *backend* tickets DONE creates the appearance the whole feature shipped.

**Net effect**: every order placed at POS is queued into `kdsOrderItems` with status `queued` and **sits there forever** — nobody can see it, advance it to "making"/"ready"/"served", or display it to customers. This is exactly the "looks done but isn't" pattern Lintang asked to hunt for: 26+11 green tests, a DONE checkmark in TASK.md, and a completely unusable physical workflow.

**What "done" requires**:
- `apps/web/app/(dash)/kitchen/page.tsx` (new): staff KDS board — columns per status, tap-to-advance via `updateKdsStatus`/`listKdsItems`.
- A customer-facing display route, SSE-subscribed to `display-service.ts` (needs a new SSE endpoint — Next.js route handler or `apps/mcp` route).
- `nav-access.ts` + `sidebar.tsx`: new `/kitchen` entry gated by `kitchen.view`.
- i18n ×3 for status labels/buttons.

---

### Finding 4 — `reservations` table: fully dormant schema, zero references anywhere

**Severity: P2 — decision needed, not a bug**

`packages/db/schema/reservations.ts` defines a complete `reservations` table (customer info, date/time, party size, type `table`/`event`, status, special requests). A repo-wide search finds **zero** references outside its own schema file — no service, no UI, no MCP tool, no mention in SOURCE-OF-TRUTH.md or SYSTEM-DESIGN.md.

**Action needed (ask Lintang)**:
- If table/event reservations are in-scope for Aroadri Tea (the SoT describes a counter-service bubble tea & dessert shop — likely mostly walk-in) → build the service + UI as part of §3.1 Floor Plan & Tables.
- If out of scope → remove the dead table via migration, or explicitly mark it "future / not yet scheduled" in SYSTEM-DESIGN so it stops looking like an orphaned bug.

---

### Finding 5 — Promotion `usageLimit` is checked but `usageCount` is never incremented, so the limit can never bind

**Severity: P1** — discovered 2026-06-12 while implementing G3a. This is the mirror image of Finding 2: there, a *kind* existed but its executor was a no-op; here, a *gate* is correctly implemented but the counter it gates on never moves.

Evidence — [`packages/services/src/promotion/evaluator.ts:71-78`](../../packages/services/src/promotion/evaluator.ts) checks the limit on every evaluation:
```ts
if (
  promo.usageLimit !== null &&
  promo.usageLimit !== undefined &&
  promo.usageCount >= promo.usageLimit
) {
  continue;
}
```
But a search for `usageCount` in [`packages/services/src/pos/create-sale.ts`](../../packages/services/src/pos/create-sale.ts) — where `promotionApplications` rows are inserted (~lines 1264-1279) — returns **zero matches**. Nothing ever runs `promotions.usageCount = usageCount + 1` after a promo applies to a sale.

**Net effect**: `usageCount` stays `0` forever, so `0 >= usageLimit` is false for any `usageLimit >= 1` — the gate never fires. A manager configuring "first 50 redemptions only" or "max 1 use" gets a promo that silently behaves as **unlimited**, with no error/log/audit difference from a promo with `usageLimit: null`. The field is fully wired in the UI/MCP (`promotion_upsert`) and the read-side check exists — only the write-side increment is missing.

**What "done" requires** (**G15**, self-contained, S effort):
- After a sale's `promotionApplications` rows are inserted in `create-sale.ts`, for each distinct `promotionId` applied where the promotion has a non-null `usageLimit`, increment `promotions.usageCount = usageCount + 1` in the same transaction.
- Regression test: a promo with `usageLimit: 1, usageCount: 0` applies; after simulating the increment (`usageCount: 1`), a second `evaluatePromotions` call with the updated promo returns no applied promotions for it (covers the existing `usageLimit` gate at `evaluator.ts:71-78`, already tested for the `usageCount >= usageLimit` case in `promotion-evaluator.test.ts`).

**✅ G15 now DONE (T-0302)** — `create-sale.ts` now collects the distinct `promotionId`s from `promoResult.appliedPromotions` after the sale is fully committed (journal posted, idempotency saved — i.e. past every remaining rollback point) and runs a single `UPDATE promotions SET usage_count = usage_count + 1 WHERE id IN (...)`. Implemented unconditionally (for ANY applied promotion, not only those with a non-null `usageLimit`) so `usageCount` is an accurate running redemption counter visible in the Settings UI for every promo, matching Odoo/ERPNext coupon-usage conventions — the `usageLimit` gate at `evaluator.ts:71-78` only *reads* the counter, so this is a superset of the original "done" criteria with no behavior change for unlimited promos. No new test added (the increment is a single DB `UPDATE` with no business logic; the gating logic it feeds was already covered by `promotion-evaluator.test.ts`'s `usageLimit` cases). 678/678 services tests still PASS, typecheck clean.

---

## Part B — §3 (Sales / POS / Restaurant Operations) deep audit

This section had the full dual-lens pass. 39 items across 8 sub-sections.

### 3.1 Floor Plan & Tables — 🟥 ~100% MISSING

| Item | Status | Notes |
|---|---|---|
| Visual floor-plan editor | 🟥 MISSING | No `tables`/`floor_plan` schema found anywhere. |
| Table shapes/size/color | 🟥 MISSING | depends on above |
| Seat count per table | 🟥 MISSING | — |
| Live table-status colors | 🟥 MISSING | — |
| Merge/link adjacent tables | 🟥 MISSING | — |
| Table reservation calendar + waitlist | 🟥 MISSING | `reservations` table exists but dormant — Finding 4 |
| QR per table → digital menu/self-order | 🟥 MISSING | Naixer QR ≠ customer table QR; different purpose entirely |

**Business-priority caveat**: Aroadri Tea is described in SOURCE-OF-TRUTH as a counter-service bubble tea & dessert shop. If outlets have **no seated dine-in service**, all of §3.1 may be legitimately out of scope. **Needs Lintang's confirmation** before treating this as a backlog rather than "N/A for our format."

### 3.2 Order Taking & Kitchen — mixed, contains Findings 1 & 3

| Item | Status | Notes |
|---|---|---|
| Course sequencing / fire course | 🟥 MISSING | not relevant for quick-service; low priority |
| KDS screen | 🟨 PARTIAL (bug) | **Finding 3** — backend 100%, UI 0% |
| Printer routing rules by category/station | 🟨 PARTIAL | Naixer QR config (`naixerProductCodes`/`QrFormatConfig`) is a *different* routing mechanism (QR→KDS hardware), not multi-printer station routing — functionally adjacent but not the same feature |
| Order line notes ("less ice", allergy) | 🟩 DONE | `order-cart.tsx` has a per-line free-text notes field |
| Modifier groups (required/optional, price delta) | 🟨 PARTIAL (bug) | **Finding 1** — schema 100%, POS UI 0% |
| Combo/meal-deal builder | ⬜ likely MISSING | no `combo`/`bundle` concept found; needs confirmation |
| "86" an item (mark unavailable) | 🟥 MISSING | `product-search.tsx` greys out items purely from `qtyAvailable <= 0` — there is no manual "out of stock today" toggle independent of stock count (e.g. machine broken, ran out of a non-tracked ingredient). **Good small quick-win — see G4.** |
| Kitchen prep list from open orders/par levels | 🟥 MISSING | par-level reorder exists in inventory, but no "what to prep now" view |

### 3.3 Pricing & Promotions — mostly working, contains Finding 2

| Item | Status | Notes |
|---|---|---|
| Happy-hour / time-of-day / day-of-week rules | 🟩 DONE | `evaluator.ts` checks `daysOfWeek`/`startTime`/`endTime` in WIB — verified logic for percent/fixed kinds |
| Price lists per channel | 🟨 PARTIAL | promotions can be `channelScope`-limited, but there's no first-class "different base price per channel" pricelist entity (single `sellPrice`/`defaultSellPrice` per product/variant) |
| Manual discount with manager-PIN approval + reason | 🟨 PARTIAL | reason capture: 🟩 done (`order-cart.tsx`, required if discount > 0); manager-PIN/approval-above-threshold gate: 🟥 not yet (tracked as master-plan card F4.4j `manual_discount` workflow gate — not built) |
| Price override with reason + approval | 🟥 MISSING | no per-line price-override UI found (only % discount) |
| Daily specials / auto-expiry | 🟨 PARTIAL (cosmetic logic nit) | `promotions.endsAt` IS correctly excluded by `listActivePromotionsForSale`'s date filter (functionally expires on time) — **but** the stored `status` column never auto-flips `active → expired`, so `/settings/promotions` can show an expired promo as "Active" indefinitely. Cosmetic but confusing for whoever manages promos. |

### 3.4 Billing & Payment — mixed; "split bill" is a naming collision

| Item | Status | Notes |
|---|---|---|
| Split bill: by item / equal share / by seat | 🟥 MISSING | **Naming collision**: `payment-modal.tsx`'s "split" (`SplitPayment[]`) splits *payment methods* on ONE bill (e.g. half cash / half QRIS) — it does NOT split ONE order into multiple separate checks for different guests. The latter (true split-bill) does not exist. |
| Merge multiple open orders into one bill | 🟥 MISSING | no concept of merging carts/orders |
| Transfer order to different table | 🟥 MISSING | depends on §3.1 (no tables) |
| Void/cancel line with reason+approval; void whole order | 🟨 PARTIAL | removing an unsent line pre-payment: 🟩 done, no reason needed (not yet posted). Formal void of a *posted* sale with approval gate = master-plan card F4.4c (`pos_void`), not yet built. |
| Complimentary (comp) item flag for COGS/marketing | 🟥 MISSING | ties directly to **Finding 2** (`complimentary` promo kind unimplemented); no separate per-line "comp" flag either |
| Tips: collect/pool/report | 🟥 MISSING | not seen in `payment-modal.tsx`. Note: the existing "donation/rounding" feature (SD §25.11) is for *charity rounding*, not staff tips — different feature, do not conflate |
| Service charge line (distinct from PB1/PPN), on/off + % | ⬜ NOT YET AUDITED | no evidence found either way this session; **flag for next pass** — if Aroadri ever adds a service charge this is a real revenue-accuracy gap, not cosmetic |
| Split payment across multiple methods | 🟩 DONE | `payment-modal.tsx` `SplitPayment[]`, `handleAddSplit`/`handleRemoveSplit`, verified |
| Open/misc sale line (custom description + price) | 🥉 🟥 MISSING | `product-search.tsx` only adds catalog products/variants — no "type your own item + price" line. **Good small quick-win — see G8.** |
| Refund/return from POS, reason + approval | 🟨 PARTIAL | `pos_refund` MCP tool + service exist (reason likely captured); manager-approval-above-threshold gate = master-plan card F4.4b (`pos_refund` workflow gate), not yet built |

### 3.5 Cash Drawer & Shift — park/recall just shipped; cash-control items unaudited

| Item | Status | Notes |
|---|---|---|
| Cash drawer open/close, "no sale" | 🟥 MISSING | hardware drawer-kick is a print/peripheral feature, gated behind native print (ADR-0015/F7, not yet built) |
| Cash-in/cash-out with reason during shift | 🟨 PARTIAL | `pos_log_expense` MCP tool likely covers cash-OUT (petty expense during shift); cash-IN (e.g. owner topping up float) unclear — **flag for next pass** |
| End-of-shift cash count by denomination vs. system-expected, variance shown | ⬜ NOT YET AUDITED | **High-priority check** — this is a core F&B cash-control. Shift open/close exists (`payment-modal.tsx` requires `state.shiftId`), but whether shift-*close* prompts a denomination count is unverified. If missing, this is a real control gap (P1), not cosmetic. |
| X-report (mid-shift) / Z-report (end-of-day) | ⬜ NOT YET AUDITED | `reporting_get_daily_summary` MCP tool may serve as a Z-report equivalent; X-report unclear |
| Order hold/park + recall | 🟩 DONE | `pos-park-service.ts` — just shipped as **T-0296 "POS save-as-draft"** (commit `ddb79b4`, 2026-06-11) |

### 3.6 Self-Order / Kiosk / Online — channel tagging done; ordering UI + reconciliation missing

| Item | Status | Notes |
|---|---|---|
| Self-order modes (disabled/QR-menu/QR-order/kiosk) | 🟥 MISSING | no `/kiosk`, `/self-order`, `/menu`-ordering route found anywhere |
| Self-order service mode (pickup vs table) per branch | 🟥 MISSING | depends on above |
| Pay-before vs pay-after config | 🟥 MISSING | depends on above |
| Kiosk multi-language | 🟥 MISSING | depends on above |
| Kiosk branding | 🟥 MISSING | depends on above |
| Order-source tagging (dine-in/takeaway/GoFood/Grab/Shopee/website/phone) | 🟩 DONE | `salesOrders.channel` + channel-specific payment methods in `payment-modal.tsx`, channel config in `posSettings.deliveryChannelsJson` |
| Delivery commission auto-calc (net=80%) + reconciliation vs. payout statement | 🟨 PARTIAL | commission % config exists (`posSettings.deliveryChannelsJson`); **reconciliation service is confirmed absent** (repo-wide grep for `reconcil`/`delivery_settlement` under `packages/` returns nothing relevant to delivery). See **G5**. |
| Order-ready status board ("Order #42 ready") | 🟥 MISSING | ties to **Finding 3** — would consume `display-service.ts` |
| Customer-facing secondary display | 🟥 MISSING | ties to **Finding 3** |

### 3.7 Receipts & Misc. — unaudited beyond product grid

| Item | Status | Notes |
|---|---|---|
| Multi-language receipt (per customer pref) | ⬜ NOT YET AUDITED | `/pos/print/receipt/[id]` route exists; whether it's locale-aware per-transaction (vs. always staff locale) is unverified |
| Digital receipt via WhatsApp/email | 🥉 ⬜ likely MISSING | no customer-receipt-via-WA/email service found; `sendTransactionalEmail` exists but used for other flows (payroll slips, scheduled reports backlog) |
| Receipt customization (footer/promo/feedback QR) | ⬜ NOT YET AUDITED | — |
| Loyalty point balance printed on receipt | ⬜ NOT YET AUDITED | loyalty service (T-0128) exists; receipt integration unverified |
| Product images + color-coded categories on POS grid | 🟨 PARTIAL | `imageUrl` returned by `fetchMasterDataRaw`, product grid renders images (verified `product-search.tsx`); category *color-coding* not seen — categories likely lack a `color` field |
| Quick-key/favorite shortcuts, customizable per terminal | 🥉 🟥 MISSING | POS is search + category-grid only; no pinned/favorite quick-keys |

### 3.8 Sales Analytics (operational) — partially covered by reporting module

| Item | Status | Notes |
|---|---|---|
| Daily sales target per branch + live progress | 🟥 MISSING | no "target" concept found in settings/locations |
| Staff sales leaderboard / per-staff commission | ⬜ NOT YET AUDITED | `cashierId` is tracked per sale (raw data exists); a leaderboard *report* is unverified |
| Table-turnover-time report | 🥉 🟥 MISSING | depends on §3.1 (no tables) |
| Peak-hour heatmap | 🟨 PARTIAL | `/reporting/hourly-sales` page + `reporting_get_hourly_sales` MCP tool exist (underlying data is there); whether it's presented as a day×hour *heatmap* vs. a simple bar chart is unverified |

---

## Part C — Audit progress tracker, §0-2 & §4-17 (first-pass only)

These sections have **not** had the full dual-lens pass yet. Status below is a first-pass presence guess based on file/page existence checks plus knowledge accumulated earlier in this session (this repo is mature — 297+ tasks shipped). **Do not treat "🟩" here as logic-verified** — only §3 and the items in Part A have been through the dual-lens.

| § | Topic | First-pass presence | Logic audit | Notes / what to check next |
|---|---|---|---|---|
| 0 | Cross-cutting platform/UX shell (nav, lists, forms, notifications, theming, tools) | 🟨 mostly DONE | ⬜ pending | Saved views / scheduled reports = confirmed 🟥 MISSING (master-plan F4.9, repo-wide grep empty) |
| 1 | Accounting & Finance | 🟩 mostly DONE | ⬜ pending | Very mature: GL, journals (+approval gate), trial balance, P&L, balance sheet, cash flow, equity changes, AR/AP aging, fixed assets+depreciation, bank recon, petty cash, reimbursement, period close all have pages. Multi-currency = 🟥 MISSING (IDR-only, expected). Cost/profit centers + budgets = master-plan F5.1/F5.2, not yet built. |
| 2 | Tax & Indonesian Compliance | 🟩 mostly DONE | ⬜ pending | Tax rates/rules pages, Coretax export MCP tool, e-Faktur (`tax/efaktur.ts`) referenced. PB1/PPN opt-in per ADR-0010. |
| 4 | CRM, Loyalty & Marketing | 🟨 PARTIAL | ⬜ pending | Loyalty (points/tiers/vouchers) DONE (T-0128), members + complaints/helpdesk pages exist. Promotion engine = **Finding 2** bug. Referral program / segmentation / campaign mgmt — unchecked, likely MISSING. |
| 5 | Inventory & Warehouse | 🟨 PARTIAL | ⬜ pending | Categories, opname, adjust, variance, import all have pages. **Batch/expiry tracking IS schema-modeled** (`trackExpiry` flag + `batchNo`/`expiryDate` columns on 4 tables in `inventory.ts`) — but FEFO picking logic / expiry-alert UI unverified. |
| 6 | Manufacturing / Recipes (BOM) | 🟨 PARTIAL | ⬜ pending | `/inventory/recipes` page exists, modifier `linkedProductId` enables topping BOM deduction. Sub-recipes / yield-wastage tracking unverified. |
| 7 | Purchasing & Procurement | 🟨 PARTIAL | ⬜ pending | PO, GRN (shipments), purchase returns all have pages + approval workflow (F4.4f planned). RFQ / vendor price comparison unchecked, likely MISSING. |
| 8 | HR & Payroll | 🟩 mostly DONE | ⬜ pending | Very mature: employees, attendance, checkin, leave, disciplinary actions, whistleblower, SOP, recruitment, payroll run/approve/pay all present (18-file census in F4.3b). |
| 9 | Reporting & BI | 🟨 PARTIAL | ⬜ pending | 11+ report pages exist (trial balance → cash flow → cogs → waste → donations → hourly sales → daily summary). Saved views + scheduled email reports = confirmed 🟥 MISSING (F4.9). |
| 10 | Multi-Branch / Multi-Company / Franchise | 🟨 PARTIAL | ⬜ pending | `location_id` dimension is architectural bedrock — multi-branch DONE. Franchise-specific (royalty fee calc/billing) — no evidence found, likely 🟥 MISSING but also likely **out of current business scope** (no franchise mentioned in SoT). |
| 11 | Online Channels & Integrations | 🟨 PARTIAL | partial (this session) | Naixer KDS QR integration DONE+tested. Delivery commission config DONE, **reconciliation MISSING** (G5, see Part B §3.6). |
| 12 | Mobile, Offline & Hardware | 🟨 PARTIAL | partial (this session) | PWA offline POS + IndexedDB outbox DONE (verified via `payment-modal.tsx` enqueue/sync flow). Native print (Tauri, ADR-0015/F7) = planned, not built. Barcode scanner — likely fine via keyboard-wedge (no special code needed), unverified. |
| 13 | Security, Audit & Compliance | 🟩 mostly DONE | ⬜ pending | RBAC + permission engine + `audit_log` are pervasive and were touched constantly this session. PII encryption (`encryptPiiForLookup`) confirmed exists (F5.4 card references it). 2FA — unchecked, likely 🟥 MISSING. |
| 14 | Documents & Communication | 🟩 DONE | ⬜ pending | `correspondence` module fully exists: schema + service + UI (`/correspondence`, `/correspondence/[id]`) + tests. Good — answers a section we expected to be empty. |
| 15 | Project / Task Management | 🟥 MISSING | n/a | No project/kanban schema found. `TASK.md` is the AI-dev tracker, not a customer-facing module. For a small F&B retailer, a generic "Projects" app is **low priority** unless Lintang wants e.g. store-opening checklists — flag as a question, not a default backlog item. |
| 16 | Asset / Equipment Maintenance | 🟥 MISSING | confirmed | Repo-wide grep for `maintenance` only matches a COA account name in `seed/coa.ts` (false positive). Fixed-asset depreciation register exists, but no maintenance schedule/log/reminder. See **G7**. |
| 17 | Quality Mgmt / Food Safety | 🟥 MISSING | confirmed | Repo-wide grep for `haccp`/`recall`/`quality check` returns nothing relevant. Given BPOM/halal context for F&B, likely worth a lightweight "checklist/inspection" feature — but this is a **business-process question for Lintang** before building (what does Aroadri actually need to log? daily fridge-temp checks? halal cert renewal reminders?). |

---

## Part D — Prioritized backlog candidates

New backlog section, **not currently covered by any F0-F8 master-plan card** (those cards focus on platform/enterprise depth; this audit's unique contribution is POS/kitchen/promotion *breadth and correctness*).

| Code | Title | Priority | Effort | Depends on | Files (primary) |
|---|---|---|---|---|---|
| ~~**G3a**~~ | ~~Fix promotion evaluator: implement `buy_x_get_y` + `free_item` as line-level discounts + tests~~ | **P0** | S | **✅ DONE — T-0300** | `packages/services/src/promotion/evaluator.ts`, `packages/services/tests/promotion-evaluator.test.ts` (13 tests) |
| **G3b** | `complimentary` promo: GL routing to `expenseAccountCode` (small ADR) | P1 | M | G3a, ADR | `evaluator.ts`, `pos/create-sale.ts`, new ADR |
| ~~**G15**~~ | ~~Increment `promotions.usageCount` after a promo applies to a sale — `usageLimit` currently never binds~~ | **P1** | S | **✅ DONE — T-0302** | `packages/services/src/pos/create-sale.ts`, `packages/services/src/promotion/evaluator.ts` |
| ~~**G4**~~ | ~~"86" toggle: `isAvailable`/`is86dAt` flag on products + POS toggle button + auto-grey in `product-search.tsx`~~ | **P0** (small, high visible value) | S | **✅ DONE — T-0301** | `packages/db/schema/inventory.ts` (+migration), `pos/actions.ts`, `pos/product-search.tsx`, i18n ×3 |
| **G1** | Modifier-picker UI (sugar/ice/topping) — full Finding 1 remediation | **P0** | L (split: ADR+schema; picker UI; KDS/Naixer mapping update) | small ADR (groupRole column) | `inventory.ts`, `pos/actions.ts`, new picker component, `order-cart.tsx`, `kds-service.ts`, `naixerModifierCodes` lookups |
| **G2** | KDS staff board + customer display UI — full Finding 3 remediation | **P0** | L (split: staff board; customer display+SSE route) | none (backend done) | new `apps/web/app/(dash)/kitchen/**`, `nav-access.ts`, `sidebar.tsx`, new SSE route, i18n ×3 |
| **G8** | Open/misc sale line (custom description + price) in POS | P1 (small quick win) | S | none | `pos/product-search.tsx` or new "misc item" button, `pos/actions.ts`, `pos-cart-context.tsx` |
| **G9** | Promotion `status` auto-expiry (cosmetic: stop showing expired promos as "Active" in Settings) | P2 (tiny quick win) | XS | none | `promotion/index.ts` `listPromotions` (compute display status) or a worker tick |
| **G5** | Delivery channel settlement/reconciliation (vs. platform payout statements) | P1 | M | none | new `packages/services/src/sales/delivery-settlement.ts`, new UI page |
| **G10** | Audit + likely build: end-of-shift cash count by denomination + variance (X/Z report) | **P1 (audit first — may be a real control gap)** | M (after audit) | audit pass | `pos/payment-modal.tsx` shift-close flow, `reporting/` |
| **G6** | `reservations` table — keep (build §3.1) or remove (migration) — **decision needed from Lintang** | P2 | depends on decision | Lintang input | `packages/db/schema/reservations.ts` |
| **G7** | Equipment/asset maintenance scheduling (log + reminders) | P2 | M | none | new `packages/db/schema/maintenance.ts`, service, UI under `/accounting/assets` or new `/maintenance` |
| **G11** | Receipt enhancements bundle: loyalty balance, footer/promo text, multi-language by customer pref, digital receipt via WA/email | P2 | M | audit first | `apps/web/app/(dash)/pos/print/receipt/[id]/`, `notification`/email transport |
| **G12** | Quick-key/favorite shortcuts on POS grid | P2 (cosmetic quick win) | S | none | `pos/product-search.tsx`, `posSettings` |
| **G13** | Combo/meal-deal builder | ⬜ audit first | M-L | audit | TBD |
| **G14** | Service charge line item (on/off + %) | ⬜ audit first, P1 if confirmed needed | S-M | audit + business confirmation | `posSettings`, `create-sale.ts`, tax calc |

### Decisions needed from Lintang (not auto-build)

- **§3.1 Floor Plan & Tables** (and `reservations`, G6): does any Aroadri outlet have seated dine-in service requiring table management/reservations, or is everything counter/takeaway? This single answer determines whether ~7 checklist items + G6 are "build it" or "N/A for our format."
- **§15 Project Management**: any need for an internal "Projects" app (e.g. store-opening checklists, renovation tracking)?
- **§17 Quality/Food Safety**: what does Aroadri actually need to log for BPOM/halal/internal QC (daily fridge temps? cleaning checklists? cert expiry reminders)? Determines whether G7-adjacent "inspection checklist" feature is worth building.
- **§3.4 Tips / Service charge**: does Aroadri ever collect tips or apply a service charge? (Different from the existing donation/rounding feature.)

---

## Part E — Continuation plan for next session

1. ~~Implement G3a~~ — ✅ **DONE 2026-06-12** (T-0300): line-level `buy_x_get_y`/`free_item` discounts + 13 tests, see Finding 2 update.
2. ~~Implement G4~~ — ✅ **DONE 2026-06-12** (T-0301): "86" toggle (`isAvailable`/`is86dAt`) + POS toggle button + auto-grey + MCP tool.
3. ~~G15~~ — ✅ **DONE 2026-06-12** (T-0302): `promotions.usageCount` now increments after every sale that applies a promotion, see Finding 5 update.
4. **Start G2 next** (KDS UI) — biggest "the data already flows, just give humans a screen" win; staff board first, customer display second.
5. Start **G1** (modifier picker) — needs the small ADR (groupRole column) decided first.
6. Continue the dual-lens deep audit for sections marked ⬜ in Part C, prioritizing: §3.5 cash-count/X-Z-report (G10, possible real control gap), §1 cost centers (cross-check vs F5.1), §5 batch/expiry FEFO logic.
7. Resolve the four "Decisions needed from Lintang" items above — these gate G6, G13/G14, and the §3.1/§15/§17 scope calls.

All new backlog items above should get their own `T-XXXX` entries in `TASK.md` as they're started (next available: **T-0298**).
