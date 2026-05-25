# Checkpoint: T-0180 — Purchase Returns module

- **Owner**: Claude Opus 4.7
- **Started**: 2026-05-25 19:00 WIB
- **Last updated**: 2026-05-25 19:25 WIB
- **Status**: 🟩 DONE
- **Phase**: Purchasing — missing-module gap

## Why

User flagged: "cek apakah sudah ada mekanisme retur pembelian, kalo
blm ada, tambahkan". Audit confirmed: no `purchase_returns` schema,
no service, no UI. Built minimum viable module.

## Done

- **Schema** (`packages/db/schema/purchasing.ts` +
  `migrations/0033_purchase_returns.sql`):
  - `purchase_returns` — id, tenant_id, location_id, number
    (PR-YYYY-MM-####), supplier_id, **grn_id** (required — return is
    always tied to a confirmed GRN), return_date, reason, status
    enum (`draft|submitted|approved|posted|cancelled`), totals,
    submit/approve/post/cancel audit cols, journal_entry_id,
    version + standard audit cols.
  - `purchase_return_lines` — id, return_id, line_no, **grn_line_id**
    (for qty validation), product_id, variant_id, qty_returned,
    uom, unit_cost, line_subtotal/tax/total, tax_code, notes.
- **Permissions** (`packages/db/seed/iam.ts`):
  - `purchasing.return.create` (draft + submit)
  - `purchasing.return.approve`
  - `purchasing.return.post`
  - Granted to `management` role explicitly; `director` +
    `vice_director` get everything automatically.
- **Service** (`packages/services/src/purchasing/return-service.ts`):
  - `createPurchaseReturn` — validates GRN belongs to tenant + is
    `confirmed`; validates qty ≤ received per grn_line; generates
    `PR-YYYY-MM-####` number with month-scoped counter; computes
    bigint totals (3-decimal qty × bigint unitCost / 1000).
  - `submitPurchaseReturn` / `approvePurchaseReturn` /
    `cancelPurchaseReturn` — status transitions guarded by
    optimistic locking (`version`). Cancel allowed from any
    non-terminal status.
  - `postPurchaseReturn` — period guard (account period must be
    `open`); claims the row; resolves GRNI account + per-product
    inventory account; calls `createJournal` (DR GRNI / CR
    Inventory); writes `stock_movements` (reason='purchase_return');
    decrements `stock_levels` variant-aware. Rolls status back on
    JE failure so no orphan posted row.
  - `listPurchaseReturns` (filter by location/status, cap 500) +
    `getPurchaseReturn` (with lines).
- **Audit entity type** `purchase_return` registered in
  `KNOWN_ENTITY_TYPES`.
- **UI** (`apps/web/app/(dash)/purchasing/returns/`):
  - `page.tsx` — list with status pills filter + per-row link.
  - `new/page.tsx` + `new-return-client.tsx` — 3-step form: load
    GRN by ID → pick lines + qty → reason + save draft.
  - `[id]/page.tsx` + `return-actions-client.tsx` — detail view
    with status-dependent action buttons (submit / approve / post /
    cancel) wired to server actions.
- **Server actions**
  (`apps/web/app/(dash)/purchasing/returns/actions.ts`):
  - `fetchPurchaseReturnsAction`, `fetchPurchaseReturnAction`,
    `createPurchaseReturnAction`, `submitPurchaseReturnAction`,
    `approvePurchaseReturnAction`, `postPurchaseReturnAction`,
    `cancelPurchaseReturnAction`,
    `fetchGrnForReturnAction` (loads GRN header + lines + PO unit
    cost for the new-return form).
- **Sidebar nav**: new "Retur Pembelian / Purchase Returns / 采购退货"
  link under the purchasing group.
- **i18n parity** id/en/zh for whole `purchasing.returns.*` block +
  sidebar `purchaseReturns`.
- **Tests** (`tests/purchase-return-schemas.test.ts`): 8 cases for
  the Zod schemas (line shape, totals, date format, reason length,
  empty lines). Service integration tests deferred until DB seed
  picks up the new permissions in CI.

## Notes / decisions

- Posting reverses the **GRNI** account (matches what GRN.confirm
  posted on receipt) rather than directly debiting AP. The supplier
  invoice path (if any) settles the GRNI separately. This keeps the
  return aligned with the GRN convention used in the rest of the
  module.
- The "load GRN by typed ID" UX is intentional for the v1. Future:
  deep-link from the GRN detail page (`?grnId=...`) and a supplier-
  scoped dropdown.
- Tax handling currently flat-zero on the return; the engine is
  ready to flow through via `taxCode` in the line schema.
- Permission to `purchasing.return.post` is separate from
  `.create/.approve` so a 4-eyes flow can be enforced if needed.

## Verification

- `pnpm -r typecheck` PASS across 10 workspaces.
- `pnpm --filter @erp/services test`: 600/600 PASS (+8).

## Backlog (carry-over to T-0181+)

- T-0181 Employee attendance-history page (self-service).
- T-0182 Shift schedule override per specific date.
- T-0183 Member-data page for management.
- T-0184 Helpdesk/ticketing + AI integration.
- T-0185 Internal courier shipment tracking (BinderByte).
- Wire `?grnId=...` deep-link from GRN detail.
- MCP tool `create_purchase_return_draft`.
- XLSX export on the returns list.
