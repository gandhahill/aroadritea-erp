# T-0020 — Service `reporting.balanceSheet` + `profitLoss` + `trialBalance`

## Status: 🟨 IN_PROGRESS
## Owner: Antigravity (Opus 4.6)
## Started: 2026-05-07
## Last Updated: 2026-05-07 22:31

---

## Goal
Implement core financial reporting services per SD §21.2:
- `reporting.trialBalance({ asOf, locationId?, tenantId })`
- `reporting.balanceSheet({ asOf, locationId?, tenantId })`
- `reporting.profitLoss({ from, to, locationId?, tenantId })`

All return structured JSON data. Renderers (PDF/Excel) are separate (future task).

## Plan
1. [x] Create `packages/services/src/reporting/trial-balance.ts`
2. [x] Create `packages/services/src/reporting/balance-sheet.ts`
3. [x] Create `packages/services/src/reporting/profit-loss.ts`
4. [x] Update barrel export
5. [x] Write tests
6. [x] Typecheck + run tests

## Spec Reference
- SYSTEM-DESIGN.md §21.2 (Reporting)
- Pattern: aggregate posted journal_lines by account type

## Next step
All done.
