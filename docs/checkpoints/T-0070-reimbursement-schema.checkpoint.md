# T-0070 — Schema reimbursement_requests

| Field | Value |
|-------|-------|
| **Owner** | Claude Opus 4.6 |
| **Started** | 2026-05-10 |
| **Last updated** | 2026-05-10 |
| **Status** | 🟩 DONE |
| **Phase** | 2 |
| **Branch** | master |

---

## Goal

Add `reimbursement_requests` table per **SYSTEM-DESIGN §25.8.1**.

## Done

- Added `reimbursementRequests` table with: pk, tenantCol, requesterId, locationId, amount (bigint), category (CHECK: operational/supplies/emergency/other), description, attachmentUrl/Name, status (CHECK: draft/submitted/approved/disbursed/rejected), approvedBy, approvedAt, disbursedAt, rejectionReason, auditCols
- Added relations: requester → users, approver → users
- Updated barrel exports in `packages/db/index.ts`
- Added 4 IAM permissions: `accounting.reimbursement.{create,approve,disburse,view}`
- Role assignments: director/vice_director (all), accountant (all), management (view+create), store_manager (view+create)
- Typecheck clean

## Files Touched

| File | Action |
|------|--------|
| `packages/db/schema/accounting.ts` | Modified — added table + relations |
| `packages/db/index.ts` | Modified — barrel export |
| `packages/db/seed/iam.ts` | Modified — 4 permissions + role mappings |

## Next step

Task complete. Next: T-0071 (Service reimbursement) or T-0069 (UI petty cash).
