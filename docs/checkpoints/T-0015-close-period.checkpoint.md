# T-0015 — Service `accounting.closePeriod` + closing entry generator

## Status: 🟩 DONE
## Owner: Antigravity (Opus 4.6)
## Started: 2026-05-07
## Last Updated: 2026-05-07

## Scope
Implement period closing per SD §20.4, §21.1.

### Deliverables
1. `ClosePeriodInput` Zod schema
2. `closePeriod(input, ctx)` — transitions open→closing→closed
3. `getPeriodStatus(input, ctx)` — query period status (for MCP)
4. Business rules:
   - Period must exist
   - open → closing (first call): no new postings allowed
   - closing → closed (second call): finalize
   - Cannot close already closed period
   - Check for draft JEs in the period → warn/reject
   - Permission: accounting.period.close
5. Closing entry generation for fiscal year-end (revenue/expense → retained earnings)
6. Audit log
7. Unit tests

## Plan
1. [x] Add schemas to `schemas.ts`
2. [x] Create `accounting/close-period.ts`
3. [x] Update `accounting/index.ts`
4. [x] Create tests
5. [x] Typecheck + test — 98 tests pass (19 new), typecheck clean
6. [x] Update TASK.md + checkpoint

## Files
- `packages/services/src/accounting/schemas.ts` [MODIFY]
- `packages/services/src/accounting/close-period.ts` [NEW]
- `packages/services/src/accounting/index.ts` [MODIFY]
- `packages/services/tests/accounting-close-period.test.ts` [NEW]
