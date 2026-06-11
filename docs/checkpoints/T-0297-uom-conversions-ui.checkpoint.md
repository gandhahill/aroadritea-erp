# Checkpoint: T-0297 — UOM conversions management UI

- **Owner**: claude-fable-5
- **Started**: 2026-06-11 12:41 WIB
- **Last updated**: 2026-06-11 18:25 WIB
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

- ~~MCP tool untuk uom_conversions belum dibuat (CLAUDE.md §6)~~ — selesai via T-0298 (`7cc689a`).

## Revisi 2026-06-11 (lanjutan)

Permintaan user: field satuan asal/tujuan di form konversi adalah `<Input>` teks bebas — rawan mismatch ("Pack" vs "pak" vs "pck") terhadap `uom` produk. Revisi: jadikan dropdown yang sama dengan dropdown `uom` di form tambah/edit bahan (`/inventory/products`).

- **Konstanta bersama baru** `PRODUCT_UOM_OPTIONS` di `packages/shared/src/types/index.ts` (`pcs, cup, botol, ml, liter, gram, kg, pack, box`), tipe `ProductUom`, di-export via `@erp/shared/types`.
- `apps/web/app/(dash)/inventory/products/product-form.tsx`: dropdown `uom` sekarang memakai `PRODUCT_UOM_OPTIONS` (sebelumnya array hardcode inline). Jika nilai produk eksisting tidak ada di daftar (unit lama/legacy), nilai itu di-prepend sebagai opsi tambahan agar tidak hilang saat edit.
- `apps/web/app/(dash)/inventory/uom-conversions/uom-conversions-client.tsx`: field `fromUom`/`toUom` diganti dari `<Input>` menjadi `<Select>` dengan opsi dari helper `uomSelectOptions()` (sama logic legacy-value seperti di atas), placeholder pakai `common.actions.select` yang sudah ada.
- i18n: hapus key `fromUomPlaceholder`/`toUomPlaceholder` (sudah tidak terpakai) dari `en.json`, `id.json`, `zh.json`.
- Verifikasi: `pnpm --filter @erp/shared typecheck` PASS, `pnpm --filter @erp/web typecheck` PASS, `biome check` pada file yang disentuh PASS, `node scripts/check-i18n.mjs` PASS (4729 keys ×3, turun 2 dari penghapusan placeholder key). Tanpa migrasi DB.

## Next step

Tidak ada — selesai.

## Test status

- 665/665 PASS; typecheck/lint/i18n parity PASS.

## Commits So Far

| SHA | Message | Date |
|-----|---------|------|
| ddb79b4 | feat(T-0296,T-0297): POS save-as-draft + uom conversions management UI | 2026-06-11 |
| 427c64c | fix(T-0297): use shared uom dropdown for conversion form to prevent mismatches | 2026-06-11 |
