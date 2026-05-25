# Checkpoint: T-0187 — Lengkapi panduan user ERP + refresh docs DB

- **Owner**: Codex
- **Started**: 2026-05-25 22:53 WIB
- **Last updated**: 2026-05-25 22:53 WIB
- **Status**: IN_PROGRESS

## Goal
Lengkapi panduan user ERP berdasarkan halaman aktual di `apps/web/app/(dash)` dan tambahkan cara aman untuk mengganti konten panduan yang sudah tersimpan di database untuk bahasa Indonesia, Inggris, dan Mandarin.

Spec terkait: SOURCE-OF-TRUTH §21.2b, SYSTEM-DESIGN §25.4, §37, §38.

## Plan
1. [x] Baca `TASK.md`, `SOURCE-OF-TRUTH.md`, `SYSTEM-DESIGN.md`, dan panduan docs saat ini.
2. [ ] Jalankan subagent untuk memetakan halaman, tombol, fungsi, dan use case per modul.
3. [ ] Perbarui default konten panduan di `apps/web/app/(dash)/docs/docs-content.ts`.
4. [ ] Tambahkan mekanisme refresh/replace konten panduan DB per bahasa.
5. [ ] Jalankan verifikasi relevan.
6. [ ] Update checkpoint dan `TASK.md`.

## Done so far
- Ditemukan halaman panduan publik ERP internal:
  - `apps/web/app/(dash)/docs/page.tsx`
  - `apps/web/app/(dash)/docs/docs-content.ts`
  - `apps/web/app/(dash)/docs/editable-docs.ts`
- Ditemukan editor CMS docs:
  - `apps/web/app/(dash)/cms/docs/page.tsx`
  - `apps/web/app/(dash)/cms/docs/docs-editor-form.tsx`
  - `apps/web/app/(dash)/cms/docs/actions.ts`
- Konten docs disimpan di `cms_settings` dengan key `erp_docs_content`. Default di source hanya dipakai saat setting kosong.

## Decisions
- Task baru dibuat sebagai T-0187 agar tidak mengambil alih T-0186/T-0167 yang masih aktif.
- Konten user guide harus tetap trilingual dan tetap mendukung anotasi `{perm=...}` serta `{audience=...}`.

## Open issues
- Perlu pilih mekanisme refresh: CLI script admin, tombol UI reset, atau service helper. Kemungkinan terbaik: keduanya kecil dan audit-aware.

## Next step
Spawn explorer subagents untuk membaca route/module aktual, lalu integrasikan ringkasan mereka ke update `docs-content.ts` dan script/action refresh docs.

## Test status
- Belum jalan.
