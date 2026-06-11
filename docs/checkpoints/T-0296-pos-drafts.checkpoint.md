# Checkpoint: T-0296 — POS drafts (manual sales + consumed ingredients)

- **Owner**: claude-fable-5
- **Started**: 2026-06-11 12:41 WIB
- **Last updated**: 2026-06-11 17:15 WIB
- **Status**: 🟩 DONE
- **Phase**: F3 (functional sweep — UX hardening after MLI incident)
- **Branch**: master

## Goal

User dapat memilih **Simpan Draft** atau **Posting** di form input penjualan manual (`/pos/manual-sales`) dan pemakaian bahan (`/pos/manual-sales/consumed`). Saat posting gagal (mis. error uom 2026-06-11), isian tidak hilang: draft tersimpan server-side, bisa dimuat ulang, diedit, diposting, atau dihapus. Setelah posting sukses dari draft → draft terhapus otomatis.

**Kriteria selesai (Definition of Done):**
- [x] Tabel `pos_drafts` + migrasi drizzle `0043_noisy_bill_hollister.sql`
- [x] Service `packages/services/src/pos/drafts.ts` (save/list/delete) — permission `pos.transact` + audit log
- [x] UI: `DraftsPanel` bersama (tombol Simpan Draft + daftar muat/hapus) di kedua form
- [x] Draft terhapus otomatis setelah posting sukses (hidden input `draftId` → `deletePosDraft` di action)
- [x] i18n en/id/zh lengkap (13 kunci `pos.manualSales.draft*`)
- [x] typecheck + lint + test (665/665) + i18n parity lulus
- [x] Commit + push
- [x] Migrasi DB di VPS + deploy (migrasi 0043 applied & `\d pos_drafts` terverifikasi; build OK; pm2 reload; login 200, health 200)

## Implementation Summary

- **Schema**: `pos_drafts` di `packages/db/schema/pos.ts` — kind (`manual_sales` | `consumed_ingredients`), title, payload jsonb (state form mentah), audit cols. Payload TIDAK divalidasi saat simpan; validasi terjadi di jalur posting biasa.
- **Service**: `savePosDraft` (insert atau overwrite by draftId), `listPosDrafts` (per kind, max 50, terbaru dulu), `deletePosDraft` (soft delete). Semua via permission `pos.transact` + `auditRecord`.
- **Web**: `draft-actions.ts` (server actions) + `drafts-panel.tsx` (client, dipakai dua form). Panel di bawah form; "muat" mengisi state form (manual-sales pakai `formEpoch` untuk remount field uncontrolled), banner amber saat draft aktif.
- **Auto-delete**: kedua form mengirim hidden `draftId`; `createManualSalesAction` dan `createConsumedIngredientsAction` memanggil `deletePosDraft` setelah sukses penuh. Jalur update manual-sales (delete+recreate) ikut tertangani karena delegasi formData yang sama.

## Decisions

- Draft **server-side** (bukan localStorage): tahan ganti perangkat, bisa dilihat antar user (per tenant), dapat audit trail. Konsekuensi: migrasi DB baru.
- Payload jsonb opaque per kind; draft yang dimuat saat mengedit closing existing menyimpan `editId`/`referenceId` di payload sehingga posting dari draft tetap jalur update.

## Files Touched

| Path | Action | Note |
|------|--------|------|
| packages/db/schema/pos.ts | edit | + tabel `posDrafts` |
| packages/db/migrations/0043_noisy_bill_hollister.sql (+meta) | new | CREATE TABLE pos_drafts + 2 index |
| packages/services/src/pos/drafts.ts | new | save/list/delete |
| packages/services/src/pos/index.ts | edit | barrel export |
| apps/web/app/(dash)/pos/manual-sales/draft-actions.ts | new | server actions |
| apps/web/app/(dash)/pos/manual-sales/drafts-panel.tsx | new | shared client panel |
| apps/web/app/(dash)/pos/manual-sales/{page,actions,manual-sales-client}.tsx/ts | edit | wiring + auto-delete |
| apps/web/app/(dash)/pos/manual-sales/consumed/{page,actions,client}.tsx/ts | edit | wiring + auto-delete |
| apps/web/messages/{en,id,zh}.json | edit | 13 kunci draft* |

## Next step

Tidak ada — selesai dan sudah dideploy ke produksi 2026-06-11 ~17:26 WIB (migrasi 0043 applied, pm2 reload, health check 200).

## Test status

- **Unit/Integration**: 665/665 PASS (`pnpm --filter @erp/services test`)
- **typecheck**: PASS semua workspace; **lint**: PASS; **i18n parity**: PASS (4731 kunci ×3)

## Commits So Far

| SHA | Message | Date |
|-----|---------|------|
| ddb79b4 | feat(T-0296,T-0297): POS save-as-draft + uom conversions management UI | 2026-06-11 |
