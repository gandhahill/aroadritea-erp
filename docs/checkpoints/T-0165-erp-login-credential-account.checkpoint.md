# Checkpoint: T-0165 — ERP Login Credential Account Integration

- **Owner**: Codex
- **Started**: 2026-05-15 09:19
- **Last updated**: 2026-05-15 09:25
- **Status**: 🟨 IN_PROGRESS

## Goal
Fix production ERP login where `admin@aroadritea.com` exists and password reset succeeds, but `better-auth` returns "Email atau kata sandi salah".

## Finding
`better-auth` email/password sign-in looks for a credential account with `providerId="credential"` and password on the `account` model. Current ERP schema only maps `users` and `sessions`, and the bootstrap reset only updates `users.password_hash`. Therefore the user exists but has no credential account for `better-auth` to verify.

## Plan
1. [x] Add auth credential account table/schema and include it in better-auth adapter mapping.
2. [x] Update bootstrap seed/admin reset to create/update the credential account.
3. [x] Generate migration, typecheck/build.
4. [ ] Commit, push, deploy migration/build/PM2 reload.
5. [ ] Reset admin password and verify login endpoint.

## Next step
Commit, push, deploy migration/build to VPS, reset admin credential account, then verify login endpoint.

## Test status
- `pnpm --filter @erp/db generate` OK, created `0004_amazing_lifeguard.sql`.
- `pnpm --filter @erp/db typecheck` OK.
- `pnpm --filter @erp/services typecheck` OK.
- `pnpm --filter @erp/web typecheck` OK.
- `pnpm --filter @erp/web build` OK.
