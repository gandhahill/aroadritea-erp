# Checkpoint: T-0271 - Financial close control center

- **Owner**: Codex
- **Started**: 2026-06-03 13:20 WIB
- **Last updated**: 2026-06-03 16:02 WIB
- **Status**: DONE

## Goal
Add a Financial Close Control Center so accounting can see whether a monthly period is ready to close across core ERP modules.

## Scope
- Update SoT/SD for the new close-center requirement.
- Add a read-only service that consolidates period readiness checks.
- Add `/accounting/close-center` UI with i18n in ID/EN/ZH and sidebar link.
- Reuse existing data: accounting period, journal entries, POS shifts/manual sales, bank reconciliation, stock opname/movements, AP/AR aging, tax documents, payroll.

## Notes
- First version is read-only, so no new state-changing audit trail is needed.
- Links should point to existing operational pages for remediation.
- Implemented `getFinancialCloseCenter` in the accounting service with readiness checks for period, journals, POS, bank reconciliation, inventory/opname/costing, AP/AR, tax, and payroll.
- Added `/accounting/close-center` with period/location filters, overall status, readiness cards, and checklist remediation links.
- Added sidebar entry and ID/EN/ZH i18n namespace.
- Verified:
  - `node -e` JSON parse for `apps/web/messages/{id,en,zh}.json`
  - `pnpm --filter @erp/services typecheck`
  - `pnpm --filter @erp/web typecheck`
  - `pnpm lint:permissions`
  - `pnpm --filter @erp/web build`

## Next step
Done.
