# T-0013 — Service `accounting.postJournal` (balance check, period check, audit)

## Status: 🟨 IN_PROGRESS
## Owner: Antigravity (Opus 4.6)
## Started: 2026-05-07
## Last Updated: 2026-05-07

## Scope
Implement `accounting.postJournal` service function per SD §20, §21.1.

### Deliverables
1. `PostJournalInput` Zod schema (journal ID)
2. `postJournal(input, ctx)` service function returning `Result<JournalEntryResult>`
3. Business rule validations:
   - JE must exist and be in 'draft' status
   - Re-validate balance (defense in depth)
   - Period must be 'open' (not 'closing' or 'closed')
   - Set status='posted', postedAt, postedBy
4. Audit log integration (action='post', before/after snapshots)
5. Optimistic locking via version column
6. Unit tests
7. Export from `@erp/services/accounting`

### Dependencies
- `accounting.createJournal` (T-0012) — ✅ done
- `@erp/db` schema — ✅ done
- `@erp/shared` (Result, AppError) — ✅ done
- `@erp/services/iam` (requirePermission) — ✅ done

## Plan
1. [ ] Create `accounting/post-journal.ts` — service function
2. [ ] Add `PostJournalInput` to `accounting/schemas.ts`
3. [ ] Update `accounting/index.ts` — exports
4. [ ] Create tests
5. [ ] Typecheck + test
6. [ ] Update TASK.md

## Files
- `packages/services/src/accounting/post-journal.ts` [NEW]
- `packages/services/src/accounting/schemas.ts` [MODIFY]
- `packages/services/src/accounting/index.ts` [MODIFY]
- `packages/services/tests/accounting-post-journal.test.ts` [NEW]

## Next step
Create post-journal.ts, update schemas.ts, write tests.
