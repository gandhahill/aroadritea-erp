# T-0085f — UI reporting/hourly-sales (heatmap + table + export XLSX)

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

UI reporting/hourly-sales (heatmap + table + export XLSX) — SD §25.6.3.

## Specification (SD §25.6.3)

- Page: `apps/web/app/(dash)/reporting/hourly-sales/`
- Filter: tanggal (start/end), lokasi, groupBy channel/day toggle
- Heatmap: CSS-based (conic-gradient) — channels × hours (10–22)
- Table: per-channel breakdown with hourly cells
- Export XLSX

## Files to create

1. `packages/services/src/reporting/hourly-sales.ts` — service (DONE in T-0085e)
2. `packages/services/src/reporting/index.ts` — barrel export (DONE)
3. `apps/web/app/(dash)/reporting/hourly-sales/page.tsx` — server component
4. `apps/web/app/(dash)/reporting/hourly-sales/actions.ts` — server action
5. `apps/web/app/(dash)/reporting/hourly-sales/hourly-sales-client.tsx` — client component
6. i18n messages (id/en/zh)

## Reference

See `apps/web/app/(dash)/reporting/daily-summary/` for the pattern to follow (filter bar, summary cards, table, export XLSX).

## Completed

1. ✅ `page.tsx` — server component
2. ✅ `actions.ts` — server action wrapping `getHourlySales`
3. ✅ `hourly-sales-client.tsx` — client component with heatmap + table + export
4. ✅ Sidebar nav — added "Penjualan Per Jam" link
5. ✅ Typecheck clean, 300 tests pass

## Next step

1. Commit + push
2. Add MCP tool `reporting.get_hourly_sales` (T-0085g)
