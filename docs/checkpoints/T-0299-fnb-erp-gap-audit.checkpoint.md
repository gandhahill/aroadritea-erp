# Checkpoint: T-0299 — F&B ERP gap audit vs Odoo/ERPNext (presence + logic dual-lens)

- **Owner**: Claude Sonnet 4.6
- **Started**: 2026-06-11 (carried over, multi-session)
- **Last updated**: 2026-06-12
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
  4. **`reservations` table dormant** (Finding 4 → G6, P2): `packages/db/schema/reservations.ts` fully modeled, zero references anywhere (services/UI/MCP/SoT/SD). Needs Lintang's keep/remove decision.
  5. **NEW — Promotion `usageLimit` never binds** (Finding 5 → G15, P1, found while implementing G3a): `evaluator.ts:71-78` correctly checks `usageCount >= usageLimit`, but a repo-wide grep for `usageCount` in `pos/create-sale.ts` (where `promotionApplications` rows are inserted) returns **zero matches** — `usageCount` is never incremented, so `usageCount >= usageLimit` is always `0 >= N` (false). A "first 50 redemptions" promo behaves as unlimited.
- **Part C** (first-pass presence table for §0-2, §4-17) written — confirms via repo-wide greps: F4.9 saved-views/scheduled-reports = MISSING; delivery-channel reconciliation = MISSING (G5); `correspondence` module = surprisingly DONE (full schema+service+UI+tests, answers §14); maintenance scheduling (§16) and quality/food-safety (§17) = confirmed MISSING via grep (only false-positive COA account match).
- **Part D** (prioritized backlog G1-G15) + "decisions needed from Lintang" written.
- **TASK.md updated**: T-0299 row in Active Tasks (top of table); "🍵 Backlog T-0299" section in the Backlog (G1-G15, G3a marked done); new T-0300 row in Phase 2 Done table.

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

> **Implement G4** — "86" toggle for products: `isAvailable`/`is86dAt` columns on `products`, a POS toggle button, and auto-grey-out in `product-search.tsx` when a product is 86'd. Small, no ADR, high visible value.

Concrete plan for G4:
1. `packages/db/schema/inventory.ts`: add `isAvailable: boolean('is_available').notNull().default(true)` and `is86dAt: timestamp('is_86d_at')` (nullable) to `products` (new migration).
2. Service: small helper in `packages/services/src/inventory/` (or wherever product mutations live) to toggle availability — must write `audit_log` (CLAUDE.md §5.3/§5.8 mandatory audit).
3. `apps/web/app/(dash)/pos/product-search.tsx`: when `!product.isAvailable`, render the product greyed-out/disabled (not clickable to add to cart).
4. POS UI: a toggle button (likely on a product card long-press/context action, or a small admin-only "86" switch) calling the new service action.
5. i18n ×3 (id/en/zh) for any new labels ("86'd", "Out of stock today", toggle button text, etc.) per CLAUDE.md's absolute i18n rule.
6. MCP tool consideration (CLAUDE.md §6): if `inventory_upsert_*` tools exist for products, consider exposing the toggle there too (check `apps/mcp/src/tools/` for existing product upsert tool first).
7. Tests: service-level test for the toggle (audit log written, `isAvailable` flips).
8. Run typecheck (services + web) + relevant test suite + Biome on touched files + i18n parity check.
9. Update TASK.md (new `T-0301`), this checkpoint, commit `feat(T-0301): ...`, push.

**After G4**, per Part E: G15 (increment `usageCount`, small/self-contained, fixes Finding 5) is a good next quick win, then G2 (KDS UI, larger).

## Test status

- **Unit**: G3a (T-0300) — 13/13 new tests PASS, 678/678 total services tests PASS, typecheck clean.
- **Integration**: N/A
- **E2E**: N/A

## Files Touched

| Path | Action | Note |
|------|--------|------|
| `docs/benchmark/fnb-erp-feature-checklist.md` | created (earlier in session) | ~260-item from-scratch checklist, §0-§17 |
| `docs/benchmark/fnb-erp-gap-analysis.md` | created + edited | Living gap-analysis doc: Parts A-E; title renumbered T-0299; Finding 2 "G3a done" addendum; new Finding 5/G15; Part D/E updated |
| `TASK.md` | edited | T-0298→T-0299 renumbering (Active Tasks row + Backlog section heading); G3a row marked done; new G15 row; new T-0300 Done-table row |
| `docs/checkpoints/T-0299-fnb-erp-gap-audit.checkpoint.md` | created | this file (replaces deleted `T-0298-fnb-erp-gap-audit.checkpoint.md`) |
| `packages/services/src/promotion/evaluator.ts` | edited | G3a: `buy_x_get_y`/`free_item` line-level discounts via new `applyGetItemBenefit()` |
| `packages/services/tests/promotion-evaluator.test.ts` | created | G3a: 13 new tests, all PASS |

## Commits So Far

| SHA | Message | Date |
|-----|---------|------|
| _(not yet committed)_ | | |

## Handoff Notes

- This is a **multi-session marathon task** explicitly authorized by Lintang ("ini adalah tugas panjang, tolong kerjakan sampai selesai, tidak perlu terburu-buru"). Do not try to "wrap up" — pick the next G-item and keep going.
- The from-scratch checklist (`fnb-erp-feature-checklist.md`) was deliberately written WITHOUT reading this repo first, to avoid anchoring bias — do not "fix" it to match repo reality; it's the *target*, the gap-analysis doc is the *comparison*.
- When picking up §0-2/4-17 deep-audit passes (Part C ⬜ items), apply the SAME dual-lens standard as §3: don't just check "does a page exist" — trace one real user action through to confirm the backend logic actually fires (the KDS/modifier/promotion findings were all "page would suggest done, but trace the data flow and it dead-ends").
- **Before assigning any new `T-NNNN`**: check the HIGHEST existing ID across BOTH the Active Tasks table AND the Done tables in TASK.md (not just one or the other) — this session hit a collision (T-0298 used twice) because a prior turn only checked one location. T-0300 is the highest used ID as of this checkpoint; next available is **T-0301**.
- If resuming after a long gap, re-read `docs/benchmark/fnb-erp-gap-analysis.md` Part E for the prioritized continuation order: G4 → G15 → G2 → G1 → remaining ⬜ audits → Lintang's 4 decisions.
