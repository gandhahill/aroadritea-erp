# Checkpoint: T-0158 - Expand README step-by-step deployment guide

- **Owner**: Codex
- **Started**: 2026-05-13 23:00 +07:00
- **Last updated**: 2026-05-13 23:07 +07:00
- **Status**: DONE

## Goal

Lengkapi `README.md` dengan panduan step-by-step yang mudah diikuti untuk development, konfigurasi, deployment VPS HestiaCP, update, rollback, dan QA.

## Done

- README diubah dari ringkasan singkat menjadi panduan operasional lengkap.
- Menambahkan step local development dari clone sampai `pnpm dev`.
- Menambahkan tabel konfigurasi DB/UI agar non-secret tidak perlu edit source.
- Menambahkan verifikasi sebelum deploy.
- Menambahkan deployment HestiaCP langkah demi langkah: persiapan VPS, swap, clone, `.env`, migration, PM2 runtime, proxy domain, firewall.
- Menambahkan health check, setup awal setelah login, update production, rollback, troubleshooting, dan catatan production.

## Verification

- `pnpm exec biome check README.md`: tidak berlaku karena Biome tidak memproses Markdown.
- `git diff --check -- README.md TASK.md docs/checkpoints/T-0158-readme-step-by-step-guide.checkpoint.md`: PASS.

## Next step

None. Completed in commit `15c3fd0` and later PM2 deployment docs updates.
