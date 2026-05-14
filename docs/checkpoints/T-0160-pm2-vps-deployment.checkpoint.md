# Checkpoint: T-0160 - Switch VPS deployment runtime from Docker to PM2

- **Owner**: Codex
- **Started**: 2026-05-14 00:05 +07:00
- **Last updated**: 2026-05-14 00:05 +07:00
- **Status**: IN_PROGRESS

## Goal

Ubah jalur deployment VPS HestiaCP dari Docker Compose ke PM2 karena deployment Docker bermasalah di server production.

## Plan

1. [ ] Tambah konfigurasi PM2 untuk `site`, `web`, `mcp`, dan `worker`.
2. [ ] Update README, production readiness docs, SD, AGENTS, dan ADR deployment.
3. [ ] Coba setup server via SSH jika tooling/auth memungkinkan.
4. [ ] Jalankan validasi lokal minimal untuk file konfigurasi dan typecheck terkait.

## Next step

Tambahkan `ecosystem.config.cjs`, lalu update dokumentasi deployment dari Docker ke PM2.
