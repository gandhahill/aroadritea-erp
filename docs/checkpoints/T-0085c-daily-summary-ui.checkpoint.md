# T-0085c Checkpoint — Daily Summary UI

**Task**: UI reporting/daily-summary (table + charts + export XLSX)
**Status**: 🟨 IN_PROGRESS
**Date**: 2026-05-10

---

## Spec (SD §25.5.2)

### Files to create
- `apps/web/app/(dash)/reporting/daily-summary/page.tsx` — main page
- `apps/web/app/(dash)/reporting/daily-summary/actions.ts` — server actions
- `apps/web/app/(dash)/reporting/daily-summary/export-utils.ts` — XLSX export helper

### Features
1. **Filter bar**: date range (start/end), location selector, cashier selector
2. **Summary cards**: gross sales, discount total, net sales, PB1 tax, delivery commission, net revenue, refund total/count
3. **Payment breakdown table**: method | tx_count | total (formatted IDR)
4. **Top 10 products table**: rank | product | qty | nominal
5. **Charts** (lightweight, no chart lib — use inline SVG or CSS-based):
   - Donut chart for payment method %
   - Horizontal bar chart for top products
6. **Export XLSX** — use `xlsx` library already in `@erp/web` (package.json)
7. **Print / PDF** — window.print()

### Key notes
- `getDailySummary(params, ctx)` — params: `{ locationId, startDate: YYYY-MM-DD, endDate: YYYY-MM-DD, cashierId? }`
- Returns bigint strings — format as IDR with `Intl.NumberFormat('id-ID', { currency: 'IDR' })`
- XLSX export: use `XLSX.utils.json_to_sheet` + `XLSX.writeFile`
- No external chart library — CSS-only or inline SVG (for 2 GB RAM constraint)
- Locale: Bahasa Indonesia default

### Next Step
Create `apps/web/app/(dash)/reporting/daily-summary/page.tsx` with filter form + summary cards + two tables + XLSX export button.