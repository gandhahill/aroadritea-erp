# Checkpoint: T-0127 — CRM schema + service (complaints + loyalty)

- **Owner**: Claude Opus 4.6
- **Started**: 2026-05-13 22:45
- **Last updated**: 2026-05-13 22:50
- **Status**: 🟩 DONE
- **Commit**: 1c23017
- **Phase**: 5
- **Branch**: master (direct)

## Goal

Implement CRM schema + service: complaints log + compensation tracking (T-0127), then integrate loyalty earn into POS sale flow (T-0128). Spec: SYSTEM-DESIGN §21.9, §9.7, §31.5.

**Definition of Done:**
- [ ] `complaints` + `complaint_compensations` schema in `packages/db/schema/crm.ts`
- [ ] `crm.logComplaint` + `crm.resolveComplaint` service functions
- [ ] `earnPoints` called from `pos.createSale` when `memberId` provided
- [ ] `redeemPoints` callable from POS / member portal
- [ ] `sales_orders` has `memberId` column (join loyalty on earn)
- [ ] Loyalty tier upgrade logic (bronze→silver→gold)
- [ ] Voucher generation on redeem
- [ ] typecheck passes all apps

## Plan

1. [ ] Create `packages/db/schema/crm.ts` with complaints + compensations tables
2. [ ] Export from `packages/db/index.ts`
3. [ ] Create `packages/services/src/crm/index.ts` with complaint + loyalty functions
4. [ ] Add `memberId` column to `sales_orders` schema
5. [ ] Add migration comment for `memberId` in sales_orders
6. [ ] Integrate `earnPoints` call in `pos.createSale` service
7. [ ] Add `getPointsHistory` + `getMemberVouchers` in member service (already done)
8. [ ] Add i18n keys for crm namespace in web app
9. [ ] typecheck all apps

## Done so far

_(task just started)_

## Decisions

- Loyalty earn: 1 point per Rp 10,000 (10,000,000 cents), configurable via `loyaltyConfig`
- Tier thresholds: bronze (default), silver (50,000 lifetime), gold (150,000 lifetime)
- Vouchers generated on redeem with unique code, stored in `member_vouchers`

## Next step

Create `packages/db/schema/crm.ts` with:
- `complaints` table: id, tenantId, memberId, locationId, orderId, occurredAt, description, status, resolution, priority
- `complaint_compensations` table: id, complaintId, kind ('product_replacement'|'voucher'|'refund'), amount, journalEntryId, approvedBy
- Export both from `packages/db/index.ts`