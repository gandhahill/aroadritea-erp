# Runbook — POS offline-mode recovery

> RPO target: **0 for POS**. ADR-0009.

The POS is a PWA: every sale is written to IndexedDB before the
server roundtrip completes, so a network failure never loses data.
This runbook covers the recovery procedure when the cashier
intentionally or accidentally ran the POS offline for an extended
period.

## What the offline queue stores

- IndexedDB store `aroadri-offline.pendingOrders` —
  `{ clientOrderUuid, createdAtClient, payload }` per unsynced sale.
- Same `idempotencyKey` is used on the server, so replaying does NOT
  create duplicates (DB unique index on
  `sales_orders.idempotencyKey` per location).

## Step 1 — Verify the queue exists

Open browser devtools → Application → IndexedDB →
`aroadri-offline` → `pendingOrders`. There should be one row per
unsynced order.

If the store is empty but the cashier insists orders happened: the
PWA may have been cleared. Check the receipt thermal roll for the
last printed `T01-…` order number to reconcile against
`sales_orders.number` in the DB.

## Step 2 — Restore connectivity

Confirm:

```bash
curl -I https://erp.aroadritea.com/api/healthz
```

If 200, network is back.

## Step 3 — Sync from the cashier device

1. On the cashier device, refresh `/pos`.
2. The "Offline" banner becomes "Sync now".
3. Click "Sync now" → each queued order is POSTed to
   `createSaleAction`.
4. Server responses populate:
   - **`order.id`** (UUID) → mapped back to the queued item.
   - **`order.number`** (`T01-2026-05-NNNN`) → updates the receipt
     reprint window.
5. Once all rows finish, the queue is empty and the banner clears.

## Step 4 — Handle conflicts

If the server returns a permanent error (codes
`VALIDATION_FAILED`, `BUSINESS_RULE`, `FORBIDDEN`), the offline
runtime calls `removePendingOrder` so the queue advances. The error
toast surfaces the failed UUID for manual review:

- Find the failed row in IndexedDB → copy the payload → paste into
  `/pos/orders/manual-replay` (admin-only, opens the order in a
  draft form for manual correction).

Transient errors (network, 5xx) leave the row in the queue and retry
on next sync.

## Step 5 — Reconcile period totals

After a long offline window:

1. Check `daily_summaries` for the affected dates — re-run via
   `worker` job `regenerateDailySummary(date, locationId)` so the
   late inserts get aggregated.
2. Compare bank deposits to total cash receipts — if the cashier
   already deposited based on pre-sync totals, the variance posts
   to the cash-handling variance account (see
   `inventory/adjustment-service.ts` for the pattern).

## Step 6 — When to NOT auto-sync

Some scenarios require manual review BEFORE syncing:

- Cashier's password was rotated mid-offline → server may reject the
  cashier auth. Resolve by signing in fresh and only then clicking
  "Sync now".
- Outlet was transferred mid-day → confirm `locationId` in the
  queued payloads matches the cashier's current location. Mismatch
  fails with `FORBIDDEN`.
- Tenant database was restored from backup that pre-dates the
  offline window → sync may post sales with order numbers outside
  the current numbering sequence. Coordinate with the accountant
  before clicking "Sync now"; we may need to reset the number
  generator (`packages/services/src/pos/number-generator.ts`).

## Drill

Quarterly: cashier sets airplane mode for 15 min, takes 5 orders,
re-enables network, clicks "Sync now". All 5 must appear in
`/pos/orders` with the original timestamps. Log the drill outcome
in `TASK.md`.
