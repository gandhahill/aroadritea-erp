# Checkpoint: T-0161 - Final Production Hardening and Smoke Test

- **Owner**: Codex
- **Started**: 2026-05-14 17:35 +07:00
- **Last updated**: 2026-05-14 17:35 +07:00
- **Status**: IN_PROGRESS

## Goal

Verifikasi dan rapikan kesiapan production setelah runtime VPS beralih ke PM2.

## Plan

1. [ ] Verifikasi repo lokal, GitHub, dan server sinkron.
2. [ ] Jalankan build/typecheck/test/audit yang relevan.
3. [ ] Verifikasi migrasi DB, seed, dan konfigurasi environment production.
4. [ ] Verifikasi PM2, startup, logrotate/log growth, firewall, port publik, reverse proxy/SSL.
5. [ ] Jalankan smoke test health lokal dan publik.
6. [ ] Dokumentasikan hasil, risiko tersisa, dan tindakan yang perlu keputusan user.

## Notes

- Jangan mematikan login password SSH atau merotasi root password tanpa memastikan akses baru sudah valid.
- Jangan mencetak secret server ke log/chat.

## Next step

Run local and server readiness checks, then update this checkpoint with exact results.
