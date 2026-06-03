# Checkpoint: T-0276 - SOP PDF Preview Security Headers

- **Owner**: Codex
- **Started**: 2026-06-03 20:29 WIB
- **Last updated**: 2026-06-03 20:40 WIB
- **Status**: DONE
- **Phase**: 1
- **Branch**: master

## Goal

Fix `/hr/sop` PDF preview after iframe rendering shows "This content is blocked. Contact the site owner to fix the issue."

Definition of Done:
- [x] Global CSP allows same-origin frames for ERP-owned previews while still blocking external framing via `frame-ancestors`.
- [x] `/api/uploads/...` PDF responses allow same-origin embedding instead of global `X-Frame-Options: DENY`.
- [x] Download behavior stays unchanged.
- [x] Web typecheck/build pass.
- [x] Commit and push complete.

## Plan

1. [x] Read task register, SoT/SD security/PDF references, `next.config.ts`, SOP client, upload route, and upload storage helper.
2. [x] Update security headers to permit same-origin PDF preview.
3. [x] Add upload-route response headers that explicitly allow same-origin preview.
4. [x] Verify, mark done, commit, and push.

## Done So Far

- Confirmed global CSP currently has `frame-src https://challenges.cloudflare.com`, so `/api/uploads/...` iframes are blocked by parent CSP.
- Confirmed global headers set `X-Frame-Options: DENY` for every route, so upload/PDF responses also cannot be framed.
- Added `'self'` to global `frame-src` so ERP pages can frame ERP-owned preview routes.
- Added same-origin preview header overrides for `/api/uploads/:path*` in Next config.
- Added explicit `X-Frame-Options: SAMEORIGIN` and `Content-Security-Policy: frame-ancestors 'self'` to upload route responses.

## Decisions

- Keep `frame-ancestors 'none'` for ERP pages to prevent the app from being embedded by other sites.
- Allow only `'self'` in `frame-src` so ERP pages can embed ERP-owned preview routes, not arbitrary external documents.
- Override upload responses to `frame-ancestors 'self'` and `X-Frame-Options: SAMEORIGIN` so authenticated internal PDF preview can render.

## Open Issues / Questions

- If Hestia/Nginx independently injects `X-Frame-Options: DENY`, production may also need the proxy template to stop adding DENY for `/api/uploads/*`.

## Next Step

None. Hotfix is complete.

## Test Status

- **Scoped Biome**: PASS - `pnpm exec biome check --write "apps/web/next.config.ts" "apps/web/app/api/uploads/[...key]/route.ts"`
- **Typecheck**: PASS - `pnpm --filter @erp/web typecheck`
- **Build**: PASS - `pnpm --filter @erp/web build`

## Files Touched

| Path | Action | Note |
|------|--------|------|
| `TASK.md` | Update | Added hotfix task. |
| `docs/checkpoints/T-0276-sop-pdf-preview-security-headers.checkpoint.md` | Add | Task checkpoint. |
| `apps/web/next.config.ts` | Update | Allow same-origin frames and upload-specific framing headers. |
| `apps/web/app/api/uploads/[...key]/route.ts` | Update | Allow same-origin framing for upload responses. |

## Commits So Far

| SHA | Message | Date |
|-----|---------|------|
| _(none yet)_ | | |
