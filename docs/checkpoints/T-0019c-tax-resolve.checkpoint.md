# T-0019c — Service `tax.resolve(context)` + `tax.calculate()` + Tests

## Status: 🟨 IN_PROGRESS
## Owner: Antigravity (Opus 4.6)
## Started: 2026-05-07
## Last Updated: 2026-05-07 21:57

---

## Goal
Implement the tax resolution engine per SD §19.3.3 and inclusive/exclusive tax calculation per §19.2.

## Plan
1. [x] Create `packages/services/src/tax/resolve.ts` — `tax.resolve(context)`
2. [x] Create `packages/services/src/tax/calculate.ts` — `tax.calculate()`
3. [x] Update barrel export `packages/services/src/tax/index.ts`
4. [x] Write tests `packages/services/tests/tax-resolve.test.ts`
5. [x] Write tests `packages/services/tests/tax-calculate.test.ts`
6. [x] Typecheck + run tests

## Spec Reference
- SYSTEM-DESIGN.md §19.2 (PB1 inclusive math)
- SYSTEM-DESIGN.md §19.3.3 (resolve algorithm)

## Next step
All done. Mark both tasks DONE.
