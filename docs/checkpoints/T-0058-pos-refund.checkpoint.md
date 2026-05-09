# T-0058 Checkpoint — POS Refund Service

**Task**: Service `pos.refund` — refund a paid sales order
**Status**: ✅ DONE
**Date**: 2026-05-09

---

## Files Created

- `packages/services/src/pos/refund-sale.ts` — refundSale function
- `docs/checkpoints/T-0058-pos-refund.checkpoint.md` ← this file

**Files Modified**:
- `packages/services/src/pos/schemas.ts` — added `RefundSaleInputSchema` + `RefundSaleInput`
- `packages/services/src/pos/index.ts` — added `refundSale` export + `RefundSaleInputSchema` + `RefundSaleInput` type
- `packages/services/tests/pos.test.ts` — added 19 refund tests (69 total, was 50)

---

## What Was Built

### refundSale workflow (SD §21.4)
1. Permission check (`pos.refund`)
2. Load original sales order → must exist, must be 'paid', version must match
3. Call `reverseJournal(original JE)` → marks original as reversed, creates reversal JE
4. For each order line → lookup active BOM → for each ingredient → restore qty to stock_levels (upsert) + stock_movement (reason='refund')
5. Update sales_order status → 'refunded' + increment version
6. Audit log

### Key bugs fixed
- **`eq(boms.variantId, null)`** → Drizzle requires SQLWrapper for null → fixed to `sql\`boms.variant_id IS NULL\``
- **`avgUnitCost: '0'`** (string) → bigint mode column, not assignable → changed to `avgUnitCost: null`
- **`stockLevels` insert missing fields** → added `uom: ingredient.uom`, `id: generateId()` (Drizzle requires id on insert — confirmed from error message)
- **Type error cascade**: TSC error on line 173 said `'id' does not exist` in object literal type → the `id` field IS required by Drizzle's inferred insert type → kept `id: generateId()`

### Test coverage (19 new refund tests)
- Schema: valid input, optional reason, empty salesOrderId, empty reason, max length, version int/lte0
- Stock restoration: BOM × qtySold math, upsert existing vs insert new
- Journal reversal: DR/CR balance on reversal JE
- Business rules: only 'paid' allowed, version check, notes field

**Test results**: 282 passed (69 POS, was 50)

---

## Next Steps

**Immediate next task**: T-0059 — POS UI order entry (`apps/web/(dash)/pos/`)

UI needs:
- Order entry form: product search, qty, modifier JSON, line discount
- Payment modal: split payments, change calculation
- Shift status bar: open shift indicator
- Channel selector: walk_in | gofood | grabfood | shopeefood
- Refund button on paid order detail
