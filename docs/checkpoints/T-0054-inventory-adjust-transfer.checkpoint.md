# T-0054 + T-0055 Checkpoint

**Task**: Service `inventory.adjust` + `inventory.transfer`
**Status**: ✅ DONE
**Date**: 2026-05-09

---

## Files created

- `packages/services/src/inventory/schemas.ts` — Zod schemas untuk adjustment + transfer inputs
- `packages/services/src/inventory/number-generator.ts` — ADJ-YYYY-MM-NNNN + TRF-YYYY-MM-NNNN generators
- `packages/services/src/inventory/adjustment-service.ts` — Workflow: draft → submitted → approved|rejected. Creates stock_movement + JE on approval
- `packages/services/src/inventory/transfer-service.ts` — Workflow: draft → in_transit → received | cancelled. Creates 2 movements per line on ship
- `packages/services/src/inventory/index.ts` — Exports barrel untuk semua adjustment + transfer functions
- `packages/services/tests/inventory-adjust-transfer.test.ts` — 61 tests (schema validation + workflow state machine + calculations)

**Files modified**:
- `packages/services/src/inventory/index.ts` — Added exports untuk adjust + transfer services + schemas
- `packages/services/src/inventory/schemas.ts` — Added adjustment + transfer input schemas
- `TASK.md` — Updated T-0054 + T-0055 to DONE

---

## What was built

### inventory.adjust workflow (SD §21.5)
- `createAdjustmentDraft(input, ctx)` → creates in `draft` status
- `submitAdjustment(id, ctx)` → transitions draft → submitted
- `approveAdjustment(input, ctx)` → transitions submitted → approved + executes:
  - Creates `stock_movement` records per line (reason='adjustment')
  - Updates/inserts `stock_levels` qty_on_hand / qty_available
  - Creates balancing JE (inventory account ↔ expense/income account) if |netDelta| > 0.5 IDR
  - **Director role check** (isDirector helper)
- `rejectAdjustment(input, ctx)` → transitions submitted → rejected + stores reason in notes

### inventory.transfer workflow (SD §21.5, §12.3)
- `createTransferDraft(input, ctx)` → creates in `draft` status
- `shipTransfer(input, ctx)` → transitions draft → in_transit + executes:
  - Creates 2 stock_movements per line (transfer_out + transfer_in)
  - Deducts source stock_levels
- `receiveTransfer(input, ctx)` → transitions in_transit → received + executes:
  - Updates destination stock_levels
  - Allows qty_received < qty_sent (partial receive for damaged goods)
- `cancelTransfer(id, ctx)` → transitions draft → cancelled (no movements yet)

### Key business rules enforced
- Only `inventory.adjust` permission for create/submit
- Only director role can approve/reject adjustments
- Accounting period must be open for adjustment date
- Products must be active
- Transfer: fromLocation ≠ toLocation
- Version mismatch → optimistic locking conflict
- Status transitions enforced (draft→submitted→approved|rejected, draft→in_transit→received)
- netDelta < 0: DR Beban Operasional (6-1110), CR Inventory (1-1210)
- netDelta > 0: DR Inventory, CR Pendapatan Lainnya (4-2020)

### Schema validation
- adjustmentDate/transferDate: YYYY-MM-DD format
- reason: enum(waste, damage, count_correction, opening_balance, other)
- qtyBefore/qtyAfter: positive decimal (signed delta, negative allowed)
- transfer qty: positive decimal (≥ 0 rejected via refine)
- qtyReceived: positive decimal (≥ 0 rejected)
- fromLocationId ≠ toLocationId: Zod refine

---

## Next Steps

**Immediate next task**: T-0057 — `pos.createSale` service + JE generator

The pos schema (T-0056) is already done. Next: implement `pos.createSale` which:
1. Reads all BOMs for sold items
2. Deducts ingredients from stock (via `InventoryPort`)
3. Creates journal entry (revenue + COGS + PB1/tax)
4. Records sales_order + lines + payment

---

## Verification
- ✅ TypeScript: `pnpm --filter @erp/services exec tsc --noEmit` — clean
- ✅ Tests: `pnpm --filter @erp/services test -- --run` — 213 tests passed (10 test files)
