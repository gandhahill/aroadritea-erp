# Runbook — POS Demo Mode (training)

> ADR-0008. POS demo runs in IndexedDB only; it never touches the production database.

## What it is

A sandbox version of the POS at **`/pos/demo`**. New cashiers practice
orders, refunds, shift handover, label printing — all without sending
data to the server.

Distinct from real POS via:

- URL prefix `/pos/demo/*` (e.g. `/pos/demo/payment`).
- "DEMO" watermark on receipts and labels.
- Pickup numbers prefixed `DEMO-`.
- Storage uses IndexedDB `aroadri-demo` (separate from `aroadri-offline`).
- Shift bar reads/writes `sessionStorage:'aroadri:demo:shift'` (per browser tab).

## Onboarding a new cashier

1. **Director opens `/pos/demo`** on the cashier's laptop, signs in
   with the new cashier's account.
2. **Director clicks "Reset Demo Data"** (top-right corner) to start
   fresh — wipes `aroadri-demo` IndexedDB.
3. **Cashier practices** the standard 7-step playbook:
   1. Open shift with opening cash Rp 200.000.
   2. Look up a member (try phone `08123456789`).
   3. Add 2 tea variants + 1 dessert.
   4. Apply 50% sugar + topping.
   5. Pay split: 60% cash + 40% QRIS.
   6. Donate the change rounding.
   7. Close shift, compare expected vs actual cash.
4. **Director reviews** the receipt + cup labels (printed only as
   preview; actual paper print is optional — set `kioskPrintingEnabled
   = false` if you want to skip the printer).
5. **Cashier repeats** until comfortable. Goal: complete a full cycle
   in under 90 s.

## Common mistakes (cover these in training)

- Forgetting to ask the customer to confirm member name → real POS will
  block; demo silently records the mismatch.
- Reading wrong line from the receipt when refunding → in demo, refunds
  log to IndexedDB and show a refund stamp on the receipt preview.
- Closing the shift without entering actual-cash → demo enforces the
  same validation as real POS (translation `actualCashRequired`).

## Refund / void in demo

Both work the same as the real flow. The refund creates a new demo
order with negative lines; the void marks the original order as
`voided`. Neither touches the server.

## Resetting between trainees

The "Reset Demo Data" button drops `aroadri-demo` IndexedDB and clears
`sessionStorage` keys `aroadri:demo:shift` and `aroadri:demo:lastReceipt`.
Safe to run any time — no production impact.

## Why not just train on real POS in off-hours?

Real POS creates journal entries every sale. Training on real POS
would either pollute the GL or require the director to void every
practice transaction (which itself is auditable noise). Demo mode
keeps GL clean and reduces director-time-per-cashier.

## Troubleshooting

| Symptom                                  | Fix                                                       |
| ---------------------------------------- | --------------------------------------------------------- |
| Demo orders show in real POS history     | Check URL prefix — must include `/pos/demo`. If not, escalate. |
| "Open shift" button missing              | sessionStorage cleared; click "Reset Demo Data" then open shift again. |
| Receipt preview looks wrong              | Hard-refresh the print window. Demo reads cached IndexedDB record. |
| Demo label QR doesn't match order number | QR contents intentionally `DEMO-<orderNumber>` so scanners flag it. |
