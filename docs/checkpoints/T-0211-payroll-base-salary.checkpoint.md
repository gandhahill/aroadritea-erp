# T-0211: Payroll: field gaji pokok + pembuatan `employmentContracts`

## Status
🟩 DONE

## Owner
Antigravity

## Started
2026-05-29 09:54 WIB

## Plan
1. Check `packages/db/schema/hr.ts` to see how `employmentContracts` and `baseSalary` are structured.
2. Update `packages/services/src/hr/create-employee.ts` and `update-employee.ts` (if exists) to insert/update `employmentContracts` with `baseSalary` when creating/updating an employee.
3. Update `packages/services/src/payroll/run-payroll.ts` to use `baseSalary` from `employmentContracts`, and add validation to reject run payroll if `baseSalary` = 0.
4. Update UI forms in `apps/web/app/(dash)/hr/employees/new` and `apps/web/app/(dash)/hr/employees/[id]/edit` to include `baseSalary` input.
5. Add i18n keys for the new inputs.
6. Make sure to emit audit trail for the contract creation/update.

## Next step
- Done.
