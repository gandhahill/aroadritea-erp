# T-0100 — HR & Payroll Schema (employees + contracts + attendance + leaves)

- **Status**: 🟨 IN_PROGRESS
- **Owner**: Claude Opus 4.6
- **Started**: 2026-05-11
- **Last Updated**: 2026-05-11
- **Spec**: SD §9.6, §21.8
- **Branch**: master

## Goal

Build Phase 4 HR & Payroll schema foundation: 11 tables for employees, contracts, shift definitions, attendance, leave management, salary components, payroll runs, and disciplinary actions.

## Plan

1. [x] `packages/db/schema/hr.ts` — 11 tables (see below)
2. [x] Update `packages/db/index.ts` — barrel exports
3. [ ] Typecheck + push (in progress)
4. [ ] Seed `shift_definitions` (pagi 09:30–17:30, siang 14:30–22:30)
5. [ ] Seed default `leave_types` (annual 12d, sick, unpaid, marriage, maternity, bereavement)
6. [ ] Seed default `salary_components` (SALARY_BASE, TUNJANGAN_THR, BPJS_KES, BPJS_TK, PPh21, POTONGAN_TELAT)

## Tables Created

| Table | Description | Key Fields |
|-------|-------------|-----------|
| `employees` | Employee master data | status, position, department, NIK/NPWP/BPJS (encrypted), hireDate, contractType |
| `employment_contracts` | Contract history per employee | contractType (pkwt/pkwtt), period, baseSalary, isActive |
| `shift_definitions` | Shift schedules | name, code, startTime, endTime, breakStart, breakEnd |
| `attendance` | Check-in/out records | checkIn/OutAt, method (gps/qr), GPS data, isLate, lateMinutes |
| `leave_types` | Master leave types | code, annualQuotaDays, isPaid, requiresApproval |
| `leave_balances` | Per-employee annual balance | totalDays, usedDays, pendingDays per year |
| `leave_requests` | Leave application + approval | status (pending/approved/rejected), approvedBy, start/endDate |
| `salary_components` | Master salary components | code, kind (earning/deduction), fixedAmount/percentage, isTaxable, isBpjsBase |
| `payrolls` | Payroll run header per period | periodCode, status, totals, journalEntryId |
| `payroll_lines` | Per-employee per component | payrollId, employeeId, salaryComponentId, amount |
| `disciplinary_actions` | SP1/SP2/SP3 | level, reason, attachmentUrl, status, acknowledgedBy |

## Indexes Created

- `employees_tenant_nik_idx` — UNIQUE(tenant_id, nik)
- `employees_tenant_status_idx`
- `employees_tenant_location_idx`
- `employment_contracts_employee_idx`
- `employment_contracts_active_idx`
- `employment_contracts_tenant_code_idx` — UNIQUE(tenant_id, code)
- `shift_definitions_tenant_code_idx` — UNIQUE(tenant_id, code)
- `attendance_employee_date_idx`
- `attendance_tenant_date_idx`
- `leave_types_tenant_code_idx` — UNIQUE(tenant_id, code)
- `leave_balances_employee_type_year_idx` — UNIQUE(employee_id, leave_type_id, year)
- `leave_requests_employee_idx`
- `leave_requests_status_idx`
- `salary_components_tenant_code_idx` — UNIQUE(tenant_id, code)
- `payrolls_tenant_period_location_idx` — UNIQUE(tenant_id, period_code, location_id)
- `payrolls_status_idx`
- `payroll_lines_payroll_idx`
- `payroll_lines_employee_idx`
- `disciplinary_employee_idx`
- `disciplinary_level_idx`

## Key Design Decisions

- Employee PII fields (nik, npwp, bpjsKesehatan, bpjsTenagakerja, phone, address) are stored as plain text but MUST be encrypted at rest per UU PDP (see SD §19.3 masking)
- `attendance.check_in_gps` stored as JSONB: `{ lat, lng, accuracy_m, source }`
- `leave_balances` is per-year for clear annual reset logic
- `salary_components.fixedAmount` is bigint (IDR), `percentage` is numeric for TER-based calculations
- `payrolls.journalEntryId` links to `journal_entries` for auto-JE on approval (done in T-0103)

## Files Touched

| Path | Action |
|------|--------|
| `packages/db/schema/hr.ts` | new — 11 tables |
| `packages/db/index.ts` | update — exports |

## Commits So Far

| SHA | Message | Date |
|-----|---------|------|
| _(pending)_ | | |

## Next step

1. Run `pnpm --filter @erp/db exec tsc --noEmit` to verify no new errors
2. Commit + push
3. Create seed files: `packages/db/seed/shift-definitions.ts` and `packages/db/seed/leave-types.ts`
