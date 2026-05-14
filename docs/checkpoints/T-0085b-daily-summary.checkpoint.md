# T-0085b Checkpoint — Daily Summary Reporting Service

**Task**: Service `reporting.dailySummary` (SD §25.5.1)
**Status**: ✅ DONE
**Commit**: a3035f6
**Date**: 2026-05-10

---

## Files Created
- `packages/services/src/reporting/daily-summary.ts` — full service (~270 lines)

## Files Modified
- `packages/services/src/reporting/index.ts` — added barrel exports

---

## What Was Built

**`getDailySummary(params, ctx)`** returns:
- `grossSales` / `discountTotal` / `netSales` / `taxTotal` (PB1 collected, back-out from inclusive)
- `commissionDelivery`: 20% × delivery channel gross (gofood/grabfood/shopeefood)
- `netRevenue`: netSales − commissionDelivery
- `refundTotal` / `refundCount`
- `paymentBreakdown[]`: method | txCount | total (via `inArray` + `groupBy`)
- `shiftSummary[]`: openedAt, closedAt, openingCash, expectedCash, actualCash, variance, cashierName, txCount, txTotal
- `topProducts[]`: rank 1-10 by nominal DESC, with qty, nominal, channel
- `isPreliminary`: false (reserved field for real-time / EOD mode)

### Key Design Decisions

- Bigint arithmetic for all money values (no floating point)
- `DELIVERY_COMMISSION_RATE = 20n` (BigInt literal for safe division)
- Delivery channel filter: `['gofood', 'grabfood', 'shopeefood'].includes(s.channel)`
- `inArray` from drizzle-orm for efficient bulk lookup
- Top products: `groupBy(productId, channel)` with `sum(lineSubtotal) DESC .limit(10)`
- `productName` left as productId string (resolved by caller/UI via product map)

---

## TypeScript

- `pnpm tsc -p packages/services/tsconfig.json --noEmit` — clean

---

## Next Steps

**Immediate next**: T-0085c — UI `reporting/daily-summary` page (table + charts + export XLSX)
**Also next**: T-0074 — Excel import service for stock_movement_manual (Sheet 1 + Sheet 2)
