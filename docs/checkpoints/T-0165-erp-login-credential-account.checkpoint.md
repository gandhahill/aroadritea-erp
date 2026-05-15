# Checkpoint: T-0165 — ERP Login Credential Account Integration

- **Owner**: Codex
- **Started**: 2026-05-15 09:19
- **Last updated**: 2026-05-15 10:16
- **Status**: 🟩 DONE

## Goal
Fix production ERP login where `admin@aroadritea.com` exists and password reset succeeds, but `better-auth` returns "Email atau kata sandi salah".

## Finding
`better-auth` email/password sign-in looks for a credential account with `providerId="credential"` and password on the `account` model. Current ERP schema only maps `users` and `sessions`, and the bootstrap reset only updates `users.password_hash`. Therefore the user exists but has no credential account for `better-auth` to verify.

## Plan
1. [x] Add auth credential account table/schema and include it in better-auth adapter mapping.
2. [x] Update bootstrap seed/admin reset to create/update the credential account.
3. [x] Generate migration, typecheck/build.
4. [x] Commit, push, deploy migration/build/PM2 reload.
5. [x] Reset admin password and verify login endpoint.

## Next step
None.

## Test status
- `pnpm --filter @erp/db generate` OK, created `0004_amazing_lifeguard.sql`.
- `pnpm --filter @erp/db typecheck` OK.
- `pnpm --filter @erp/services typecheck` OK.
- `pnpm --filter @erp/web typecheck` OK.
- `pnpm --filter @erp/web build` OK.
- Production VPS deploy OK:
  - `git pull --ff-only`.
  - `pnpm --filter @erp/db migrate`.
  - `pnpm --filter @erp/db seed`.
  - `pnpm --filter @erp/web build`.
  - `pm2 reload aroadri-web --update-env`.
- Production login verification OK:
  - `POST https://erp.aroadritea.com/api/auth/sign-in/email` returned 200 for `admin@aroadritea.com`.
  - `GET https://erp.aroadritea.com/api/auth/get-session` returned a valid staff session.
  - `GET https://erp.aroadritea.com/` redirects authenticated users to `/pos`.
  - `GET https://erp.aroadritea.com/pos` returned 200 with the session cookie.
