# Checkpoint: T-0297 — UOM conversions management UI

- **Owner**: claude-fable-5
- **Started**: 2026-06-11 12:41 WIB
- **Last updated**: 2026-06-11 17:15 WIB
- **Status**: 🟩 DONE
- **Phase**: F3
- **Branch**: master

## Goal

Halaman `/inventory/uom-conversions` untuk mengelola tabel `uom_conversions` (global & per-produk) — selama ini hanya bisa diisi via SQL, padahal sejak T-0295 konversi terdaftar adalah satu-satunya cara menerima qty bersatuan beda dari master produk (GRN pack→pcs dst.).

**Kriteria selesai (Definition of Done):**
- [x] Service `uom-conversion-service.ts` (list/upsert/delete, permission, audit)
- [x] Halaman + client UI (form tambah/edit + tabel + hapus dengan konfirmasi) — pola halaman categories
- [x] Sidebar + nav-access + route-permission map, gate `inventory.product`
- [x] i18n en/id/zh (namespace `inventory.uomConversions` + `nav.uomConversions`)
- [x] typecheck + lint + test + i18n parity lulus
- [x] Tanpa migrasi DB (tabel sudah ada sejak T-0234)

## Implementation Summary

- **Service** `packages/services/src/inventory/uom-conversion-service.ts`: `listUomConversions` (join nama produk), `upsertUomConversion` (zod; normalizeUom; tolak from==to; tolak duplikat pasangan dua arah dalam scope yang sama; validasi produk ada), `deleteUomConversion`. Permission `inventory.product.read` / `.update`. Semua mutasi ber-`auditRecord`.
- **Hard delete** dipilih (bukan soft): unique index `(tenant, product, from, to)` akan memblokir pembuatan ulang pasangan yang pernah di-soft-delete; histori tetap ada di `audit_log`.
- **Perbaikan terkait di `uom-service.ts`**: `convertQty` kini (1) menormalkan parameter from/to uom sebelum lookup (baris dari UI tersimpan ternormalisasi), (2) memfilter `deleted_at` saat membaca conversions.
- **UI**: form atas (scope global/produk via SearchableSelect, satuan asal/tujuan, pengali dengan live preview "1 pack = 25 pcs") + tabel daftar dengan edit (isi ulang form) dan hapus. Semua brand token, tanpa string hardcode.

## Files Touched

| Path | Action |
|------|--------|
| packages/services/src/inventory/uom-conversion-service.ts | new |
| packages/services/src/inventory/uom-service.ts | edit (normalize + deleted_at filter di convertQty) |
| packages/services/src/inventory/index.ts | edit (barrel) |
| apps/web/app/(dash)/inventory/uom-conversions/{page.tsx,actions.ts,uom-conversions-client.tsx} | new |
| apps/web/app/(dash)/sidebar.tsx | edit (menu + route-permission map) |
| apps/web/lib/nav-access.ts | edit |
| apps/web/messages/{en,id,zh}.json | edit |

## Open issues / Follow-up

- MCP tool untuk uom_conversions belum dibuat (CLAUDE.md §6) — kandidat backlog kecil.

## Next step

Tidak ada — selesai; ikut deploy bersama T-0296.

## Test status

- 665/665 PASS; typecheck/lint/i18n parity PASS.

## Commits So Far

| SHA | Message | Date |
|-----|---------|------|
| _(diisi setelah commit)_ | feat: POS drafts + UOM conversions UI | 2026-06-11 |
