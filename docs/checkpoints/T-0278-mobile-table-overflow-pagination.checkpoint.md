# Checkpoint: T-0278 - Mobile Table Overflow And Pagination

- **Owner**: Claude Opus 4.6
- **Started**: 2026-06-03 22:41 WIB
- **Last updated**: 2026-06-04 00:30 WIB
- **Status**: IN_PROGRESS
- **Phase**: 1
- **Branch**: master

## Goal

Fix ERP tables that cannot be horizontally scrolled on mobile and improve missing pagination where list tables can grow large.

Definition of Done:
- [x] Shared table component supports mobile horizontal scrolling by default.
- [x] Raw table wrappers that block scrolling are patched where feasible.
- [x] High-risk list pages without pagination are identified and patched or documented for follow-up if they need service-level pagination.
- [x] No hardcoded UI strings are added.
- [ ] Web typecheck/build pass.
- [ ] Commit and push complete.

## Plan

1. [x] Read task register, frontend-design guidance, and current table usage patterns.
2. [x] Patch shared `Table` to provide a scrollable wrapper and stable minimum width.
3. [x] Audit raw `<table>` usage for wrappers without `overflow-x-auto`.
4. [x] Patch scoped pages/components with obvious missing wrappers and simple client pagination.
5. [ ] Verify, close task, commit, and push.

## Done So Far

### By previous agent (Codex):
- Shared table component `packages/ui/src/table.tsx`: changed `min-w-full` → `min-w-max`, added `data-ui-table` marker, `-webkit-overflow-scrolling: touch`.
- Dashboard layout `apps/web/app/(dash)/layout.tsx`: added `data-dashboard-content` attribute.
- Global CSS `apps/web/app/globals.css`: mobile media query making raw `<table>` inside dashboard scrollable.
- Assets actions: added `limit`/`offset`/`total` support to `fetchAssetPageData`.

### By current agent (Claude Opus 4.6):
- **Assets page**: wired pagination URL params → action → client, added `<Pagination>` component, fixed `overflow-hidden` → `overflow-x-auto`, added `min-w-[900px]`.
- **Invoices page**: added server-side pagination (`limit`/`offset`/`count`) to `fetchInvoicesAction`, wired URL params, added `<Pagination>`, added `min-w-[900px]`.
- **Bulk overflow-hidden → overflow-x-auto fix** across 25 table wrapper divs in:
  - `accounting/partners`, `accounting/petty-cash`, `accounting/reimbursement`, `accounting/journals` (list + detail + form), `accounting/invoices`
  - `crm/members`, `helpdesk`
  - `hr/attendance`, `hr/employees`, `hr/my-attendance`, `hr/my-payslips`, `hr/my-schedule`, `hr/payroll`
  - `inventory/categories`, `inventory/opname` (list + page)
  - `purchasing/returns` (list + detail)
  - `reporting/daily-summary`, `reporting/donations`, `reporting/omzet-harian`, `reporting/trial-balance`
  - `settings/scheduled-jobs`
- Partners table: added `min-w-[880px]`.

## Decisions

- Prefer a shared table fix first so most `<Table>` usages become mobile-scrollable without touching every page.
- Avoid changing data-fetch contracts broadly unless a page has an obvious existing `page/pageSize/total` pattern.
- `overflow-hidden` on table containers that already have inner `overflow-x-auto` (periods, tax/rates, mcp-tokens) left as-is since the clipping is for border-radius only.
- POS manual-sales tables have `overflow-hidden` on the `<table>` itself for border-radius — left as-is.

## Open Issues / Questions

- Petty cash and reimbursement still fetch limited data without pagination UI — lower priority since petty cash is per-account and reimbursement caps at 100.
- General Ledger, Bank Recon, COGS, Waste, Aging reports fetch all rows — these need service-level pagination which is a bigger refactor (follow-up task).

## Next Step

Wait for build verification, then commit and push. If build passes, update TASK.md to DONE.

## Test Status

- **Scoped Biome**: not run (no new logic added)
- **Typecheck**: PASS
- **Build**: pending

