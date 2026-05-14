# Checkpoint: T-0161 - Final Production Hardening and Smoke Test

- **Owner**: Codex
- **Started**: 2026-05-14 17:35 +07:00
- **Last updated**: 2026-05-14 19:22 +07:00
- **Status**: DONE

## Goal

Verifikasi dan rapikan kesiapan production setelah runtime VPS beralih ke PM2.

## Plan

1. [x] Verifikasi repo lokal, GitHub, dan server sinkron.
2. [x] Jalankan build/typecheck/test/audit yang relevan.
3. [x] Verifikasi migrasi DB, seed, dan konfigurasi environment production.
4. [x] Verifikasi PM2, startup, logrotate/log growth, firewall, port publik, reverse proxy/SSL.
5. [x] Jalankan smoke test health lokal dan publik.
6. [x] Dokumentasikan hasil, risiko tersisa, dan tindakan yang perlu keputusan user.

## Notes

- Jangan mematikan login password SSH atau merotasi root password tanpa memastikan akses baru sudah valid.
- Jangan mencetak secret server ke log/chat.

- Dependency hardening:
  - `pnpm audit --audit-level moderate` lokal dan server: PASS, no known vulnerabilities.
  - Next.js upgraded ke 15.5.18, Hono ke 4.12.18, `xlsx` diganti `exceljs`, dan pnpm overrides ditambahkan.
- Build/test:
  - `pnpm typecheck`: PASS.
  - `pnpm test`: PASS, 576 tests.
  - `pnpm lint`: PASS setelah script memakai `--max-diagnostics=1000`; masih ada 581 warning Biome yang tidak blocking.
  - `pnpm --filter @erp/site build`: PASS lokal dan server.
  - `pnpm --filter @erp/web build`: PASS lokal dan server.
- Deployment:
  - Server repo deployed di commit `e4a4a0c`.
  - PM2 processes online: `aroadri-site`, `aroadri-web`, `aroadri-mcp`, `aroadri-worker`.
  - `pm2-root` systemd enabled dan active.
  - Port app 3000/3001/3002 listen hanya di `127.0.0.1`; akses publik langsung ke port tersebut timeout.
  - Public health OK:
    - `https://aroadritea.com/api/healthz`
    - `https://erp.aroadritea.com/api/healthz`
    - `https://erp.aroadritea.com/mcp/healthz`
- Redirect fix:
  - Root site sekarang redirect ke `https://aroadritea.com/id`.
  - Root ERP sekarang redirect ke `https://erp.aroadritea.com/login?callbackUrl=%2F`.
  - Middleware site/web memakai origin publik saat runtime menerima loopback origin.
  - HestiaCP/Nginx live config ditambah `X-Forwarded-Host` dan `X-Forwarded-Port`.
- SSH:
  - Dedicated local key `C:\Users\ASUS\.ssh\aroadri_erp_vps_ed25519` berhasil login ke root server.
  - Fingerprint: `SHA256:iYsU+7R0EgnlPkeP6YnLJ/lREUDVH2XKopSVLkeX40w`.
  - Password login root belum dimatikan agar tidak mengunci akses sebelum user mengonfirmasi key sudah disimpan aman.
- Risiko tersisa:
  - HestiaCP service publik bawaan masih membuka SSH, mail, DNS, FTP, dan panel Hestia; app ports sudah tertutup dari publik.
  - Disarankan rotasi password root yang pernah dikirim di chat dan, setelah key aman, nonaktifkan password login atau batasi SSH dengan allowlist/Cloudflare Tunnel/VPN.
  - Security tidak bisa diklaim absolut tanpa pentest eksternal; baseline deploy saat ini sudah melewati audit dependency, test, build, smoke, TLS/header, dan port exposure check.

## Next step

No code blocker remains for current PM2 production deployment. Optional next hardening: rotate root password, disable root password login after key backup is confirmed, and review whether FTP should remain open for Hestia workflow.
