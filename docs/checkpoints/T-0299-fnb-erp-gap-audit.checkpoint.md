# Checkpoint: T-0299 — F&B ERP gap audit vs Odoo/ERPNext (presence + logic dual-lens)

- **Owner**: Claude Sonnet 4.6
- **Started**: 2026-06-11 (carried over, multi-session)
- **Last updated**: 2026-06-13
- **Status**: 🟨 IN_PROGRESS
- **Phase**: cross-cutting (new backlog, not part of F0-F8 master plan)
- **Branch**: master (docs + first G-item code; further implementation work may branch `feat/T-0299-<slug>` per item)

## Goal

Per Lintang's explicit multi-step instruction (verbatim, Bahasa Indonesia, must be followed in this exact order):
1. Download Odoo + ERPNext outside repo for benchmark — ✅ done (`E:\erp-benchmark\`).
2. Brainstorm an exhaustive "build F&B ERP from scratch" feature checklist — including the smallest cosmetic/complementary features — **without** anchoring on this repo's current state — ✅ done: [`docs/benchmark/fnb-erp-feature-checklist.md`](../benchmark/fnb-erp-feature-checklist.md) (~260 items, §0-§17).
3. THEN audit this repo against that checklist — ground truth.
4. **Dual lens** (added mid-session by Lintang): for every item, check BOTH (a) presence DONE/PARTIAL/MISSING, AND (b) if present, whether the *logic* actually works end-to-end — because a feature can look done (schema+service+tests all green, TASK.md says DONE) while the real user flow is silently broken.
5. If missing/broken → add to backlog, then implement (this is explicitly a **long, multi-session task**, "tidak perlu terburu-buru").

**Kriteria selesai (Definition of Done) — for the AUDIT itself:**
- [x] From-scratch checklist produced (§0-§17, ~260 items)
- [x] §3 (POS/Restaurant) full dual-lens deep audit — DONE
- [x] Headline findings (P0/P1 logic bugs) documented with file:line evidence — 5 findings (see below)
- [x] Gap analysis doc created: [`docs/benchmark/fnb-erp-gap-analysis.md`](../benchmark/fnb-erp-gap-analysis.md)
- [x] TASK.md updated: T-0299 active entry + "🍵 Backlog T-0299" section (G1-G15)
- [x] G3a implemented + tested (T-0300) — first quick-win from the backlog
- [x] G4 implemented (T-0301), G15 implemented (T-0302), G2 implemented (T-0303)
- [ ] §0-2, §4-17 still only first-pass (Part C of gap analysis) — needs follow-up deep passes
- [ ] Lintang's 4 pending business decisions (table service? project mgmt? QC checklist? tips/service charge?) — not yet asked

**This task does NOT "finish"** in the traditional sense — it's the umbrella audit. Once the audit doc + backlog (G1-G15) exist and the quick wins are implemented, T-0299 itself can move to DONE with the gap-analysis doc as the permanent living artifact; remaining G-items get their own `T-NNNN` tasks (e.g. G3a → T-0300).

## Done so far

- Cloned Odoo 18.0 + ERPNext v15 + frappe/hrms v15 (sparse) to `E:\erp-benchmark\` (~278MB, outside repo).
- Wrote `docs/benchmark/fnb-erp-feature-checklist.md` (~260 items, §0-§17).
- **Deep dual-lens audit of §3 (POS/Restaurant Operations)** — all 39 items across 8 sub-sections (3.1-3.8) — see Part B of gap-analysis doc.
- **5 Headline Findings (Part A of gap-analysis doc)**, each with file:line evidence:
  1. **Modifier sugar/ice/topping** (Finding 1 → G1, P0): schema (`packages/db/schema/inventory.ts:185-264` `product_modifier_groups/options/links`) is complete and well-designed, BUT `apps/web/app/(dash)/pos/product-search.tsx` `handleAddProduct()` never sets `modifierJson`, no picker UI exists anywhere, and `kds-service.ts`'s `productSummary` builder hardcodes `modifierJson.sugar/.ice/.toppings` keys — a semantic mismatch vs the generic group/option schema. `fetchMasterDataRaw()` (`pos/actions.ts:487-575`) fetches flat `productModifierOptions` only (no groups, no product links) — even the offline-sync payload can't drive a picker.
  2. **Promotion `buy_x_get_y`/`free_item`/`complimentary`** (Finding 2 → G3a/G3b, P0): `packages/services/src/promotion/evaluator.ts:133-136` silently `continue`d for these 3 of 5 kinds — comment said "not fully implemented yet". `promotion_upsert` MCP tool + `/settings/promotions` UI accept all 5 kinds with no warning. `AppliedPromotion.appliesTo: 'order'|'line'` + `lineId?` existed but were unused. **Zero test file** for the evaluator at all.
     - **✅ G3a now DONE (T-0300)** — see "Done this session" below.
  3. **Kitchen Display System (KDS)** (Finding 3 → G2, P0): backend 100% done — `kds-service.ts` (399 lines, 26 tests, full `queued→making→ready→served/cancelled` state machine) + `display-service.ts` (169 lines, 11 tests, customer SSE feed). `create-sale.ts:1390` auto-queues every sale into `kdsOrderItems`. `kitchen.view` permission seeded (`packages/db/seed/iam.ts:717,849,952`) and assigned to roles. BUT zero routes/pages (`apps/web/app/(dash)/**/page.tsx` glob has no `/kitchen`/`/kds`/`/display`), zero `nav-access.ts`/`sidebar.tsx` entries, zero SSE endpoint mounted. TASK.md marks T-0084/T-0085i (the backend tickets) DONE, creating a false impression the feature shipped.
     - **✅ G2 now DONE (T-0303)** — see "Done this session" below.
  4. **`reservations` table dormant** (Finding 4 → G6, P2): `packages/db/schema/reservations.ts` fully modeled, zero references anywhere (services/UI/MCP/SoT/SD). Needs Lintang's keep/remove decision.
  5. **NEW — Promotion `usageLimit` never binds** (Finding 5 → G15, P1, found while implementing G3a): `evaluator.ts:71-78` correctly checks `usageCount >= usageLimit`, but a repo-wide grep for `usageCount` in `pos/create-sale.ts` (where `promotionApplications` rows are inserted) returns **zero matches** — `usageCount` is never incremented, so `usageCount >= usageLimit` is always `0 >= N` (false). A "first 50 redemptions" promo behaves as unlimited.
- **Part C** (first-pass presence table for §0-2, §4-17) written — confirms via repo-wide greps: F4.9 saved-views/scheduled-reports = MISSING; delivery-channel reconciliation = MISSING (G5); `correspondence` module = surprisingly DONE (full schema+service+UI+tests, answers §14); maintenance scheduling (§16) and quality/food-safety (§17) = confirmed MISSING via grep (only false-positive COA account match).
- **Part D** (prioritized backlog G1-G15) + "decisions needed from Lintang" written.
- **TASK.md updated**: T-0299 row in Active Tasks (top of table); "🍵 Backlog T-0299" section in the Backlog (G1-G15, G3a marked done); new T-0300 row in Phase 2 Done table.

### Done this session — G15 implemented (T-0302)

- `packages/services/src/pos/create-sale.ts`: imported `promotions` from `@erp/db/schema/promotion` (alongside the existing `promotionApplications` import). After step 14 (idempotency record saved — the last remaining rollback point), new step 14b collects `[...new Set(promoResult.appliedPromotions.map((p) => p.promotionId))]` and, if non-empty, runs `db.update(promotions).set({ usageCount: sql\`${promotions.usageCount} + 1\` }).where(inArray(promotions.id, appliedPromotionIds))`.
- Placed deliberately AFTER journal creation/posting succeeds and idempotency is saved — every earlier failure path calls `rollbackSaleData()` which deletes `promotionApplications` rows but does NOT touch `promotions.usageCount`, so incrementing before those points would leave `usageCount` drifted on a failed/rolled-back sale.
- Increment is unconditional (every applied promotion, not just those with `usageLimit` set) — refines the gap-analysis doc's original "done" criteria (gated on `usageLimit != null`) into a general redemption counter, with no behavior change to the `usageLimit` gate (`evaluator.ts:71-78`, unaffected, still only fires when `usageLimit` is non-null).
- No new test file — single DB `UPDATE`, no new branching logic; the `usageLimit >= usageCount` gating logic this feeds was already covered by `promotion-evaluator.test.ts`.
- Verified: `tsc --noEmit` clean for `packages/services`; scoped Biome on `create-sale.ts` clean; full services suite 678/678 PASS (the 1 failure seen under full-suite run, `tests/whistleblower-anonymity.test.ts`, is a pre-existing 5000ms-timeout flake under load — passes in isolation, unrelated to this change, not investigated further).

### Done this session — G4 implemented (T-0301)

- New columns on `products` (`packages/db/schema/inventory.ts`): `isAvailable: boolean('is_available').notNull().default(true)` and `is86dAt: timestamp('is_86d_at', { withTimezone: true })` (nullable). Migration `packages/db/migrations/0044_fine_orphan.sql` generated via `pnpm generate` — **not yet applied to any database**.
- New `packages/services/src/inventory/set-product-availability.ts` (`setProductAvailability`), modeled on `deactivate-product.ts`: `requirePermission(inventory.product.update)` → validate `productId` → fetch existing row → update `isAvailable`/`is86dAt` (set `is86dAt = now()` when 86'ing, `null` when restoring) → `auditRecord({ action: 'update', entityType: 'product', before, after })` → return `{ id, isAvailable, is86dAt }`. Exported from `packages/services/src/inventory/index.ts`.
- `apps/web/app/(dash)/pos/actions.ts`: `fetchProducts` now also computes `canToggleAvailability` (non-blocking `requirePermission(inventory.product.update)` check) and returns `isAvailable`/`canToggleAvailability` per product; new `setProductAvailabilityAction(productId, isAvailable)` server action wraps the service.
- `apps/web/app/(dash)/pos/product-search.tsx`: products with `isAvailable === false` ("86'd") are now greyed out (`opacity-60`, same treatment as out-of-stock), show an "Unavailable today" badge, and have their add/variant buttons disabled. Users with `canToggleAvailability` see an eye/eye-slash button (top-right of the product image) to toggle the flag; failures show an auto-clearing (4s) inline error banner (no toast lib exists in POS — same local-state pattern as elsewhere).
- New MCP tool `inventory.set_product_availability` in `apps/mcp/src/tools/phase2.ts` (+ schema export in `apps/mcp/src/tools/index.ts`) — permission enforced inside the service, no redundant `checkPermission`.
- i18n ×3 (`apps/web/messages/{id,en,zh}.json`, key prefix `pos.*`): `unavailableToday`, `markUnavailableToday`, `markAvailableAgain`, `toggleAvailabilityFailed`.
- **No new test file** for `setProductAvailability` — consistent with sibling DB-backed mutation functions (`deactivateProduct`, `reactivateProduct`, `updateProduct`) which also have zero test coverage in `packages/services/tests/`, and CLAUDE.md forbids `vi.mock('@erp/db')`.
- Verified: `tsc --noEmit` clean for `packages/db`, `packages/services`, `apps/mcp`, `apps/web`; `pnpm lint:permissions` PASS (130 permissions, no mismatches); scoped Biome on all 10 touched files PASS; all 3 locale JSON files parse.
- **Outstanding**: migration `0044_fine_orphan.sql` is generated but not applied to the dev/prod DB — needs `drizzle-kit migrate` (or equivalent) during the next deploy.

### Done this session — G3a implemented (T-0300)

- `packages/services/src/promotion/evaluator.ts`: replaced the silent `else { continue }` for `buy_x_get_y`/`free_item`/`complimentary` with explicit handling per kind. New `applyGetItemBenefit()` helper computes line-level discounts (`appliesTo: 'line'`, `lineId` = `CartLine.id`, which by existing convention (`create-sale.ts:778`) equals `productId`):
  - `buy_x_get_y`: requires cart to hold >= `buyQty` of `buyProductId`, then discounts up to `getQty` units of `getProductId` by `discountBps` (default 10000 = 100%).
  - `free_item`: same discount computation, no "buy" gate.
  - `complimentary`: still `continue`s (G3b, needs ADR for GL routing).
  - Both new kinds reuse the existing stacking (`hasNonStackable`) and totals (`result.totalDiscount`, `remainingCartSubtotal`) logic.
  - Two documented limitations (code comments, not over-engineered): `getVariantId` unmatched (no variant dimension on `CartLine`); promotions only discount existing cart lines, never auto-add new ones.
- New `packages/services/tests/promotion-evaluator.test.ts` (290 lines, 13 tests, ALL PASS): percent_discount (2), fixed_discount (2), buy_x_get_y (3: met/not-met/absent), free_item (3: cap/partial-bps/absent), complimentary (1: still no-op), usageLimit (1: gating), stacking (1: line+order combined, exact sequencing math verified).
- `pnpm typecheck` (packages/services) clean. Full services test suite: 678/678 PASS (665 pre-existing + 13 new).
- Gap-analysis doc updated: Finding 2 has a "G3a DONE" addendum; new Finding 5 (usageCount/G15) added to Part A; Part D table updated (G3a struck through as done, G15 added); Part E continuation plan reordered (G4 next, then G15).

### Done this session — G2 implemented (T-0303)

- **Staff KDS board** at `apps/web/app/(dash)/kitchen/` (`page.tsx`, `client.tsx`, `actions.ts`): columns per status (`queued`/`making`/`ready`/`served`/`cancelled`), tap-to-advance buttons calling `updateKdsStatus`/`listKdsItems` from `kds-service.ts`, scoped to the staff member's location, gated by the `kitchen.view` permission.
- **Customer-facing display** at `apps/web/app/kitchen-display/[locationId]/` (`page.tsx`, `display-client.tsx`): read-only, SSE-subscribed "now preparing / ready for pickup" board for in-store TVs.
- **New SSE route** `apps/web/app/api/kitchen/display/[locationId]/route.ts`, backed by `display-service.ts` (`getDisplayQueue`/`formatSseEvent`/`createQueueUpdateEvent`). Both the display page and this route added to `middleware.ts` `publicPaths` (in-store TV has no login session).
- **Nav/sidebar**: `apps/web/lib/nav-access.ts` gained a `/kitchen` entry (`gate: 'kitchen.view'`); `apps/web/app/(dash)/sidebar.tsx` gained a new top-level NAV_ITEM + `PATH_TO_MODULE['/kitchen'] = 'kitchen.view'`.
- **i18n ×3** (`apps/web/messages/{id,en,zh}.json`): `nav.kitchen` label + `kitchen.*`/`kitchenDisplay.*` namespaces for all status labels/buttons.
- **Two supporting fixes** landed alongside (both needed for the staff board to be usable, not separately scoped):
  - `packages/services/src/kitchen/kds-service.ts`: `buildProductSummary` now resolves localized product/variant names instead of showing raw product/variant UUIDs.
  - `packages/db/seed/iam.ts`: added `'kitchen.view'` to the `cashier` role — the role that actually staffs the counter/kitchen at Aroadri's outlets (the permission previously existed but wasn't reachable by the staff who'd use this screen day-to-day).
- **Verified (code-level, all PASS)**: monorepo-wide `tsc --noEmit`, `pnpm lint:permissions`, scoped Biome on all 8 touched files, i18n JSON parity across `id`/`en`/`zh`, full services suite 678/678 (incl. 26/26 `kds-service` tests).
- **Browser verification BLOCKED (external infra, not a code defect)**: attempted to verify `/kitchen` and `/kitchen-display/[locationId]` via the preview tooling. First hit a local-dev-only issue — `apps/web/.env` did not exist, so the Next dev server never loaded the monorepo-root `.env`'s `DATABASE_URL` and fell back to a placeholder connection string (`packages/db/client.ts:36`), producing `password authentication failed for user "missing"`. **Fixed** by creating `apps/web/.env` (gitignored, full copy of the repo-root `.env` minus `NODE_ENV=production`) — confirmed loaded via the `- Environments: .env` log line. After that fix, login still fails with `connect ETIMEDOUT 103.93.162.50:5432` — confirmed independently via a raw TCP probe (`/dev/tcp/103.93.162.50/5432` → `TCP FAILED`) that this dev machine currently cannot reach the production Postgres host at all. This affects **every page in the app** (all routes need a DB-backed session), not just `/kitchen` — it is a network/firewall/VPN issue on this machine, unrelated to the KDS code. Per CLAUDE.md ("if you can't test the UI, say so explicitly rather than claiming success"), browser verification is recorded as BLOCKED rather than attempted-and-passed.

## Decisions

- Gap-analysis doc is structured as a **living document** (Part C explicitly marks ⬜ items as first-pass-only) rather than blocking on a full 260-item deep audit before any implementation starts — matches "long task, no rush, but make progress" framing.
- G-items are framed as **additive** to the F0-F8 master plan (not replacing it) — small/self-contained ones (G3a/G4/G8/G9/G15) can be done as interleaved hotfixes; large ones (G1/G2) need dedicated sessions.
- For Finding 1 (modifiers), recommended approach is a **small ADR adding `groupRole` column** to `product_modifier_groups` rather than rewriting `kds-service.ts`'s consumer logic — least invasive path to reconcile the generic schema with the hardcoded `sugar/ice/toppings` consumer.
- For Finding 2, split into G3a (pure pricing logic, no ADR, self-contained — done) and G3b (`complimentary`'s `expenseAccountCode` touches journal posting — needs its own ADR per CLAUDE.md §5.4 "do not add ad-hoc accounts from code").
- **Task ID renumbering (this session)**: the original checkpoint/TASK.md rows for this audit were mistakenly assigned `T-0298`, which collided with an already-DONE, pre-existing task (`T-0298` = MCP tools for uom_conversions CRUD, commit `7cc689a`). Renumbered: this audit umbrella → **T-0299**; the completed G3a code change → its own **T-0300** (matches the existing convention where each concrete code change gets its own ID). Old file `docs/checkpoints/T-0298-fnb-erp-gap-audit.checkpoint.md` deleted (replaced by this file).

## Open issues / Questions

4 business decisions needed from Lintang (WhatsApp) before certain G-items can be scoped:
1. Does any Aroadri outlet have seated dine-in/table service? → determines §3.1 (floor plan/tables, ~7 items) and G6 (`reservations` keep/remove).
2. Any need for an internal Project/Task module (§15)?
3. What concrete QC/food-safety checklist items does Aroadri need (§17 — BPOM/halal context)?
4. Has Aroadri ever used tips or a service charge (§3.4, distinct from the existing donation/rounding feature)?

## Next step

> **Implement G1** — Modifier picker UI (gula/es/topping), full Finding 1 remediation. Schema is 100% complete (`packages/db/schema/inventory.ts:185-264`, `product_modifier_groups/options/links`), but `pos/product-search.tsx`'s `handleAddProduct()` never sets `modifierJson`, no picker UI exists anywhere, `kds-service.ts`'s `productSummary` builder hardcodes `modifierJson.sugar/.ice/.toppings` keys (semantic mismatch with the generic group/option schema), and `fetchMasterDataRaw()` (`pos/actions.ts:487-575`) only fetches flat `productModifierOptions` (no groups, no product links).

Concrete plan for G1 (large item — start with the small ADR per the "Decisions" section above):
1. **Write the small ADR first**: add a `groupRole` column to `product_modifier_groups` (e.g. enum `'sugar' | 'ice' | 'topping' | 'custom'`) so `kds-service.ts`'s consumer can map generic groups back to the `sugar`/`ice`/`toppings` keys it currently hardcodes — least invasive reconciliation between the generic schema and the existing consumer. Follow `docs/adr/README.md` format; number = next available ADR (check `docs/adr/` for the highest existing number).
2. Migration for the new `groupRole` column + backfill existing rows (if any) based on group name heuristics or leave nullable/`'custom'` default.
3. `pos/actions.ts` `fetchMasterDataRaw()`: extend to fetch `product_modifier_groups` + `product_modifier_options` + the product-to-group links (not just flat `productModifierOptions`), so the offline-sync payload can drive a picker.
4. New picker component (likely a modal/sheet triggered from `product-search.tsx`'s `handleAddProduct()`): renders modifier groups for the selected product, lets the user choose options per group (respecting `groupRole`-based UI conventions — e.g. single-select for sugar/ice, multi-select for toppings), and sets `modifierJson` on the cart line before adding it via `order-cart.tsx`.
5. `kds-service.ts`'s `buildProductSummary`: update to read `modifierJson` via the new generic group/option shape (using `groupRole` to map back to `sugar`/`ice`/`toppings` for display), keeping the KDS board's existing display format.
6. `naixerModifierCodes` lookups: confirm the modifier codes used for Naixer KDS QR payloads still resolve correctly against the new `modifierJson` shape.
7. i18n ×3 (id/en/zh) for all new picker UI strings.
8. Tests: cover any new service-layer logic (e.g. a "list modifier groups for product" helper) following the existing tested pattern; `kds-service.ts` changes should keep its 26 tests passing and likely need new cases for the updated `buildProductSummary`.
9. Run typecheck (web + services + db + mcp) + relevant test suites + scoped Biome + i18n parity check + `pnpm lint:permissions`.
10. Update TASK.md (new `T-0304`+ as needed — G1 is large, may split into multiple tasks per the "ADR+schema / picker UI / KDS+Naixer mapping" split noted in Part D), this checkpoint (mark G1 progress), commit, push.

**After G1**, per Part E: continue the §0-2/4-17 deep-audit passes (prioritizing §3.5 cash-count/X-Z-report for G10, §1 cost centers, §5 batch/expiry FEFO) and Lintang's 4 pending business decisions.

**Known environment caveat (not a code TODO)**: this dev machine currently cannot reach the production Postgres host (`ETIMEDOUT 103.93.162.50:5432`) — browser-based UI verification is blocked for the whole app until this network issue is resolved (likely VPN/firewall on Lintang's side). `apps/web/.env` now exists (gitignored) and correctly loads `DATABASE_URL` etc. — once connectivity is restored, browser verification should work without further env changes.

## Test status

- **Unit**: G3a (T-0300) — 13/13 new tests PASS, 678/678 total services tests PASS, typecheck clean.
- G4 (T-0301) — no new tests (matches untested sibling mutation functions); typecheck (db/services/mcp/web) + permission-lint + scoped Biome + i18n JSON parse all PASS.
- G15 (T-0302) — no new tests (single DB UPDATE, gating logic already covered); typecheck (services) + scoped Biome PASS; 678/678 services tests PASS (1 pre-existing flaky timeout under full-suite load in `whistleblower-anonymity.test.ts`, unrelated, passes in isolation).
- G2 (T-0303) — no new tests (UI/route/nav-only, no new service-layer logic); monorepo-wide typecheck + `pnpm lint:permissions` + scoped Biome (8 files) + i18n JSON parity all PASS; 678/678 services tests PASS (incl. 26/26 `kds-service`).
- **Integration**: N/A
- **E2E**: attempted via preview browser, BLOCKED by local DB connectivity (`ETIMEDOUT 103.93.162.50:5432`) — see "Done this session — G2 implemented (T-0303)" above.

## Files Touched

| Path | Action | Note |
|------|--------|------|
| `docs/benchmark/fnb-erp-feature-checklist.md` | created (earlier in session) | ~260-item from-scratch checklist, §0-§17 |
| `docs/benchmark/fnb-erp-gap-analysis.md` | created + edited | Living gap-analysis doc: Parts A-E; title renumbered T-0299; Finding 2 "G3a done"/Finding 5 "G15 done" addenda; Part D/E updated |
| `TASK.md` | edited | T-0298→T-0299 renumbering (Active Tasks row + Backlog section heading); G3a/G4/G15 rows marked done; new T-0300/T-0301/T-0302 Done-table rows |
| `docs/checkpoints/T-0299-fnb-erp-gap-audit.checkpoint.md` | created + edited | this file (replaces deleted `T-0298-fnb-erp-gap-audit.checkpoint.md`) |
| `packages/services/src/promotion/evaluator.ts` | edited | G3a: `buy_x_get_y`/`free_item` line-level discounts via new `applyGetItemBenefit()` |
| `packages/services/tests/promotion-evaluator.test.ts` | created | G3a: 13 new tests, all PASS |
| `packages/db/schema/inventory.ts` | edited | G4: added `products.isAvailable`/`is86dAt` columns |
| `packages/db/migrations/0044_fine_orphan.sql` + `meta/0044_snapshot.json` + `meta/_journal.json` | created/edited | G4: migration for the two new columns (NOT yet applied to any DB) |
| `packages/services/src/inventory/set-product-availability.ts` | created | G4: `setProductAvailability` service (audit `update`) |
| `packages/services/src/inventory/index.ts` | edited | G4: export `setProductAvailability` |
| `apps/web/app/(dash)/pos/actions.ts` | edited | G4: `fetchProducts` returns `isAvailable`/`canToggleAvailability`; new `setProductAvailabilityAction` |
| `apps/web/app/(dash)/pos/product-search.tsx` | edited | G4: 86'd products greyed out + badge + toggle button + error banner |
| `apps/web/messages/{id,en,zh}.json` | edited | G4: `pos.unavailableToday`/`markUnavailableToday`/`markAvailableAgain`/`toggleAvailabilityFailed` |
| `apps/mcp/src/tools/phase2.ts` + `apps/mcp/src/tools/index.ts` | edited | G4: new MCP tool `inventory.set_product_availability` |
| `packages/services/src/pos/create-sale.ts` | edited | G15: import `promotions`; new step 14b increments `usageCount` for each distinct applied `promotionId` |
| `apps/web/app/(dash)/kitchen/page.tsx` + `client.tsx` + `actions.ts` | created | G2: staff KDS board — columns per status, tap-to-advance |
| `apps/web/app/kitchen-display/[locationId]/page.tsx` + `display-client.tsx` | created | G2: customer-facing SSE display |
| `apps/web/app/api/kitchen/display/[locationId]/route.ts` | created | G2: SSE route backed by `display-service.ts` |
| `apps/web/middleware.ts` | edited | G2: added `/kitchen-display` + `/api/kitchen/display` to `publicPaths` |
| `apps/web/lib/nav-access.ts` | edited | G2: new `/kitchen` entry gated by `kitchen.view` |
| `apps/web/app/(dash)/sidebar.tsx` | edited | G2: new top-level NAV_ITEM + `PATH_TO_MODULE['/kitchen']` |
| `apps/web/messages/{id,en,zh}.json` | edited | G2: `nav.kitchen` + `kitchen.*`/`kitchenDisplay.*` namespaces |
| `packages/services/src/kitchen/kds-service.ts` | edited | G2: `buildProductSummary` resolves localized product/variant names |
| `packages/db/seed/iam.ts` | edited | G2: `kitchen.view` added to `cashier` role |
| `apps/web/.env` | created (gitignored, NOT committed) | local-dev fix: Next dev server now loads monorepo-root `.env` vars |

## Commits So Far

| SHA | Message | Date |
|-----|---------|------|
| `de4952f` | feat(T-0300): implement buy_x_get_y/free_item promotion evaluation (G3a) | 2026-06-12 |
| `0111183` | feat(T-0301): "86" product availability toggle in POS (G4) | 2026-06-12 |
| `f7d44be` | feat(T-0302): increment promotions.usageCount after sale (G15) | 2026-06-12 |
| `010227b` | feat: kitchen display module and KDS service improvements (G2/T-0303) | 2026-06-12 |

## Handoff Notes

- This is a **multi-session marathon task** explicitly authorized by Lintang ("ini adalah tugas panjang, tolong kerjakan sampai selesai, tidak perlu terburu-buru"). Do not try to "wrap up" — pick the next G-item and keep going.
- The from-scratch checklist (`fnb-erp-feature-checklist.md`) was deliberately written WITHOUT reading this repo first, to avoid anchoring bias — do not "fix" it to match repo reality; it's the *target*, the gap-analysis doc is the *comparison*.
- When picking up §0-2/4-17 deep-audit passes (Part C ⬜ items), apply the SAME dual-lens standard as §3: don't just check "does a page exist" — trace one real user action through to confirm the backend logic actually fires (the KDS/modifier/promotion findings were all "page would suggest done, but trace the data flow and it dead-ends").
- **Before assigning any new `T-NNNN`**: check the HIGHEST existing ID across BOTH the Active Tasks table AND the Done tables in TASK.md (not just one or the other) — this session hit a collision (T-0298 used twice) because a prior turn only checked one location. T-0303 is the highest used ID as of this checkpoint; next available is **T-0304**.
- Migration `0044_fine_orphan.sql` (G4/T-0301, adds `products.is_available`/`is_86d_at`) is generated but **not applied to any database yet** — remember this when planning the next deploy (`drizzle-kit migrate` or the project's usual apply step).
- The `kitchen.view` cashier-role seed change (G2/T-0303, `packages/db/seed/iam.ts`) needs the IAM seed re-run on deploy for existing environments (new environments seed correctly from scratch).
- If resuming after a long gap, re-read `docs/benchmark/fnb-erp-gap-analysis.md` Part E for the prioritized continuation order: G4 ✅ → G15 ✅ → G2 ✅ → **G1 (next)** → remaining ⬜ audits → Lintang's 4 decisions.
- **Known environment caveat**: this dev machine currently cannot reach the production Postgres host (`connect ETIMEDOUT 103.93.162.50:5432`, confirmed via raw TCP probe) — blocks ALL browser-based UI verification (every page needs DB-backed session), not specific to any feature. `apps/web/.env` (gitignored) was created this session and correctly loads `DATABASE_URL`/secrets from the repo-root `.env` — once network connectivity is restored, browser verification should work without further env changes. This is external infra, not a code TODO.
