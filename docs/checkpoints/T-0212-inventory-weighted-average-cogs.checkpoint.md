# T-0212: Inventory: valuasi weighted-average + jurnal HPP saat penjualan

## Status
🟩 DONE

## Owner
Antigravity

## Started
2026-05-29

## Goal
Calculate and store weighted-average `avgUnitCost` during GRN and transfer.
Post COGS journal (DR HPP / CR Persediaan) during sales using actual cost.
Ensure `varianceValue` in stock opname is populated.

## Progress
- Updated `packages/services/src/purchasing/grn-service.ts` to calculate `avgUnitCost` using weighted average formula during receiving.
- Updated `packages/services/src/inventory/transfer-service.ts` to transfer `avgUnitCost` during receive based on source location's cost.
- Updated `packages/services/src/pos/create-sale.ts`:
  - `deductIngredients` now joins with `products` table to return `avgUnitCost`, `cogsAccountId`, and `inventoryAccountId`.
  - Fallback to deduct product itself if no BOM is present.
  - Aggregates COGS amounts and posts them to `COGS` (Debit) and `Inventory` (Credit) default accounts during sale.
- Verified that `opname-service.ts` already correctly calculates `varianceValue` using the `avgUnitCost`.

## Next step
Move to the next task in the backlog.
