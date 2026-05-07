# T-0014 — Service `accounting.reverseJournal`

## Status: 🟩 DONE
## Owner: Antigravity (Opus 4.6)
## Started: 2026-05-07
## Last Updated: 2026-05-07

## Scope
Implement `accounting.reverseJournal` service function per SD §20.6, §21.1.

### Deliverables
1. `reverseJournal(input, ctx)` service returning `Result<JournalEntryResult>`
2. Business rules:
   - Original JE must exist and be 'posted'
   - Cannot reverse an already reversed JE
   - Reversal posting date must be in an open period
   - Create new JE with reversed amounts (debit↔credit)
   - Original JE status → 'reversed', set `reversed_by_je_id`
   - New reversal JE status → 'posted' immediately
3. Audit log for both original (status change) and new reversal
4. Unit tests
5. Export from `@erp/services/accounting`

### Dependencies
- `accounting.createJournal` (T-0012) — ✅ done
- `accounting.postJournal` (T-0013) — ✅ done
- Schema `ReverseJournalInputSchema` — ✅ already added in T-0013

## Plan
1. [x] Create `accounting/reverse-journal.ts`
2. [x] Update `accounting/index.ts` — exports
3. [x] Create tests
4. [x] Typecheck + test — 79 tests pass (18 new), typecheck clean
5. [x] Update TASK.md + checkpoint

## Files
- `packages/services/src/accounting/reverse-journal.ts` [NEW]
- `packages/services/src/accounting/index.ts` [MODIFY]
- `packages/services/tests/accounting-reverse-journal.test.ts` [NEW]
