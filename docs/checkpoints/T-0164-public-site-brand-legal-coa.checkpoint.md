# Checkpoint: T-0164 — Public Site Brand/Legal/i18n Polish + Office-aware COA

- **Owner**: Codex
- **Started**: 2026-05-15 06:57
- **Last updated**: 2026-05-15 09:06
- **Status**: 🟩 DONE

## Goal
Koreksi public website dan data accounting sesuai arahan user 2026-05-15:
- Kantor Yogyakarta/Jakarta tetap ada untuk kebutuhan internal/accounting, tetapi public site hanya menampilkan outlet.
- COA seed/dokumentasi mengembalikan diksi kantor Jakarta/Yogyakarta sesuai COA sebelumnya.
- Public site memakai favicon, logo di latar putih, dan tipografi/tagline yang lebih sesuai brand.
- Copy public site dibuat lebih natural.
- Tambah halaman Syarat & Ketentuan dan Kebijakan Privasi agar link member tidak 404.
- Halaman pendaftaran member dan OTP mendukung ID/EN/ZH.

Spec: SOURCE-OF-TRUTH §10, §15, §22, §23; SYSTEM-DESIGN §31, §36, §38.

## Plan
1. [x] Baca SoT/SD/TASK/brand guide/skill frontend-design/webapp-testing.
2. [x] Update dokumen bisnis/operasional agar public outlet-only tetapi kantor internal tetap tercatat.
3. [x] Koreksi COA seed untuk akun kantor Jakarta/Yogyakarta.
4. [x] Polish header/logo/favicon/font/copy public site.
5. [x] Tambah legal pages ID/EN/ZH dan i18n signup/OTP.
6. [x] Jalankan lint/typecheck/build/smoke visual.
7. [x] Commit, push, dan bila valid deploy/pull server.

## Done so far
- Membaca dokumen wajib dan menemukan Active Tasks kosong.
- Mengidentifikasi masalah utama: COA seed/docs berisi "Plaza Malioboro Store" pada akun yang seharusnya "Jakarta Office", dan signup/OTP masih hardcoded Bahasa Indonesia.
- SOURCE-OF-TRUTH, BRAND, AGENTS, dan CLAUDE diperbarui: kantor Yogyakarta/Jakarta dicatat untuk internal ERP/accounting, tetapi public site hanya menampilkan outlet.
- COA seed dikembalikan ke kode legacy user (Petty Cash, Cash, Cash in Bank, Pingpong Payment, Jakarta/Yogyakarta Office accounts, dll.) dan old normalized account codes akan dinonaktifkan saat seed.
- POS/tax/accounting default account codes disesuaikan ke COA legacy (`1-1300`, `4-1100`, `2-1500`, `2-2300`, dll.) termasuk migrasi 0003.
- Public header/footer memakai logo primary di backplate putih, favicon aktif, tagline exact `Nature Aroma in Every Sip`, copy dibuat lebih natural, dan lokasi publik tidak menampilkan CTA sosial.
- Teks signage outlet `中国茶` ditambahkan sebagai aksen brand di semua locale: badge kecil di header dan watermark halus di hero.
- Public menu/customization dan contoh label Naixer diperjelas agar mencantumkan `Normal sugar` dan `Normal ice`, bukan hanya less/no.
- next-intl site/web diberi `timeZone: Asia/Jakarta` untuk menghilangkan `ENVIRONMENT_FALLBACK` saat build.
- Route public `lokasi` dan `menu` tidak lagi import DB di top-level; bila `DATABASE_URL` kosong/tidak siap, lokasi memakai fallback outlet dan menu tidak 500.
- Member signup + OTP memakai i18n ID/EN/ZH; halaman legal `/syarat-dan-ketentuan` dan `/kebijakan-privasi` ditambahkan untuk semua locale.
- Seed lokasi sekarang punya 2 outlet aktif plus kantor internal `YOG-OFC` dan `JKT-OFC`; query public tetap filter `type='store'`.
- Bootstrap admin seed tidak lagi memakai password default; admin pertama hanya dibuat jika `SEED_ADMIN_PASSWORD` diisi eksplisit.
- Commit `841f4fd` sudah dipush ke GitHub, dipull di VPS, migration + seed production berhasil, semua app production dibuild ulang dan PM2 reload.

## Decisions
- Public locations tetap hanya `type='store'`, sehingga office tidak akan tampil di website publik.
- Kantor internal masuk dokumentasi dan COA, bukan fallback public site.

## Open issues
- Belum ada.

## Next step
None. T-0164 selesai dan sudah deploy production. Jika ada perubahan lanjutan, buat task baru.

## Test status
- Sebelum update lokasi internal: JSON parse OK, `@erp/site`, `@erp/db`, `@erp/services` typecheck OK, `pnpm lint:fix` OK, `@erp/services` vitest 527 tests OK.
- Final rerun:
  - `node` JSON/i18n smoke OK (`中国茶`, Normal sugar, Normal ice).
  - `pnpm lint:fix` exit 0; 457 warning lama tetap ada, tidak ada fix baru.
  - `pnpm --filter @erp/site typecheck` OK setelah build serial.
  - `pnpm --filter @erp/site build` OK, tanpa `ENVIRONMENT_FALLBACK`.
  - `pnpm --filter @erp/web typecheck` OK.
  - `pnpm --filter @erp/web build` OK.
  - `pnpm --filter @erp/db typecheck` OK.
  - `pnpm --filter @erp/db typecheck` OK setelah hardening bootstrap admin seed.
  - `pnpm --filter @erp/services typecheck` OK.
  - `pnpm --filter @erp/mcp build` OK.
  - `pnpm --filter @erp/worker build` OK.
  - `pnpm --filter @erp/db generate` OK, no schema changes.
  - `pnpm --filter @erp/services exec vitest run` OK: 24 files, 527 tests.
  - Playwright local site smoke OK on Next start: CSS loaded, legal pages 200, locations outlet-only, footer icons/logo present, `中国茶` visible, `Normal sugar`/`Normal ice` visible, no mobile horizontal overflow.
  - Production VPS: `git pull --ff-only`, `pnpm --filter @erp/db migrate`, `pnpm --filter @erp/db seed`, `pnpm --filter @erp/site build`, `pnpm --filter @erp/web build`, `pnpm --filter @erp/mcp build`, `pnpm --filter @erp/worker build`, `pm2 reload` OK.
  - Live smoke: `/id`, `/id/menu`, `/id/lokasi`, `/id/member/daftar`, `/id/kebijakan-privasi`, `/id/syarat-dan-ketentuan`, `https://erp.aroadritea.com/api/healthz`, dan `https://aroadritea.com/api/healthz` semuanya HTTP 200.
  - Live visual smoke Playwright: CSS stylesheet aktif, body font brand aktif, background bukan polos, hero Aroadri tampil, final URL tetap domain production.
