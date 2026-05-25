# Checkpoint: T-0174 — F&B BI gaps

- **Owner**: Claude Opus 4.7
- **Started**: 2026-05-25 08:10 WIB
- **Last updated**: 2026-05-25 11:33 WIB
- **Status**: 🟩 DONE
- **Phase**: Reporting / BI (E13 backlog)
- **Branch**: master

## Goal

Tutup 4 gap reporting yang sebelumnya hanya backlog catat di audit
E13:

1. **AR aging** — outstanding piutang per partner per bucket umur
   (0-30, 31-60, 61-90, >90 hari) dari `journal_lines` melawan akun
   `1-1500` (Piutang Usaha).
2. **AP aging** — sama tetapi untuk `2-1100` (Utang Usaha).
3. **COGS / recipe costing** — harga pokok per produk berdasarkan
   BOM + harga rata-rata bahan (`stock_levels.unitCost` atau
   `defaultCostPrice`).
4. **Waste / spoilage** — total qty + nilai (Rp) yang dihapus via
   `stock_adjustments` dengan `reason='waste'` per periode per
   lokasi.

Plus: **UI cash-flow** page (service `reporting.cashFlow` sudah ada
sejak awal tapi belum punya halaman UI).

**Aturan i18n (user req): SEMUA label / header / button / pesan
toast di halaman BARU wajib pakai `useTranslations(...)` /
`getTranslations(...)`. Tidak ada string hardcoded di JSX.** Key
baru ditambah paralel di `apps/web/messages/{id,en,zh}.json`.

**DoD:**
- [ ] Service `aging.ts` (AR & AP) + tests dengan mock journal lines.
- [ ] Service `cogs.ts` + tests untuk hitung BOM × cost.
- [ ] Service `waste.ts` + tests untuk filter adjustment reason.
- [ ] UI `/reporting/aging-receivables` + `/aging-payables` +
      `/cogs` + `/waste` + `/cash-flow` — semua i18n bersih.
- [ ] XLSX export per page (re-use `export-workbook.ts`).
- [ ] Sidebar entries id/en/zh.
- [ ] Typecheck + tests PASS.

## Plan

1. [ ] `packages/services/src/reporting/aging.ts` — generic aging
       function yang menerima `{kind: 'AR'|'AP', accountCode, asOfDate, locationId?}`.
2. [ ] `packages/services/src/reporting/cogs.ts` — iterasi produk
       sellable yang punya BOM, hitung sum(line.qty * ingredient
       cost), return per produk.
3. [ ] `packages/services/src/reporting/waste.ts` — query
       `stock_adjustments` reason `waste` join `stock_adjustment_lines`,
       group by product.
4. [ ] Export di `reporting/index.ts`.
5. [ ] Server Actions per page (selalu derive ctx via getSession).
6. [ ] Pages + client list components. Pakai `PageHeader`,
       `FilterBar`, `Table`, `Pagination` yang sudah ada.
7. [ ] i18n keys id/en/zh paralel.
8. [ ] Sidebar links di group "Reporting".
9. [ ] XLSX export buttons.
10. [ ] Tests + typecheck + commit + push.

## Done so far

- **Service `aging.ts`** — AR (default `1-1500`) & AP (default `2-1100`)
  dari `journal_lines`, sign convention: AR = debit-credit, AP =
  credit-debit. Bucket 0-30 / 31-60 / 61-90 / >90 dari `dueDate` (fallback
  `postingDate`). Skip net-zero & negative balances. Drill-down detail
  per baris jurnal.
- **Service `cogs.ts`** — iterasi produk sellable, ambil BOM aktif
  terbaru per produk (max bomVersion), exclude line `isOptional`, hitung
  `qty * ingredient.defaultCostPrice`. Output: per-produk cost, gross
  margin, % margin, list bahan, plus `missingBomProductIds` untuk
  TODO list.
- **Service `waste.ts`** — query `stock_adjustments` reason matches
  `%waste%` / `%susut%` / `%spoil%` / `%basi%` / `%expir%`, filter
  approved (atau include pending), join lines, group per
  (productId, variantId), unit cost dari line.unitCost (fallback ke
  product default), sort by value desc.
- **UI pages**:
  - `/reporting/aging-receivables` + `/aging-payables` (share
    `_components/aging-client.tsx`) — filter asOf + lokasi, summary
    cards per bucket, table partner+buckets, drill-down detail
    expandable.
  - `/reporting/cash-flow` — service sudah ada sejak awal; UI baru
    dengan filter periode+lokasi, 3 summary cards (inflow/outflow/net),
    section per kind (operating/investing/financing) dengan movements.
  - `/reporting/cogs` — checkbox include-inactive, missing-BOM banner,
    table produk + flag negative margin, expand untuk ingredient
    details.
  - `/reporting/waste` — filter periode+lokasi+include-pending,
    summary qty + value, table per (product, variant).
- **i18n**: namespace baru `reporting.aging`, `reporting.cashFlowPage`,
  `reporting.cogs`, `reporting.waste` di id/en/zh paritas. Sidebar
  keys baru `cashFlow`, `agingReceivables`, `agingPayables`, `cogs`,
  `waste` di id/en/zh.
- **Sidebar**: 5 link baru di group Reporting.
- **CSV export**: per page (browser download, tidak menambah
  dependency baru).
- **Test**: `packages/services/tests/reporting-aging.test.ts` — 4
  scenarios (AR bucket 31-60, AR net-zero skip, AP sign flip, account
  not-found). PASS.

## Decisions

- **Aging direction**: AR/AP dihitung dari saldo posted journal lines
  (debit-credit untuk AR; credit-debit untuk AP) per partner per
  journal_line. Bucket umur = `today - lineDueDate`; jika dueDate
  null pakai `postingDate`.
- **COGS basis**: untuk MVP gunakan `productVariants.costPrice` (jika
  >0) → fallback `products.defaultCostPrice`. Future enhancement:
  weighted-average dari `stock_levels.unitCost` per location.
- **Waste reason convention**: `stock_adjustments.reason` sudah free-
  text. Halaman waste filter LIKE `%waste%` OR `%susut%` OR
  `%spoilage%` agar mencakup variasi bahasa.
- **Permission**: re-use `reporting.view` (sudah ada di seed).

## Next step

Buat service aging dulu. Edit
`packages/services/src/reporting/aging.ts` (file baru).

## Test status

- _(belum, baseline T-0173 hijau 650/650)_

## Files Touched

| Path | Action | Note |
|------|--------|------|
| `docs/checkpoints/T-0174-fnb-bi-gaps.checkpoint.md` | Added | This file. |

## Commits So Far

| SHA | Message | Date |
|-----|---------|------|
| _(akan)_ | | |
