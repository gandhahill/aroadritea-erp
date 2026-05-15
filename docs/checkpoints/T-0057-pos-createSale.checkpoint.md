# T-0057 Checkpoint — POS Services

**Task**: Service `pos.createSale` + shift open/close + void
**Status**: ✅ DONE
**Date**: 2026-05-09

---

## Files Created

- `packages/services/src/pos/schemas.ts` — Zod schemas: Channel, OpenShiftInput, CloseShiftInput, CreateSaleInput, VoidSaleInput + return types
- `packages/services/src/pos/shift-service.ts` — openShift, closeShift, getOpenShift
- `packages/services/src/pos/create-sale.ts` — createSale, voidSale, getBOMIngredients, deductIngredients, extractPB1
- `packages/services/src/pos/index.ts` — barrel exports
- `packages/services/tests/pos.test.ts` — 50 tests (schema validation + PB1 math + shift calc + delivery multiplier)

**Files Modified**:
- `packages/db/schema/pos.ts` — shifts table has no `version` column (removed from update set), cast via `unknown as ShiftRow` to access it
- `TASK.md` — updated T-0057 to DONE

---

## What Was Built

### createSale workflow (SD §9.5, §21.4)
1. Permission check (`pos.transact`)
2. Validate shift open + idempotency key
3. Validate all products are active + sellable (skip BOM for service items)
4. Calculate per-line: unitPrice × qty = subtotal, extractPB1 (net = price×10000/11000, pb1 = price - net)
5. BOM deduction: lookup active BOM → scale by qty → deduct from stock_levels + create stock_movement (reason='sale')
6. Insert sales_order (status='paid') + order lines + payments
7. Create journal entry:
   - DR Cash/Bank (1-1300) = grandTotal
   - CR Revenue (4-1100) = subtotal - pb1 (or ×0.8 for delivery channels)
   - CR PB1 Payable (2-1500) = totalPB1
8. Delivery channels (gofood/grabfood/shopeefood): revenue = 80% × gross (net of commission)
9. Idempotency record with 24h expiry

### shift-service
- openShift: enforces one open shift per location
- closeShift: expectedCash = openingCash + sum(cash payments), variance = actual - expected (cashTotal via innerJoin query)
- getOpenShift: returns open shift for location

### Key Bug Fixes
- `create-sale.ts` was corrupted by a bad Edit (wrong comment match) — fixed by splitting the merged functions
- `sql` import was missing from create-sale.ts — added
- Schema `actualCash` regex had `$$` (literal dollar) instead of `$` — fixed in schemas.ts
- `LocaleStringSchema` doesn't exist in `@erp/shared/types` — removed unused import
- `shifts.version` missing from Drizzle inferred type — cast via `unknown as ShiftRow`
- `version` not in shifts table update set (removed) — `.where()` only checks id, not version
- `extractPB1` used wrong formula (×100/110 then ÷100) — changed to correct formula `×10000/11000`
- Unused variables `cashPayments`, `cashOnlyPayments` removed from closeShift
- `DELIVERY_CHANNEL_COMMISSION_RATE` constant declared but unused — removed

---

## Next Steps

**Immediate next task**: T-0058 — `pos.refund` service

After T-0057, T-0059 (pos.openShift/closeShift) is essentially done (already in shift-service.ts). T-0058 (pos.refund) is the next distinct task.

T-0058 pos.refund:
- Reverse JE: reverse the original JE (mark original as reversed + create reversal JE)
- Stock reversal: add back BOM ingredients to stock_levels + create stock_movement (reason='refund')
- Status: 'paid' → 'refunded'
- Permission: `pos.refund`
