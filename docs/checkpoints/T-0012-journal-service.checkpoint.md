# T-0012 — Service `accounting.createJournal` + Zod input + Result type

## Status: 🟩 DONE
## Owner: Antigravity (Opus 4.6)
## Started: 2026-05-07
## Last Updated: 2026-05-07

## Scope
Implement `accounting.createJournal` service function per SYSTEM-DESIGN §20, §21.1, §10.4, §16.5.

### Deliverables
1. `CreateJournalInput` Zod schema (validated at service layer per SD §10.4)
2. `createJournal(input, ctx)` service function returning `Result<JournalEntry>`
3. Auto-generation of JE number (`JE-YYYY-MM-NNNN`)
4. Business rule validations:
   - Period must be open
   - Accounts must be postable & active
   - Lines must balance (total_debit === total_credit)
   - At least 2 lines
   - Each line either debit > 0 XOR credit > 0
   - Total debit > 0 (no zero-amount JE)
5. Audit log integration
6. Unit tests for all validation paths
7. Export from `@erp/services/accounting`

### Dependencies
- `@erp/db` schema (accounting.ts, audit.ts) — ✅ done (T-0008, T-0016)
- `@erp/shared` (Result, AppError, Money, generateId) — ✅ done (T-0004, T-0010)
- `@erp/services/iam` (requirePermission) — ✅ done (T-0007)
- `zod` — ✅ installed

## Plan
1. [x] Install zod dependency
2. [x] Create `accounting/schemas.ts` — Zod schemas for CreateJournalInput
3. [x] Create `accounting/create-journal.ts` — service function
4. [x] Create `accounting/number-generator.ts` — JE number sequence
5. [x] Update `accounting/index.ts` — barrel exports
6. [x] Create tests `tests/accounting-create-journal.test.ts`
7. [x] Typecheck + test — 44 tests pass (27 new), typecheck clean
8. [x] Update TASK.md

## Files
- `packages/services/src/accounting/schemas.ts` [NEW]
- `packages/services/src/accounting/create-journal.ts` [NEW]
- `packages/services/src/accounting/number-generator.ts` [NEW]
- `packages/services/src/accounting/index.ts` [MODIFY]
- `packages/services/tests/accounting-create-journal.test.ts` [NEW]

## Next step
T-0012 complete. Next backlog candidates in Phase 1:
- **T-0013**: `accounting.postJournal` (balance check, period check, audit) — natural successor
- **T-0014**: `accounting.reverseJournal`
- **T-0019**: `tax.listRates` + seed tarif
