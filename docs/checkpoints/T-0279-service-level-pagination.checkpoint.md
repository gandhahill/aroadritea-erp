# Checkpoint: T-0279 - Service-Level Pagination for Reporting/Finance Pages

- **Owner**: Claude Opus 4.6
- **Started**: 2026-06-04 01:00 WIB
- **Last updated**: 2026-06-04 01:45 WIB
- **Status**: IN_PROGRESS
- **Phase**: 1
- **Branch**: master

## Goal

Add pagination to reporting/finance pages that currently fetch all rows unbounded.

## Plan

1. [x] Reimbursement — remove hard cap `.limit(100)`, add count query + limit/offset, wire UI Pagination
2. [x] Petty Cash — add count + offset to `fetchPettyCashTransactions`, show "X of Y" indicator per account
3. [x] Bank Recon list — add limit/offset/count to `fetchStatements`, wire UI Pagination
4. [x] General Ledger — add page/pageSize to service, compute running balance from opening + pre-offset aggregate
5. [ ] COGS/Waste/Aging reports — deferred (data inherently bounded by product/partner count in F&B)
6. [ ] Typecheck + build
7. [ ] Commit + push

## Done So Far

### Reimbursement (`apps/web/app/(dash)/accounting/reimbursement/`)
- `actions.ts`: removed hard `.limit(100)`, added count query + limit/offset params, return `{ items, total }`
- `page.tsx`: reads `page`/`pageSize` from searchParams, passes to action, renders `<Pagination>`
- `reimbursement-view.tsx`: updated refresh to use new `{ items }` shape

### Petty Cash (`apps/web/app/(dash)/accounting/petty-cash/`)
- `actions.ts`: `fetchPettyCashTransactions` now returns `{ items, total }` with limit/offset
- `page.tsx`: extracts items + totals from result, passes `transactionTotals` to view
- `petty-cash-view.tsx`: accepts `transactionTotals`, shows "Showing X of Y" when more data exists
- i18n: added `showingOf` key to id/en/zh

### Bank Recon (`apps/web/app/(dash)/accounting/bank-recon/`)
- `actions.ts`: `fetchStatements` now returns `{ items, total }` with count + limit/offset
- `page.tsx`: reads page/pageSize from searchParams, renders `<Pagination>`

### General Ledger (`packages/services/src/reporting/general-ledger.ts`)
- Service: added `limit`/`offset` to input, `totalLines` to result
- Computes ending balance from full-period aggregate (always correct regardless of pagination)
- Computes pre-page running balance via subquery SUM for rows before offset
- Returns paginated lines with correct running balance
- `actions.ts`: passes pagination params
- `page.tsx`: reads page/pageSize, renders `<Pagination>` with [20,50,100] options

## Decisions

- COGS, Waste, Aging deferred: data is inherently bounded by product/partner count in an F&B business. Client-side pagination would add complexity and break XLSX export which needs all data. Follow-up if needed.
- GL default page size = 50 (higher than other pages because accountants need to see more context)
- Petty cash uses "showing X of Y" indicator instead of full pagination because transactions are per-account tabs (no URL-based account selection)

## Next Step

Wait for build result, then commit and push.

## Test Status

- **Services typecheck**: PASS
- **Web typecheck**: PASS
- **Build**: pending
