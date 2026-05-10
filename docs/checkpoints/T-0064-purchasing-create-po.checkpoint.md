# T-0064 — Service purchasing.createPO + workflow approval

| Field | Value |
|-------|-------|
| **Owner** | Claude Opus 4.6 |
| **Started** | 2026-05-11 |
| **Last updated** | 2026-05-11 |
| **Status** | 🟩 DONE |
| **Phase** | 2 |
| **Commit** | ac09649 |

---

## Deliverables

1. `packages/services/src/purchasing/schemas.ts` — Zod input schemas (CreatePO, Submit, Approve, Cancel)
2. `packages/services/src/purchasing/number-generator.ts` — PO-YYYY-MM-NNNN per location per month
3. `packages/services/src/purchasing/create-po.ts` — createPO service with tax computation
4. `packages/services/src/purchasing/workflow.ts` — submitPO, approvePO (with AP journal), cancelPO
5. `packages/services/src/purchasing/index.ts` — barrel exports
6. `packages/services/tests/purchasing-create-po.test.ts` — 51 unit tests

## Key decisions

- AP journal on approval: DR Inventory (1-1210), CR Utang Usaha (2-1010)
- Director role required for PO approval
- Cancellation: draft/submitted/approved allowed; closed/cancelled/received blocked
- Approved PO cancel restricted to creator or director
- Optimistic locking via version column
