# Checkpoint: T-0160 - Switch VPS deployment runtime from Docker to PM2

- **Owner**: Codex
- **Started**: 2026-05-14 00:05 +07:00
- **Last updated**: 2026-05-14 17:30 +07:00
- **Status**: DONE

## Goal

Ubah jalur deployment VPS HestiaCP dari Docker Compose ke PM2 karena deployment Docker bermasalah di server production.

## Plan

1. [x] Tambah konfigurasi PM2 untuk `site`, `web`, `mcp`, dan `worker`.
2. [x] Update README, production readiness docs, SD, AGENTS, dan ADR deployment.
3. [x] Coba setup server via SSH jika tooling/auth memungkinkan.
4. [x] Jalankan validasi lokal minimal untuk file konfigurasi dan typecheck terkait.

## Result

- Production branch pushed to GitHub through commit `697cb98`.
- VPS pulled latest `master` in `/home/aroadritea/web/aroadritea.com/public_html/aroadritea-erp`.
- PM2 processes online: `aroadri-site`, `aroadri-web`, `aroadri-mcp`, `aroadri-worker`.
- Health checks OK:
  - `http://127.0.0.1:3000/api/healthz`
  - `http://127.0.0.1:3001/api/healthz`
  - `http://127.0.0.1:3002/healthz`
- MCP PM2 mode uses `MCP_ENABLE_STDIO=false`; stdio remains default for local MCP clients.

## Next step

No active next step. Optional hardening: rotate the root password and replace password SSH with an SSH key.
