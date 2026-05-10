# T-0067 — Schema petty_cash_accounts + petty_cash_transactions

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

Add two tables to `packages/db/schema/accounting.ts` per **SYSTEM-DESIGN §25.7**:

1. `petty_cash_accounts` — one per location, tracks balance + plafond limit
2. `petty_cash_transactions` — topup/expense log per account

These are prerequisites for T-0068 (service) and T-0069 (UI).

---

## Definition of Done

- [x] Tables added to `packages/db/schema/accounting.ts`
- [x] Relations defined
- [x] Barrel exports updated in `packages/db/index.ts`
- [x] Client schema import updated in `packages/db/client.ts`
- [x] `pnpm typecheck` passes (only pre-existing argon2 error in seed)
- [x] TASK.md updated to DONE

---

## Plan

1. Add `pettyCashAccounts` table with pk, tenantCol, locationId (unique per tenant), balance (bigint), maxLimit (bigint), lastReplenishAt, auditCols
2. Add `pettyCashTransactions` table with pk, accountId FK, kind (topup/expense), amount (bigint positive), description, referenceType/referenceId, auditCols
3. Add relations (account → transactions, account → location)
4. Update barrel exports
5. Update client.ts schema import
6. Run typecheck

---

## Done so far

- Added `pettyCashAccounts` table (pk, tenantCol, locationId unique per tenant, balance bigint, maxLimit bigint, lastReplenishAt, auditCols)
- Added `pettyCashTransactions` table (pk, accountId FK, kind with CHECK topup/expense, amount bigint with CHECK >0, description, referenceType/referenceId, auditCols)
- Added `pettyCashAccountsRelations` (one → many transactions)
- Added `pettyCashTransactionsRelations` (many → one account, createdBy → user)
- Updated barrel exports in `packages/db/index.ts`
- client.ts auto-includes via `* as accountingSchema`

## Files Touched

| File | Action |
|------|--------|
| `packages/db/schema/accounting.ts` | Modified — added 2 tables + 2 relations |
| `packages/db/index.ts` | Modified — added barrel exports |
| `TASK.md` | Modified — moved to Done |

---

## Next step

Task complete. Next: T-0068 (Service petty cash) or T-0070 (Schema reimbursement).
