# Guide Coverage Review

**Date:** 2026-05-22
**Task:** T-0168
**Purpose:** compare ERP module tree with in-app docs and runbooks so new features are not hidden from operators.

## ERP module tree reviewed

The ERP dashboard currently exposes these top-level modules under `apps/web/app/(dash)`:

| Module | Representative routes | Guide coverage |
|---|---|---|
| Account | `/account` | Covered by login/account guidance |
| Accounting | `/accounting`, `/accounting/journals`, `/accounting/journals/import`, `/accounting/payables`, `/accounting/receivables`, `/accounting/assets`, `/accounting/petty-cash`, `/accounting/reimbursement` | Covered in in-app finance guide, runbook for evidence inbox, traceability docs |
| Audit | `/audit` | Covered by security/audit docs |
| CMS | `/cms`, `/cms/pages`, `/cms/posts`, `/cms/docs` | Covered by CMS/security docs and public site traceability |
| Correspondence | `/correspondence`, `/correspondence/[id]` | Covered by new accounting evidence inbox runbook |
| Dashboard | `/dashboard` | Covered as operational overview |
| Docs | `/docs` | Covered by this review |
| HR | `/hr`, `/hr/employees`, `/hr/attendance`, `/hr/payroll`, `/hr/recruitment`, `/hr/disciplinary` | Covered in in-app HR guide |
| Inventory | `/inventory/products`, `/inventory/categories`, `/inventory/opname`, `/inventory/adjust`, `/inventory/stock`, `/inventory/variance`, `/inventory/recipes`, `/inventory/supplies` | Covered in inventory guide and stock-opname notes |
| Notifications | `/notifications` | Covered in settings/support guidance and discount governance |
| POS | `/pos`, `/pos/demo`, `/pos/manual-sales`, `/pos/orders` | Covered in in-app POS guide plus discretionary discount and legacy parity runbooks |
| Purchasing | `/purchasing`, `/purchasing/po/new` | Covered including BinderByte cached manual sync |
| Reporting | `/reporting/*` | Covered in finance/reporting guidance |
| Settings | `/settings/*` | Covered for permissions, workflow, POS, printer, custom fields, integrations, notifications |
| Tax | `/tax/rates`, `/tax/rules` | Covered in finance/tax guide |

## New guide updates in this pass

- Added POS one-off manual discount steps to the in-app guide in ID/EN/ZH.
- Added POS operation shortcuts to the in-app guide in ID/EN/ZH.
- Added accounting transaction evidence workflow to the in-app guide in ID/EN/ZH.
- Added `docs/runbook/pos-discretionary-discounts.md`.
- Added `docs/runbook/accounting-evidence-inbox.md`.
- Added `docs/runbook/pos-legacy-parity.md`.
- Updated `/docs` index to include the new runbooks.

## Manual verification notes

These items require physical or business confirmation and should stay as `VERIFY` rather than `FULL` until confirmed:

- Direct printer auto-detection/dropdown depends on the Print Bridge/device environment and must be checked on the outlet machine.
- Cash drawer opening is hardware-specific and is intentionally outside browser-only POS.
- POS gift card sale flow should wait for finance approval of revenue/liability accounting.
- Production department/loss-reporting/prep-time screens may be added if operations wants dedicated flows beyond existing inventory adjustment, variance, KDS, and Naixer settings.
- Tax-exempt cashier toggles are intentionally not exposed; tax exceptions must use configured tax rules.

