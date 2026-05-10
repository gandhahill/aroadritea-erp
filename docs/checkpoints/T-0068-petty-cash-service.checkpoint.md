# T-0068 — Service petty cash (balance, transactions, replenish)

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

Implement petty cash service per **SYSTEM-DESIGN §25.7.2**:

1. `getPettyCashBalance(locationId, ctx)` — get balance for a location
2. `listPettyCashTransactions(accountId, pagination, ctx)` — paginated tx list
3. `recordExpense(input, ctx)` — deduct balance, create tx, audit log
4. `requestReplenish(input, ctx)` — add balance (topup), create tx, audit log

Warning threshold: `balance < maxLimit * 0.2` → flag in response.

---

## Plan

1. Add Zod schemas for petty cash inputs
2. Create `petty-cash.ts` with 4 service functions
3. Update barrel exports
4. Add petty cash permissions to IAM seed
5. Typecheck

---

## Done

- Added 4 Zod schemas: `RecordPettyCashExpenseSchema`, `ReplenishPettyCashSchema`, `ListPettyCashTransactionsSchema`, `CreatePettyCashAccountSchema`
- Created `petty-cash.ts` with 5 functions: `getPettyCashBalance`, `listPettyCashTransactions`, `recordPettyCashExpense`, `replenishPettyCash`, `createPettyCashAccount`
- All functions follow Result pattern, permission checks, audit logging
- Business rules: insufficient balance check, max limit check, low balance warning (< 20%)
- Added 4 IAM permissions: `accounting.petty_cash.{view,expense,replenish,manage}`
- Role assignments: director/vice_director (all), accountant (all), management (view+expense+replenish), store_manager (view+expense)
- Updated barrel exports
- Typecheck clean

## Files Touched

| File | Action |
|------|--------|
| `packages/services/src/accounting/petty-cash.ts` | Added |
| `packages/services/src/accounting/schemas.ts` | Modified — 4 schemas |
| `packages/services/src/accounting/index.ts` | Modified — barrel exports |
| `packages/db/seed/iam.ts` | Modified — 4 permissions + role mappings |

## Next step

Task complete. Next: T-0069 (UI petty cash) or T-0070 (Schema reimbursement).
