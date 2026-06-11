# Checkpoint: T-0295 — Stock UOM normalization at every stock_levels write path

- **Owner**: claude-fable-5
- **Started**: 2026-06-11 12:13 WIB
- **Last updated**: 2026-06-11 12:36 WIB
- **Status**: 🟩 DONE
- **Phase**: F3 (functional sweep — production incident follow-up)
- **Branch**: master (hotfix-class change, committed directly per repo convention for prod incident follow-ups)

## Goal

Production incident 2026-06-11: POS "Pemakaian Bahan" posting at outlet MLI failed with `pos.createSale.ingredientUomMismatch` because 5 `stock_levels` rows carried a uom different from `products.uom` (opening balance recorded GK500 as `pcs` vs master `cup`; pearl toppings adjusted in `pcs` vs master `pack`). Data was already corrected manually on prod (uom normalized + audit_log). This task makes the code prevent recurrence:

1. Every code path that writes a `stock_levels` row must store the **product master uom**; differing input uom is converted via `uom_conversions` (`convertQty`) or rejected with a clear error.
2. The cashier-facing error for deduction failures must name the ingredient and both uoms via i18n, not show a raw message key.

- Spec teknis: SYSTEM-DESIGN §9.3 (products.uom is the canonical stock unit; stock_levels is a cache of stock_movements)
- CLAUDE.md §5.7 (no hardcoded UI strings; audit trail mandatory)

**Kriteria selesai (Definition of Done):**
- [ ] Shared helper `toProductUom` in `packages/services/src/inventory/uom-service.ts` (+ moved `normalizeUom`)
- [ ] GRN, adjustment, transfer (receive), opname upsert, import, seed stock-initial all normalize uom before writing stock_levels
- [ ] Deduction error in consumed/manual-sales actions shows ingredient name + uoms (i18n en/id/zh)
- [ ] Unit tests for normalization helper pass
- [ ] typecheck + lint + existing services tests pass
- [ ] Commit + push

## Plan

1. [x] Add `normalizeUom` + `toProductUom` (+ unit-cost rescale helper) to `uom-service.ts`; re-use from `create-sale.ts`
2. [x] grn-service.ts: normalize line qty/uom/unitCost before movements + stock writes (confirmGRN, validated pre-transaction)
3. [x] adjustment-service.ts: normalize qtyDelta/qtyAfter/unitCost before journal + writes (approveAdjustment step 4b)
4. [x] transfer-service.ts: normalize at the entry points — createTransferDraft + updateTransferDraft persist lines in product uom, so ship/receive inherit it
5. [x] opname-service.ts: normalize in approveOpname before the status claim; `upsertStockLevel` update path now re-aligns uom (absolute reset heals legacy rows)
6. [x] import-service.ts: reject row when Excel SATUAN differs from existing product uom (no silent master drift; stock rows written in master uom)
7. [x] seed/stock-initial.ts: use product uom, skip rule on mismatch with console.warn
8. [x] Web: `describeDeductError` helper + 3 i18n keys (en/id/zh) wired into consumed + manual-sales actions
9. [x] Tests: `packages/services/tests/uom-normalization.test.ts` (11 tests)
10. [x] typecheck (services/db/web) PASS, biome touched-files clean (15 pre-existing warnings only), services tests 665/665 PASS, i18n parity PASS

## Done so far

- Root cause analysis + prod data fix (5 rows, audit_log entries) — done in prior session via VPS SSH.
- All plan steps complete; see Files Touched.

## Decisions

- `stock_movements` written by these flows now also record the normalized (product) uom so `stock_levels` stays recomputable from movements in one unit.
- Import: when Excel SATUAN ≠ existing product uom (case-insensitive), the row errors and is skipped — silently changing master uom would orphan stock rows at other outlets.
- PO remaining-qty checks in GRN stay in the PO line's (input) uom; only stock/movement writes are normalized.

## Open issues / Questions

- `uom_conversions` has no management UI yet (table empty in prod) — separate backlog item.

## Next step

Selesai. Tindak lanjut opsional (tidak diblok): UI manajemen `uom_conversions` (tabel masih kosong, hanya bisa diisi via SQL) — masuk backlog.

## Test status

- **Unit**: 665/665 lulus (`pnpm --filter @erp/services test`), termasuk 11 tes baru `uom-normalization.test.ts`
- **Integration**: tercakup suite services yang ada
- **E2E**: N/A

## Files Touched

| Path | Action | Note |
|------|--------|------|
| packages/services/src/inventory/uom-service.ts | edit | +`normalizeUom`, `toProductUom`, `scaleUnitCostToProductUom`, `ProductUomQty` |
| packages/services/src/pos/create-sale.ts | edit | `normalizeUom` dipindah ke uom-service (re-export tetap) |
| packages/services/src/purchasing/grn-service.ts | edit | confirmGRN: normalisasi qty/uom/unitCost per line sebelum movement + stock write |
| packages/services/src/inventory/adjustment-service.ts | edit | approveAdjustment step 4b: normalisasi qtyDelta/qtyAfter/unitCost; update path juga menulis uom |
| packages/services/src/inventory/transfer-service.ts | edit | create/updateTransferDraft simpan line dalam uom master produk |
| packages/services/src/inventory/opname-service.ts | edit | approveOpname normalisasi sebelum klaim; upsert update path re-align uom |
| packages/services/src/inventory/import-service.ts | edit | SATUAN beda dari master → row error + skip; stock pakai uom master |
| packages/db/seed/stock-initial.ts | edit | pakai products.uom; rule mismatch di-skip dengan warn |
| apps/web/app/(dash)/pos/manual-sales/deduct-error.ts | new | `describeDeductError`: error deduksi → pesan i18n bernama bahan |
| apps/web/app/(dash)/pos/manual-sales/actions.ts | edit | pakai describeDeductError di createManualSalesAction |
| apps/web/app/(dash)/pos/manual-sales/consumed/actions.ts | edit | pakai describeDeductError di createConsumedIngredientsAction |
| apps/web/messages/en.json, id.json, zh.json | edit | +errorIngredientUomMismatch / errorIngredientInsufficient / errorIngredientStockMissing |
| packages/services/tests/uom-normalization.test.ts | new | 11 unit tests |

## Commits So Far

| SHA | Message | Date |
|-----|---------|------|
| 50ebc7a | fix(T-0295): normalize stock uom to product master on every stock write | 2026-06-11 |
