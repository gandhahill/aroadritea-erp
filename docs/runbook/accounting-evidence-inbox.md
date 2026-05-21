# Accounting Transaction Evidence Inbox Runbook

**Last reviewed:** 2026-05-22
**Owner:** Finance, Director, Outlet Admin

This runbook replaces scattered WhatsApp-only transaction proof with a trackable ERP register.

## Purpose

Directors or outlet teams sometimes send proof of transfer, receipt photos, or explanations to the accountant through WhatsApp. The ERP must show which evidence has been received, which is being processed, and which has already been journaled.

## Data entry

1. Open `Accounting > Bukti Transaksi`.
2. Click the correspondence/evidence registration action.
3. Use classification `Finance`.
4. Use direction:
   - `Incoming` for evidence received from outside finance.
   - `Internal` for director/outlet notes sent to accounting.
5. Fill the subject with a short transaction description.
6. Fill summary with the operational context, amount, date, and expected accounting treatment if known.
7. Attach the proof file if available.
8. Set status to `Registered`.

## Processing status

- `Registered`: evidence received, journal not yet input.
- `In Progress`: finance is checking or preparing the journal.
- `Closed`: journal has been created or no journal is needed and the reason is recorded.
- `Deleted`: soft-deleted only for wrong duplicate records; audit trail remains.

## Journal handoff

1. Finance opens the evidence detail.
2. Create or open the related journal in `Accounting > Jurnal`.
3. Attach the same proof to the journal if it is accounting evidence.
4. Update evidence status to `Closed`.
5. Keep the evidence subject and journal description aligned enough for audit search.

## Controls

- Evidence must not remain only in private chat when it affects accounting.
- Uploaded proof must not contain unrelated personal data.
- Journal posting remains governed by period close and debit/credit balance checks.
- This register does not replace original supplier/customer documents when legal originals are required.

