# T-0071 — Service reimbursement (CRUD + workflow + escalation)

| Field | Value |
|-------|-------|
| **Owner** | Claude Opus 4.6 |
| **Started** | 2026-05-10 |
| **Last updated** | 2026-05-10 |
| **Status** | 🟩 DONE |
| **Phase** | 2 |
| **Branch** | master |

---

## Done

- Created `reimbursement.ts` with 7 functions:
  - `createReimbursement` — create draft with validation
  - `submitReimbursement` — draft → submitted
  - `approveReimbursement` — submitted → approved (sets approvedBy/At)
  - `disburseReimbursement` — approved → disbursed (sets disbursedAt)
  - `rejectReimbursement` — submitted → rejected (with reason)
  - `listReimbursements` — paginated list with optional status/location filters
  - `getStaleReimbursements` — for worker cron (>48h submitted without action)
- State machine: `VALID_TRANSITIONS` map enforces valid workflow transitions
- Added 3 Zod schemas: `CreateReimbursementSchema`, `RejectReimbursementSchema`, `ListReimbursementsSchema`
- All functions follow Result pattern with permission checks and audit logging
- Updated barrel exports
- Typecheck clean

## Files Touched

| File | Action |
|------|--------|
| `packages/services/src/accounting/reimbursement.ts` | Added |
| `packages/services/src/accounting/schemas.ts` | Modified — 3 schemas |
| `packages/services/src/accounting/index.ts` | Modified — barrel exports |

## Next step

Task complete. Next: T-0069 (UI petty cash) or T-0072 (UI reimbursement).
