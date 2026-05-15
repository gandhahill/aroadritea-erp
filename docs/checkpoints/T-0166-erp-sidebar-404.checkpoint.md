# Checkpoint: T-0166 — ERP Sidebar 404 Links

- **Owner**: Codex
- **Started**: 2026-05-15 12:43
- **Last updated**: 2026-05-15 15:31
- **Status**: 🟩 DONE

## Goal
Pastikan semua link yang bisa diklik dari sidebar ERP mengarah ke halaman valid, bukan 404, sekaligus menambahkan halaman `Docs/Panduan` internal sebagai pusat petunjuk penggunaan ERP.

Spec:
- SOURCE-OF-TRUTH §10, §11, §12
- SYSTEM-DESIGN §21, §36, §37

## Plan
1. [x] Audit route aktual di `apps/web/app` dan link sidebar.
2. [x] Tambahkan halaman missing yang memang modulnya sudah ada di spesifikasi.
3. [x] Tambahkan halaman Docs/Panduan ERP dan link sidebar.
4. [x] Jalankan typecheck dan static route audit lokal.
5. [x] Jalankan build dan smoke check production setelah deploy.
6. [x] Commit, push, deploy ke VPS, lalu verifikasi production.

## Findings
- Kandidat 404 dari sidebar: `/accounting/periods`, `/tax/rates`, `/tax/rules`, `/hr/leave`.
- User juga meminta halaman khusus `Docs/Panduan` untuk source of truth penggunaan ERP: fungsi modul, tutorial, dan troubleshooting.
- Ditambahkan halaman:
  - `/docs`
  - `/accounting/periods`
  - `/tax/rates`
  - `/tax/rules`
  - `/hr/leave`
  - `/hr/employees/new`
  - `/inventory/products`
  - `/inventory/products/new`
  - `/inventory/products/[id]`
  - `/accounting/journals/new`
  - `/purchasing`
  - `/purchasing/po/new`
  - `/settings/notifications`
- Sidebar sekarang memuat link Docs, Produk & Menu, Permissions, dan Scheduled Jobs.
- Sidebar sekarang memuat Purchasing dan Notifications.
- Static route audit internal `apps/web` menemukan `missing: []` untuk href/router/redirect statis yang bisa dicek dari filesystem.
- Production deploy:
  - Commit `3eab86b` deployed for route/docs/UI fixes.
  - Commit `bdb1b73` deployed for Next standalone PM2 runtime.
  - `pnpm db:seed`, `pnpm admin:ensure-access`, and `pnpm jobs:disable-unconfigured` passed on VPS.
  - `pm2` now runs `apps/site/.next/standalone/apps/site/server.js` and `apps/web/.next/standalone/apps/web/server.js`.
  - Health checks passed for site, web, and MCP.
  - Public smoke passed for `/id`, `/id/menu`, `/id/member/daftar`, `/id/syarat-dan-ketentuan`, `/id/kebijakan-privasi`, `/login`, `/hr/employees/new`, `/accounting/journals/new`, `/inventory/products/new`, `/settings/permissions`, `/docs`.
  - CSS assets for `aroadritea.com` and `erp.aroadritea.com` returned HTTP 200.

## Next step
No next step for T-0166. Continue T-0167 for the full requirement matrix and deeper module-by-module audit.

## Test status
- `pnpm --filter @erp/web typecheck` PASS.
- `pnpm --filter @erp/web build` PASS.
- Static route audit local PASS (`missing: []`, 47 static routes, 54 page routes, 85 hrefs checked).
- `pnpm --filter @erp/site build` PASS after standalone asset sync.
- VPS production smoke PASS.
