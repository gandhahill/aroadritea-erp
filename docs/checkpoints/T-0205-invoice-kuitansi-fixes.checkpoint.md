# Checkpoint: T-0205-invoice-kuitansi-fixes

## Status
🟩 DONE

## Summary
Executed the 9 best practice fixes for Invoice and Kuitansi workflows as determined in the gap analysis.

1. **Sequential Numbering**: `createInvoice` no longer accepts `number` from input. It uses `generateInvoiceNumber` (INV/YYYY/MM/NNNN) server-side to guarantee sequential order and avoid race conditions.
2. **Database Schema Update**: Added `partnerAddress`, `partnerNpwp`, `paymentTerms` to `invoices` table, and `taxAmount` to `invoiceLines`. Generated and ran migration `0036_clammy_firebrand.sql`.
3. **Tax Calculation**: Moved tax calculation logic to `createInvoice` server-side action using basis points (`taxRate` parameter, e.g., 1000 for 10% or 1100 for 11%).
4. **Amount in Words (Terbilang)**: Added `amountToWords` utility in `@erp/shared` to automatically convert Rupiah values into Indonesian words.
5. **Print View Overhaul**: Completely refactored `print-invoice-client.tsx`:
   - Extracted all hardcoded text to `i18n` dictionary (`accounting.print.*`).
   - Added company full info (Address, NPWP, Phone).
   - Display amount in words (`Terbilang`).
   - Added primary logo `logo-primary.png` for professional print look.
6. **Invoice Form Update**: Rebuilt `/invoices/new/client.tsx` to include fields for `partnerAddress`, `partnerNpwp`, and `paymentTerms`. Also added line-level dropdown to select tax rate (PB1/PPN/No Tax) and summary section.
7. **Invoice List**: Formatted `inv.total` properly as IDR currency instead of raw string.
8. **Removed duplicate 'use client'**: Cleaned up in `invoices/[id]/post/client.tsx`.
9. **Typecheck Passed**: `pnpm -F @erp/web typecheck` succeeds.

## Next step
- Monitor functionality of invoice printing during operations. 
- Wait for user's next request or proceed with the backlog in `TASK.md`.
