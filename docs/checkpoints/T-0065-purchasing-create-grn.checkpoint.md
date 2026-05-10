# T-0065 — Service purchasing.createGRN + JE generator

| Field | Value |
|-------|-------|
| **Owner** | Claude Opus 4.6 |
| **Started** | 2026-05-11 |
| **Last updated** | 2026-05-11 |
| **Status** | 🟨 IN_PROGRESS |
| **Phase** | 2 |
| **Branch** | master |

---

## Task

Service `purchasing.createGRN` + confirm + JE generator (SD §21.6).

## Specification

**GRN workflow:** draft → confirmed

**Service `createGRN(params, ctx)`:**
- Validate: PO exists and is approved/partial
- Validate: all lines reference valid PO lines
- Validate: qtyReceived per line ≤ remaining (qtyOrdered - already received)
- Generate GRN number: `GRN-{YYYY-MM}-{SEQ:04}`
- Insert GRN header + lines in transaction
- Record audit

**Service `confirmGRN(grnId, ctx)`:**
- Transition: draft → confirmed
- Update PO lines: add qtyReceived
- Create stock movements (reason='grn')
- Update stock_levels
- Create JE: DR Inventory, CR GRNI (Goods Received Not Invoiced)
- Update PO status: approved→partial or partial→received (if all lines fully received)
- Record audit

## Files to create

1. `packages/services/src/purchasing/grn-schemas.ts` — Zod input schemas
2. `packages/services/src/purchasing/grn-service.ts` — createGRN + confirmGRN
3. `packages/services/tests/purchasing-grn.test.ts` — unit tests
4. Update `packages/services/src/purchasing/index.ts` — add GRN exports

## Key design decisions

- GRNI account: need to check COA seed or create new account 2-1120 "Barang Diterima Belum Ditagih"
- Stock movement created on GRN confirm, not on PO approve
- PO status auto-updates based on cumulative qty received vs ordered

## Next step

1. Check if GRNI account exists in COA seed
2. Create grn-schemas.ts
3. Create grn-service.ts (createGRN + confirmGRN)
4. Tests
5. Update index.ts
6. Typecheck + commit
