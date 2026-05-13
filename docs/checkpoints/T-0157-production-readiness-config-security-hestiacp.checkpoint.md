# Checkpoint: T-0157 - Production readiness config, security, Naixer print settings, HestiaCP README

- **Owner**: Codex
- **Started**: 2026-05-13 21:06 +07:00
- **Last updated**: 2026-05-13 22:55 +07:00
- **Status**: DONE - pending user review/commit

## Goal

Menjawab permintaan user:

- Konfigurasi non-secret lewat UI settings, bukan `.env`.
- Login dapat memilih bahasa sejak awal.
- Investigasi bug/error dan hardening keamanan production tanpa mewajibkan 2FA.
- Naixer KDS label fleksibel 6x4 cm dan 4x3 cm landscape per printer, berisi QR, pickup number, jam pesanan, dan detail produk.
- Struk fleksibel, default 8 cm.
- Siapkan deployment VPS HestiaCP dan README.

## Plan

1. [x] Update SoT/SD/dokumentasi konfigurasi untuk requirement baru.
2. [x] Tambah schema/migration untuk POS operational settings dan Naixer print dimensions.
3. [x] Pindahkan POS posting config dari env ke DB/UI.
4. [x] Tambah UI setting POS printer/posting dan perluas UI Naixer KDS.
5. [x] Tambah language selector di login.
6. [x] Tambah hardening keamanan: rate limit login, audit attempt, security headers.
7. [x] Tambah README deployment HestiaCP.
8. [x] Jalankan lint, typecheck, test, build.

## Done

- Menambahkan `pos_settings` DB table, seed default per lokasi, dan UI `Settings -> POS Settings`.
- Menghapus konfigurasi POS non-secret dari `.env.example`; POS posting service sekarang membaca DB setting dengan fallback development yang aman.
- Menambahkan ukuran label Naixer per lokasi (`label_width_mm`, `label_height_mm`) dengan preset 60x40 mm dan 40x30 mm, preview QR data URL, pickup number, jam, dan detail produk.
- Menambahkan language selector di halaman login sebelum submit.
- Menambahkan DB-backed login attempt audit/rate limit per IP dan email hash.
- Menambahkan explicit Better Auth `secret`/`baseURL` supaya tidak memakai default secret library.
- Menambahkan security headers di Next.js dan Caddy, TLS 1.3 di Caddy, dan compose khusus HestiaCP yang bind port app ke localhost.
- Memperketat tenant access untuk Naixer settings dan scheduled jobs.
- Memperbaiki worker outage monitor agar memakai service DNS Docker (`site`, `web`, `mcp`), bukan `localhost`.
- Menambahkan `README.md`, `docs/PRODUCTION-READINESS.md`, dan update `docs/CONFIGURATION.md`.
- Mengubah Biome ignore untuk tidak lint `.agents` dan generated Drizzle meta snapshots.

## Decisions

- Secret tetap di `.env`: `DATABASE_URL`, `BETTER_AUTH_SECRET`, provider key, dan URL deployment.
- Setting operasional POS/printing dipindahkan ke database dan admin UI.
- 2FA tidak dibuat mandatory; hardening difokuskan ke rate limiting, audit attempt, header security, TLS, cookie security, dan deployment binding.
- File generated Drizzle meta tidak dilint oleh Biome; migration SQL tetap disimpan.

## Verification

- `pnpm exec biome check -- <changed files>`: PASS.
- `pnpm lint`: PASS, masih ada warning baseline lama tetapi tidak ada error.
- `pnpm typecheck`: PASS.
- `pnpm test`: PASS, 576 tests passed.
- `pnpm --filter @erp/services test`: PASS, 518 tests passed after auth hardening.
- `pnpm --filter @erp/mcp build`: PASS.
- `pnpm --filter @erp/worker build`: PASS.
- `pnpm --filter @erp/site build`: PASS, warning lokal `DATABASE_URL` kosong.
- `pnpm --filter @erp/web build`: PASS, warning lokal `DATABASE_URL` kosong.
- `pnpm build`: timed out at 10 minutes because app builds are heavy sequentially on Windows; individual app builds passed.

## Open issues / Manual QA

- Wajib isi `.env` production sebelum deploy: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, URL publik, dan provider secrets.
- Test print struk 80 mm dan ukuran lain harus dilakukan di printer fisik.
- Test scan label Naixer 60x40 mm dan 40x30 mm harus dilakukan di printer/mesin Naixer fisik.
- Security hardening sudah dinaikkan, tetapi tetap disarankan Cloudflare WAF/rate limiting di depan HestiaCP untuk production.
- 2FA tetap tidak mandatory sesuai permintaan user.

## Next step

User review diff, lalu commit dan push perubahan ini. Setelah deploy staging/VPS, jalankan migration `packages/db/migrations/0002_demonic_maximus.sql`, seed, dan manual QA printer/Naixer sesuai `docs/PRODUCTION-READINESS.md`.
