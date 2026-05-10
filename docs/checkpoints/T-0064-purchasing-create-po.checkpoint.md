# T-0064 — Service purchasing.createPO + workflow approval

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

Service `purchasing.createPO` + workflow approval (SD §21.6).

## Specification

**SD §21.6 Workflow:**
```
draft → submitted → approved → partial → received → closed
                                              ↘ cancelled
```

**Service `createPO(params, ctx)`:**
- Validate: supplier exists, lines non-empty, all products exist
- Compute lineSubtotal = qty × unitPrice per line
- Compute tax per line (if taxCode → lookup via tax.resolve)
- Compute subtotal, taxTotal, grandTotal (all bigint)
- Generate PO number: `PO-{YYYY-MM}-{SEQ:04}` via number-generator
- Insert PO header + lines in transaction
- Record audit

**Service `submitPO(poId, ctx)`:**
- Transition: draft → submitted
- Requires: `purchasing.po.create` permission
- Sets `submittedBy`, `submittedAt`
- If auto-approve config: also transition to approved

**Service `approvePO(poId, ctx)`:**
- Transition: submitted → approved
- Requires: `purchasing.po.approve` permission
- Sets `approvedBy`, `approvedAt`
- Creates AP journal entry (DR Inventory/Expense, CR AP)

**Service `cancelPO(poId, reason, ctx)`:**
- Any status → cancelled
- Requires: `purchasing.po.create` permission
- Only owner or admin can cancel approved POs

## Files to create

1. `packages/services/src/purchasing/schemas.ts` — Zod input schemas
2. `packages/services/src/purchasing/number-generator.ts` — PO number format
3. `packages/services/src/purchasing/create-po.ts` — createPO service
4. `packages/services/src/purchasing/workflow.ts` — submit/approve/cancel
5. `packages/services/src/purchasing/index.ts` — barrel exports
6. `packages/services/tests/purchasing-create-po.test.ts` — unit tests

## Key design decisions

- Bigint for all money values
- Tax per line: lookup via tax.resolve using item-level tax_code
- PO number: `PO-2026-05-0001` (per location per month)
- `requirePermission` gates each action
- All state transitions validated server-side
- Audit trail via `audit.record`

## Next step

1. Create schemas.ts with Zod input schemas
2. Create number-generator.ts
3. Create create-po.ts
4. Create workflow.ts (submit/approve/cancel)
5. Tests
6. Typecheck + commit
