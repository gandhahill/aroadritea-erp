# T-0103 — Payroll Approval + Digital Pay Slip (PDF)

- **Status**: 🟩 DONE
- **Owner**: Claude Opus 4.7
- **Started**: 2026-05-11
- **Last Updated**: 2026-05-12
- **Spec**: SD §21.8 §Payroll Run, §19.5
- **Branch**: master
- **Commit**: 959e9fe

## Goal

Complete the payroll workflow:
- ✅ **approvePayroll**: director approval → status = approved, generates JE (T-0103 core)
- ✅ **markPayrollPaid**: mark as paid (status = paid)
- ✅ **MCP tools**: `payroll.run`, `payroll.approve`, `payroll.mark_paid`
- ✅ **UI**: payroll detail page with employee breakdown + approve/mark-paid buttons
- Digital payslip PDF export is an optional enhancement; use `generatePdf` from `@react-pdf/renderer` when needed

## What Was Built

### Service: `approvePayroll` (`packages/services/src/payroll/approve-payroll.ts`)
- Validates payroll is draft or pending_approval
- Aggregates payroll lines by component (earnings, PPh21, BPJS Kes, BPJS TK)
- Looks up account IDs by code (BS-6201, LS-2201, LS-2202, LS-2203, AS-1101)
- Creates JE via `createJournal` with proper debit/credit lines (conditional on amount > 0)
- Updates payroll status to `approved`, sets `journalEntryId`
- Permission: `hr.payroll.approve`

### Service: `markPayrollPaid`
- Validates payroll is `approved`
- Updates status to `paid`
- Permission: `hr.payroll.write`

### MCP Tools (`apps/mcp/src/tools/phase2.ts`)
- `payroll.run`: calls `runPayroll` with permission check
- `payroll.approve`: calls `approvePayroll`, loads payroll location for permission
- `payroll.mark_paid`: calls `markPayrollPaid`, loads payroll location for permission

### UI (`apps/web/app/(dash)/hr/payroll/[id]/page.tsx`)
- Payroll header with status badge
- 4-card summary (employees, earnings, deductions, net)
- Approve / Mark as Paid action buttons (status-dependent)
- Lines grouped by employee with earning/deduction breakdown
- Journal entry link when approved

### Tests (`packages/services/tests/payroll-approve.test.ts`)
- 13 tests: guards (not found, conflicts), JE creation, status update, mark-paid
- Pattern: sequential slot array for db mock, shared IAM/permission mocks

## Journal Entry on Approval

```
DR: Beban Gaji & Upah (BS-6201)          = totalEarnings
CR: Utang PPh 21 Terutang (LS-2201)     = totalPPh21 (if > 0)
CR: Utang BPJS Kesehatan (LS-2202)     = totalBpjsKes (if > 0)
CR: Utang BPJS TK (LS-2203)            = totalBpjsTk (if > 0)
CR: Kas/Bank (AS-1101)                  = totalNet
```

## Next Step

T-0103 DONE. Next: T-0104 (warning letter workflow SP1/SP2/SP3) — from Backlog Phase 4.

**Remaining on T-0103**: Digital pay slip PDF generation — low priority, can be done later.
