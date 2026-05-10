# T-0069 — UI petty cash (balance view + history)

| Field | Value |
|-------|-------|
| **Owner** | Claude Opus 4.6 |
| **Started** | 2026-05-10 |
| **Last updated** | 2026-05-10 |
| **Status** | 🟩 DONE |
| **Phase** | 2 |
| **Branch** | master |

---

## Done

### Server Actions (`actions.ts`)
- `fetchPettyCashAccounts(tenantId)` — joins petty_cash_accounts with locations, extracts locale name, returns balance/limit/lowBalance flag
- `fetchPettyCashTransactions(accountId, limit)` — paginated desc by createdAt

### Client Component (`petty-cash-view.tsx`)
- Balance cards per location with progress bar (balance / plafond %)
- Low balance badge ("Saldo Rendah") when < 20% of limit
- Last replenishment date display
- Transaction history table with filter pills: Semua / Isi Ulang / Pengeluaran
- Kind badges (green for topup, clay for expense)
- Amount with +/- prefix and color coding
- Empty states for no accounts and no transactions

### Server Page (`page.tsx`)
- Async server component, session check, fetches all accounts + transactions per account
- Passes data to PettyCashView as props

### Navigation
- Added "Petty Cash" to sidebar under Accounting children

### i18n
- Added `accounting.pettyCash` keys to id.json, en.json, zh.json (15 strings each)

## Files Touched

| File | Action |
|------|--------|
| `apps/web/app/(dash)/accounting/petty-cash/page.tsx` | Added |
| `apps/web/app/(dash)/accounting/petty-cash/actions.ts` | Added |
| `apps/web/app/(dash)/accounting/petty-cash/petty-cash-view.tsx` | Added |
| `apps/web/app/(dash)/sidebar.tsx` | Modified — added Petty Cash nav item |
| `apps/web/messages/id.json` | Modified — added pettyCash i18n keys |
| `apps/web/messages/en.json` | Modified — added pettyCash i18n keys |
| `apps/web/messages/zh.json` | Modified — added pettyCash i18n keys |

## Next step

Task complete. Replenish form (SD §25.7.3 second half) can be added as a follow-up task.
