# Deployment Verification

**Date:** 2026-05-22
**Task:** T-0168
**Remote head:** `2f00ce4`

## Deployment Steps

| Step | Status | Notes |
|---|---|---|
| `git pull --ff-only` on VPS | PASS | Updated production checkout from `42ed262` to `2f00ce4`. |
| `pnpm install --frozen-lockfile` | PASS | Lockfile up to date. |
| `pnpm db:migrate` with dotenv-loaded environment | PASS | Migration `0022_correspondence_records` applied successfully. |
| `pnpm db:seed` with dotenv-loaded environment | PASS | Seed completed; menu, permissions, stock seed, POS settings, and Naixer settings refreshed idempotently. |
| `pnpm build` on VPS | PASS | Worker, MCP, site, and web builds completed. |
| `pnpm pm2:reload && pm2 save` | PASS | `aroadri-mcp`, `aroadri-worker`, `aroadri-site`, and `aroadri-web` reloaded and saved. |
| Local health checks on VPS | PASS | Site, web, and MCP health endpoints returned `status: ok`; web DB check returned `ok`. |
| `pm2 status --no-color` | PASS | All four PM2 processes are online. |

## Security Note

During verification, `pm2 jlist` was found to print process environment variables, including production secrets. The values are not recorded in this document, but they did appear in terminal output during the deployment session.

Required operator action:

1. Rotate production credentials after this audit window: database password/URL, Better Auth secret, Turnstile secret, SMTP password, BinderByte key, PII encryption key, and bootstrap admin password if still active.
2. Avoid using `pm2 jlist` for routine status checks. Use `pm2 status --no-color` or health endpoints instead.
3. Consider moving runtime secrets to a restricted environment injection mechanism that is not dumped by routine process inspection commands.

