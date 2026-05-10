# T-0085h — Service + UI reporting.donations + export XLSX + MCP tool

| Field | Value |
|-------|-------|
| **Owner** | Claude Opus 4.6 |
| **Started** | 2026-05-10 |
| **Last updated** | 2026-05-10 |
| **Status** | 🟨 IN PROGRESS |
| **Phase** | 2 |
| **Branch** | master |

---

## Task

Donation report: service + UI page + XLSX export + MCP tool (SD §25.11.5, §25.11.6).

## Specification (SD §25.11.5)

- Page: `apps/web/(dash)/reporting/donations/`
- Filter: tanggal (start/end), lokasi
- Table: tanggal | jumlah donasi | jumlah transaksi donasi | rata-rata
- Total donasi periode + export XLSX

## Files

1. `packages/services/src/reporting/donations.ts` — service
2. `packages/services/src/reporting/index.ts` — barrel export
3. `apps/web/app/(dash)/reporting/donations/page.tsx` — page
4. `apps/web/app/(dash)/reporting/donations/actions.ts` — server action
5. `apps/web/app/(dash)/reporting/donations/donations-client.tsx` — client component
6. `apps/mcp/src/tools/reporting.ts` — MCP tool (reporting.get_donations)
7. i18n messages (id/en/zh)

## Next step

1. Create service `getDonationReport`
2. Create UI page + client + actions
3. Add XLSX export
4. Add MCP tool
5. Typecheck + test + commit