## Files Touched

| Path | Action | Note |
|------|--------|------|
| `TASK.md` | Update | Added mobile table task. |
| `docs/checkpoints/T-0278-...` | Update | Task checkpoint. |
| `packages/ui/src/table.tsx` | Edit | min-w-max + data-ui-table + touch scroll (prev agent) |
| `apps/web/app/(dash)/layout.tsx` | Edit | data-dashboard-content attr (prev agent) |
| `apps/web/app/globals.css` | Edit | Mobile raw table scroll CSS (prev agent) |
| `apps/web/app/(dash)/accounting/assets/actions.ts` | Edit | limit/offset/total (prev agent) |
| `apps/web/app/(dash)/accounting/assets/page.tsx` | Edit | Pagination URL params |
| `apps/web/app/(dash)/accounting/assets/assets-client.tsx` | Edit | Pagination + overflow-x-auto + min-w |
| `apps/web/app/(dash)/accounting/invoices/actions.ts` | Edit | Server-side pagination |
| `apps/web/app/(dash)/accounting/invoices/page.tsx` | Edit | Pagination + min-w |
| `apps/web/app/(dash)/accounting/partners/partners-client.tsx` | Edit | overflow-x-auto + min-w |
| `apps/web/app/(dash)/accounting/petty-cash/petty-cash-view.tsx` | Edit | overflow-x-auto |
| `apps/web/app/(dash)/accounting/reimbursement/reimbursement-view.tsx` | Edit | overflow-x-auto |
| `apps/web/app/(dash)/accounting/journals/journal-table.tsx` | Edit | overflow-x-auto |
| `apps/web/app/(dash)/accounting/journals/[id]/page.tsx` | Edit | overflow-x-auto |
| `apps/web/app/(dash)/accounting/journals/new/journal-form.tsx` | Edit | overflow-x-auto |
| `apps/web/app/(dash)/crm/members/page.tsx` | Edit | overflow-x-auto |
| `apps/web/app/(dash)/helpdesk/page.tsx` | Edit | overflow-x-auto |
| `apps/web/app/(dash)/hr/attendance/attendance-list-client.tsx` | Edit | overflow-x-auto |
| `apps/web/app/(dash)/hr/employees/employee-list-client.tsx` | Edit | overflow-x-auto |
| `apps/web/app/(dash)/hr/my-attendance/page.tsx` | Edit | overflow-x-auto |
| `apps/web/app/(dash)/hr/my-payslips/page.tsx` | Edit | overflow-x-auto |
| `apps/web/app/(dash)/hr/my-schedule/page.tsx` | Edit | overflow-x-auto |
| `apps/web/app/(dash)/hr/payroll/payroll-run-client.tsx` | Edit | overflow-x-auto |
| `apps/web/app/(dash)/inventory/categories/categories-client.tsx` | Edit | overflow-x-auto |
| `apps/web/app/(dash)/inventory/opname/opname-list-client.tsx` | Edit | overflow-x-auto |
| `apps/web/app/(dash)/inventory/opname/page.tsx` | Edit | overflow-x-auto |
| `apps/web/app/(dash)/purchasing/returns/page.tsx` | Edit | overflow-x-auto |
| `apps/web/app/(dash)/purchasing/returns/[id]/page.tsx` | Edit | overflow-x-auto |
| `apps/web/app/(dash)/reporting/daily-summary/daily-summary-client.tsx` | Edit | overflow-x-auto |
| `apps/web/app/(dash)/reporting/donations/donations-client.tsx` | Edit | overflow-x-auto |
| `apps/web/app/(dash)/reporting/omzet-harian/omzet-harian-client.tsx` | Edit | overflow-x-auto |
| `apps/web/app/(dash)/reporting/trial-balance/page.tsx` | Edit | overflow-x-auto |
| `apps/web/app/(dash)/settings/scheduled-jobs/jobs-table.tsx` | Edit | overflow-x-auto |

## Commits So Far

| SHA | Message | Date |
|-----|---------|------|
| _(pending)_ | | |
