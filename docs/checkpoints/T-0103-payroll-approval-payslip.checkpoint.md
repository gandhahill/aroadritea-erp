# T-0103 — Payroll Approval + Digital Pay Slip (PDF)

- **Status**: 🟨 IN_PROGRESS
- **Owner**: Claude Opus 4.6
- **Started**: 2026-05-11
- **Last Updated**: 2026-05-11
- **Spec**: SD §21.8 §Payroll Run, §19.5
- **Branch**: master

## Goal

Complete the payroll workflow:
- **approvePayroll**: director approval → status = approved, generates JE (T-0103 core)
- **markPaid**: mark as paid (status = paid)
- **Digital pay slip**: generate HTML/PDF pay slip per employee

## Plan

1. [ ] Service `approvePayroll(payrollId)` — sets approved status, generates JE
2. [ ] Service `markPayrollPaid(payrollId)`
3. [ ] `getPayrollSlip(payrollId, employeeId)` — compute slip data
4. [ ] UI: Payroll detail page with approve/mark-paid buttons
5. [ ] PDF generation (use `@react-pdf/renderer` or simple HTML-to-buffer)

## Journal Entry on Approval

After director approves:
- DR: Gaji & Upah (BS-6201) = total gross
- CR: Utang BPJS Kesehatan (LS-2202) = total bpjs kes employer
- CR: Utang BPJS TK (LS-2203) = total bpjs tk employer
- CR: PPh 21 Terutang (LS-2201) = total pph21
- CR: Kas/Bank (AS-1101) = total net

## Files to Touch

| Path | Action |
|------|--------|
| `packages/services/src/payroll/approve-payroll.ts` | new |
| `packages/services/src/payroll/payroll-slip.ts` | new |
| `apps/web/app/(dash)/hr/payroll/[id]/page.tsx` | new |
| `packages/services/tests/payroll-approve.test.ts` | new |

## Next step

Implement `approvePayroll` service — load payroll, validate status=draft, create JE, update payroll.journalEntryId, set status=approved.