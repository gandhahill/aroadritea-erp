# T-0081a — Service pos.payment + donation/rounding flow

| Field | Value |
|-------|-------|
| **Owner** | Claude Opus 4.6 |
| **Started** | 2026-05-10 |
| **Last updated** | 2026-05-10 |
| **Status** | 🟩 DONE |
| **Phase** | 2 |
| **Branch** | master |

---

## Task

Service pos.payment + donation/rounding flow (SD §25.11).

## Specification

**Schema changes (payments table)**:
- `donationAmount` (bigint, nullable) — amount donated instead of given as change
- `roundingOption` (text, nullable) — 'donate' | 'round_up' | 'no_donation'

**Service (`pos/donation.ts`)**:
```ts
interface DonationChoice {
  type: 'donate' | 'round_up' | 'no_donation';
  amount: bigint; // calculated donation amount in sen
}

// calculateDonation(changeAmount: bigint): DonationChoice
// - change < 100 sen → donate rounding difference
// - change ≥ 100 sen → round up to nearest 100 sen, donate the difference
// - 'no_donation' → return exact change
```

**Service (`pos/payment.ts`)**:
- `processPayment(saleId, paymentInput, donationChoice, ctx)` — handles payment + donation
- `closePayment(saleId, ctx)` — finalizes

**Integration into create-sale**:
- After calculating change, call `calculateDonation(change)` to get donationChoice
- If donation.type !== 'no_donation':
  - Store `donationAmount` on the cash payment row
  - Store `roundingOption` on the cash payment row
  - Adjust cash received amount (subtract donation from cash received for JE)
  - Create separate journal entry for donation

**COA**:
- `2-2050 Donation Trust Payable` (liability/passiva)
- When donated: DR Donation Trust Payable, CR Cash

## Backlog Entry

From `TASK.md` Backlog Phase 2:
> T-0081a | Service pos.payment + donation/rounding flow | pos | SD §25.11 | M

## Pre-flight Checklist

- [x] Read relevant section of `SOURCE-OF-TRUTH.md`?
- [x] Read relevant section of `SYSTEM-DESIGN.md`? → SD §25.11
- [x] Checked `TASK.md` for Active Tasks? → T-0081a in Backlog
- [x] Created checkpoint before starting
- [x] Know which files to change:
  - `packages/db/schema/pos.ts` — add columns
  - `packages/db/index.ts` — re-export (already exports payments)
  - `packages/services/src/pos/donation.ts` — NEW
  - `packages/services/src/pos/payment-service.ts` — NEW
  - `packages/services/src/pos/create-sale.ts` — modify to integrate donation
  - `packages/services/src/pos/index.ts` — barrel exports
  - `packages/services/src/pos/schemas.ts` — add schema
  - `apps/web/app/(dash)/pos/payment-modal.tsx` — modify to show donation UI

## Completed

All steps done:
1. ✅ Added `donationAmount` + `roundingOption` columns to payments table
2. ✅ Created `donation.ts` with `calculateDonation` + `getDonationOptions`
3. ✅ Integrated donation into `create-sale.ts` (JE: DR Cash, CR Revenue + CR PB1 + CR Donation Trust)
4. ✅ Added Zod schemas (PaymentInput with donationAmount/roundingOption)
5. ✅ COA seed: `2-2050 Donasi Tabungan Amal` (Donation Trust Payable)
6. ✅ UI payment modal: donation choice buttons when cash change exists
7. ✅ i18n keys (id/en/zh)
8. ✅ Fixed round_up logic (round DOWN change to nearest denomination, donate remainder)
9. ✅ Fixed JE: donation is CR (liability), not DR
10. ✅ Typecheck clean, 350 tests pass