# T-0204: Accounting Settings UI (Global AP Mapping)

## 1. Task Definition
**Owner:** Antigravity  
**Goal:** Create an Accounting Settings UI in `/settings/accounting` to manage global account mappings (like `accounting.payables.accountIds` in `cms_settings`).

## 2. Implementation Log
- Created `/settings/accounting` page, client form, and server actions.
- Allows user to pick an AP Account from the active, postable CoA list.
- Added i18n keys for id, en, zh.
- Added the menu to the sidebar under Settings (between Custom Fields and Bank Accounts).
- Verified with `pnpm -w typecheck`.

## 3. Status
🟩 DONE

## Next step
(End of task)
