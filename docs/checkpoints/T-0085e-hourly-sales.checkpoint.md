# T-0085e — Service reporting.hourlySales + groupBy logic

| Field | Value |
|-------|-------|
| **Owner** | Claude Opus 4.6 |
| **Started** | 2026-05-11 |
| **Last updated** | 2026-05-11 |
| **Status** | 🟩 DONE |
| **Phase** | 2 |
| **Branch** | master |

---

## Task

Service `reporting.hourlySales` + groupBy logic (SD §25.6, §25.6.1–§25.6.2).

## Specification

**SD §25.6**: Hourly Sales Report
- Breakdown: per hour of the day (10:00–22:00 WIB = hours 10..21 inclusive)
- Group by: date + channel (dine_in, take_away, gofood, grabfood, shopeefood)
- Metrics per cell: transaction count + gross sales

**SD §25.6.1**: Hourly Breakdown per Channel
- For each day in range: 24-hour × N-channel matrix
- Only hours 10–22 relevant (store hours), others = 0

**SD §25.6.2**: Group by result
- Sum over all days in range
- Group by channel → hourly average per channel

## Files to create

1. `packages/services/src/reporting/hourly-sales.ts` — service `getHourlySales(params, ctx)`
2. `packages/services/src/reporting/index.ts` — barrel export
3. Tests: `packages/services/tests/reporting-hourly-sales.test.ts`

## Types

```ts
interface HourlySalesParams {
  locationId: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  groupBy?: 'channel' | 'day'; // default: 'channel'
}

interface HourlyCell {
  txCount: number;
  grossSales: string; // bigint string
}

interface HourlySalesResult {
  period: { start: string; end: string };
  locationId: string;
  groupBy: 'channel' | 'day';
  // When groupBy='channel': hourly breakdown per channel
  // channelRows: { channel, hourBreakdown: Record<hour, HourlyCell> }[]
  // When groupBy='day': daily breakdown with hour breakdown
  // dayRows: { date, hourBreakdown: Record<hour, HourlyCell> }[]
  // Grand total per hour
  hourTotals: Record<string, HourlyCell>; // "10", "11", ... "21"
  // Overall totals
  totalTxCount: number;
  totalGrossSales: string;
}
```

## Design Decisions

- Bigint arithmetic for all money values
- Hours: strings "10".."21" (store hours 10:00–22:00 WIB)
- Dates in WIB timezone
- Permission: `accounting.view` | `reporting.view`
- Uses `inArray` for efficient bulk lookups (same pattern as daily-summary.ts)

## Completed

1. ✅ Created `hourly-sales.ts` with `getHourlySales(params, ctx)`
2. ✅ Barrel export in `reporting/index.ts`
3. ✅ 8 unit tests (vi.hoisted mock pattern)
4. ✅ Typecheck clean, 300 tests pass
5. ✅ Mock pattern: `vi.hoisted()` + `vi.mock('@erp/db')` for sequential DB mock

### Key fix: Result type uses `.value` not `.data`
- `Result<T>` has `{ ok: true, value: T }` — tests must use `result.value!` not `result.data!`

## Next step

1. Update checkpoint → DONE ✅
2. Update TASK.md (move T-0085e to Done)
3. Commit + push
4. Continue T-0085f — UI hourly-sales (heatmap + table + export XLSX)
