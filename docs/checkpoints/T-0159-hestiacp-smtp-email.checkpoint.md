# Checkpoint: T-0159 - Switch automatic email to HestiaCP SMTP

- **Owner**: Codex
- **Started**: 2026-05-13 23:10 +07:00
- **Last updated**: 2026-05-13 23:16 +07:00
- **Status**: DONE

## Goal

Ubah email otomatis agar memakai SMTP mailbox bawaan HestiaCP, bukan provider Resend/SES.

## Plan

1. [x] Ubah member OTP email sender dari Resend API ke SMTP HestiaCP.
2. [x] Update `.env.example`, README, docs konfigurasi, SoT/SD/ADR.
3. [x] Jalankan typecheck/test terkait.

## Completed

- `packages/services/src/member/index.ts` kini mengirim OTP member via SMTP HestiaCP (`SMTP_*`) dengan STARTTLS untuk port 587.
- `apps/worker/src/jobs/outage-notification.ts` memakai format sender yang sama dan menghormati `SMTP_SECURE`.
- `.env.example`, `README.md`, `docs/CONFIGURATION.md`, `docs/PRODUCTION-READINESS.md`, `SOURCE-OF-TRUTH.md`, `SYSTEM-DESIGN.md`, `AGENTS.md`, dan ADR terkait sudah menjadikan HestiaCP SMTP sebagai keputusan resmi.
- ADR baru dibuat di `docs/adr/0011-hestiacp-smtp-transactional-email.md`.
- Validasi lulus: `pnpm --filter @erp/services typecheck`, `pnpm --filter @erp/worker typecheck`, `pnpm --filter @erp/services test`, `pnpm --filter @erp/worker build`, `pnpm typecheck`, `pnpm lint` (exit 0 dengan warning lama/non-blocking).

## Next step

Commit bersama perubahan T-0157/T-0158/T-0159 ketika user meminta commit/push.
