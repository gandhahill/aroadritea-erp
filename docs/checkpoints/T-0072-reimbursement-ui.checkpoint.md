# T-0072 — Reimbursement UI Checkpoint

**Task**: UI reimbursement (form + list + approve/reject)
**Status**: ✅ DONE
**Owner**: Claude Opus 4.6
**Started**: 2026-05-10
**Last Updated**: 2026-05-10
**Commit**: 01f1bc6

---

## Files Changed

- `apps/web/app/(dash)/accounting/reimbursement/actions.ts` — new
- `apps/web/app/(dash)/accounting/reimbursement/page.tsx` — new
- `apps/web/app/(dash)/accounting/reimbursement/reimbursement-view.tsx` — new
- `apps/web/app/(dash)/sidebar.tsx` — modified (added Reimbursement nav link)

---

## Summary of Work

### actions.ts
- `fetchReimbursements(tenantId, statusFilter?)` — list reimbursement requests ordered by date
- `fetchLocations(tenantId)` — fetch locations for dropdown
- `createReimbursement(data, tenantId, userId)` — create as draft
- `submitReimbursement(id, tenantId, userId)` — draft → submitted
- `approveReimbursement(id, tenantId, userId)` — submitted → approved
- `rejectReimbursement(id, reason, tenantId, userId)` — submitted → rejected
- `disburseReimbursement(id, tenantId, userId)` — approved → disbursed

### reimbursement-view.tsx
- `ReimbursementClient` — wrapper with local state + refresh capability
- `ReimbursementViewInner` — main view with summary cards, filter pills, table, detail panel
- `CreateModal` — form modal for new reimbursement request
- `RejectModal` — modal for entering rejection reason
- All server actions wrapped in `useTransition`

### page.tsx
- Server component that fetches initial data and renders `ReimbursementClient`

### sidebar.tsx
- Added "Reimbursement" nav link under Accounting

---

## Bugs Fixed During Implementation

- `users.name` → `users.displayName` (schema users table has `displayName`, not `name`)
- `STATUS_STYLES.draft` fallback → explicit object to satisfy TypeScript non-null narrowing
- `locationName` mapping: was reading `.id` from LocaleString object — fixed to read correctly

---

## TypeScript

- `tsc --noEmit` → 0 errors ✅

---

## Next Step

Task T-0072 is complete. Next task from Backlog: **T-0077** (UI inventory variance dashboard) or **T-0080** (UI journal attachments).
