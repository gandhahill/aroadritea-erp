# T-0073 + T-0075 Checkpoint — Stock Opname Schema + Service

**Task**: Stock opname schema + service workflow
**Status**: ✅ DONE
**Commit**: fe2f2c8
**Date**: 2026-05-10

---

## Files Created

- `packages/db/schema/stock-opname.ts` — 3 tables
- `packages/services/src/inventory/opname-service.ts` — full workflow service
- `packages/services/src/inventory/number-generator.ts` — added `generateOpnameNumber`
- `packages/db/index.ts` — added stock-opname exports
- `packages/services/src/inventory/index.ts` — added opname service exports

**Files Modified**:
- `apps/web/app/(dash)/pos/payment-modal.tsx` — fix payment flow logic
- `TASK.md` — T-0059+60 marked done, T-0073+75 added to Phase 2.5

---

## What Was Built

### Schema (T-0073)

**`stock_opname_sessions`**: header with number (SO-YYYY-MM-NNNN), sessionDate, periodCode, status (draft|in_progress|submitted|approved|cancelled), preparedBy/submittedBy/approvedBy timestamps, version.

**`stock_opname_lines`**: per-product snapshot lines with systemQty (from stock_levels at create time), countedQty (physical input), isCounted flag, varianceQty, varianceValue (bigint = |variance| × avgUnitCost).

**`stock_movement_manual`**: staging table for T-0074 (Excel import Sheet 2), with `processed` flag and `processedAt`.

### Service (T-0075)

**`createOpnameDraft`**: permission check, period validation, snapshot all active product stock levels as lines, generate number SO-YYYY-MM-NNNN, audit log.

**`recordCount`**: update countedQty + isCounted on lines, transition draft→in_progress.

**`submitOpname`**: all lines must be counted, calculate varianceQty + varianceValue per line using avgUnitCost from stock_levels.

**`approveOpname`**: director role check, for each line with variance≠0: upsert stock_levels + create stock_movement (reason=adjustment, refType=stock_opname), create balancing JE (shortage=DR 6-1110/CR 1-1210, surplus=DR 1-1210/CR 4-2020), audit log.

**`cancelOpname`**: allowed from draft/in_progress only.

**`getOpname`**: load session + lines.

### Key Design Decisions

- VarianceJE uses `referenceType: 'manual'` (only valid enum value)
- `upsertStockLevel` helper avoids `onConflictDoUpdate` (not in all DB drivers)
- `generateId()` on every audit log insert (required by schema)

---

## TypeScript

- `pnpm tsc -p packages/services/tsconfig.json --noEmit` — clean
- `pnpm tsc -p apps/web/tsconfig.json --noEmit` — clean

---

## Next Steps

**Immediate next**: T-0076 — UI stock opname (session create + physical count input + approve variance)