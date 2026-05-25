# Checkpoint: T-0178 — Period-compare wire + XLSX coverage sweep

- **Owner**: Claude Opus 4.7
- **Started**: 2026-05-25 12:20 WIB
- **Last updated**: 2026-05-25 12:45 WIB
- **Status**: 🟩 DONE
- **Phase**: Reporting UX polish

## Done

- **Period-over-period comparison wired into 2 reporting pages:**
  - `/reporting/daily-summary` — fetches the previous same-length
    window via `fetchDailySummaryPrevious` server action, renders
    delta badges on 8 metric cards (gross/discount/net/PB1/commission/
    netRevenue/refund/refundCount). Inverted-delta flag for cost-like
    metrics (discounts, commission, refunds) so a *decrease* renders
    as green. Header shows `vs {prevFrom} – {prevTo}`.
  - `/reporting/business-intelligence` — month-to-date totals get a
    delta badge vs the same length window before `monthStart`. Six KPIs
    wired (gross, netRevenue, orders, PB1, deliveryCommission, refunds,
    cashVariance). Same invertDelta convention.
- **XLSX coverage sweep — upgrade CSV → real exceljs XLSX**:
  - `_components/aging-client.tsx` — 2 sheets (Summary, Detail Lines).
  - `cogs/cogs-client.tsx` — 2 sheets (COGS Summary, Ingredient Detail).
  - `waste/waste-client.tsx` — 1 sheet (Waste).
  - All numeric cells now `Number` so Excel can sum.
- **i18n parity** kept for id/en/zh in all 3 namespaces touched
  (`reporting.dailySummary`, `reporting.bi`, `reporting.aging`,
  `reporting.cogs`, `reporting.waste`):
  - `vsPrevious` / `vsPreviousShort` / `vsPreviousRange`
  - `noBaseline` / `comparisonTitle`
  - `exportSummarySheet` / `exportDetailSheet` / `exportLinesSheet` /
    `exportSheet`

## Notes / decisions

- Period-compare badge is silent (no row) when previous = 0 (true
  no-baseline case) so reports launching after fresh seed don't show
  a meaningless "+∞%" badge.
- `invertDelta` flag chosen over a generic "lower-is-better" map so
  each metric explicitly opts in — easier to read at the call-site.
- XLSX export uses the existing `lib/export-workbook.ts` helper which
  dynamically imports `exceljs` only when a user actually clicks
  Export, keeping the initial client bundle slim.
- Omzet Harian intentionally NOT wired with period-compare — it's a
  single-day fiscal/PB1 view; comparison there would clutter the
  table without adding decision value. Leave for follow-up if asked.

## Verification

- `pnpm -r typecheck` PASS across 10 workspaces.
- Services tests: 589/589 PASS (no regression).
- Shared tests: 85/85 PASS.
- Total: 674/674 PASS.

## Backlog (carry-over to T-0179+)

- **T-0179** Switch AI `web_search` tool from Brave → Exa Search API
  per https://exa.ai/docs/reference/search-api-guide-for-coding-agents.
- **T-0180** Verify purchase-return module exists, add if missing.
- **T-0181** Employee attendance-history page (self-service).
- **T-0182** Shift schedule override per specific date.
- **T-0183** Member-data page for management (CRM-side view).
- **T-0184** Helpdesk/ticketing system + AI integration (AI files
  ticket instead of telling user "contact admin") + in-app + email
  notif to permission holders.
- **T-0185** Internal courier shipment tracking (non-sales) via
  BinderByte API — reuse existing client from purchasing.
- CSP nonce-based replace `unsafe-inline` (BACKLOG-CSP).
- WCAG 2.1 AA formal pass (BACKLOG-A11Y).
- Lint cleanup (332 err / 488 warn baseline).
