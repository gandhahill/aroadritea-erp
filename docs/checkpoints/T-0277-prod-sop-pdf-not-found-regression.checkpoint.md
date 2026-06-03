# Checkpoint: T-0277 - Production SOP PDF Not Found Regression

- **Owner**: Codex
- **Started**: 2026-06-03 20:53 WIB
- **Last updated**: 2026-06-03 21:19 WIB
- **Status**: DONE
- **Phase**: 1
- **Branch**: master

## Goal

Investigate and fix production `/hr/sop` PDF preview returning `Not Found` after the same-origin preview header hotfix.

Definition of Done:
- [x] Production app deploy state and commit are known.
- [x] Actual `/api/uploads/...` response and headers are verified from VPS.
- [x] Root cause is identified: deploy state, upload key normalization, storage path, permission/session, or proxy routing.
- [x] Fix is applied locally and/or on production as appropriate.
- [x] Web typecheck/build pass if code changes are made.
- [x] Commit and push complete if code changes are made.

## Plan

1. [x] Read active task register and relevant SOP/upload/security references.
2. [x] SSH into VPS and inspect current commit, PM2 status, env upload root, SOP rows, and upload files.
3. [x] Reproduce `/api/uploads/...` response on localhost/proxy with curl and headers.
4. [x] Patch code or prod config based on root cause.
5. [x] Verify, commit/push/deploy as needed.

## Done So Far

- User reported download worked, then iframe preview was blocked, and after header patch preview now returns Not Found again.
- Local repo is clean on `master`.
- Production was on `c8eec80` at the start and had the SOP DB row:
  - `file_key`: `private/sop/1780491729873-cca58ae6-51b5-4317-8fdb-3ef756c1b456.pdf`
  - `file_size`: `269593`
- No physical SOP upload file existed under the production upload storage paths.
- PM2 web cwd was `.next/standalone/apps/web`; `UPLOAD_STORAGE_DIR=storage/uploads` from `.env` therefore pointed to a volatile build directory.
- Patched upload-root resolution so relative upload dirs resolve against repo root via `ERP_REPO_ROOT` or repo markers.
- Patched PM2 ecosystem to expose `ERP_REPO_ROOT` and convert `UPLOAD_STORAGE_DIR` to an absolute path.
- Deployed `9afb5a7` to production, rebuilt web, and reloaded PM2 with updated env.
- Restored local `D:\KERJA\Aroadri Tea\SOP\SOP TI.pdf` to production persistent storage with the DB file key.
- Verified internal and public `/api/uploads/...` no longer returns 404; with dummy cookie it returns 401, meaning the file exists and only auth is missing.

## Decisions

- Prefer diagnosing production state before changing code again.
- Keep same-origin-only framing; do not relax ERP pages for external embedding.
- Preserve the existing SOP DB row and restore the matching PDF file instead of changing the row key.

## Open Issues / Questions

- None.

## Next Step

None. Hotfix is complete.

## Test Status

- **Production SSH diagnostics**: PASS - root cause identified and file restored.
- **Scoped Biome**: PASS - `pnpm exec biome check --write apps/web/lib/upload-storage.ts packages/services/src/ai/tools/ocr-receipt.ts ecosystem.config.cjs`
- **Web typecheck**: PASS - `pnpm --filter @erp/web typecheck`
- **Services typecheck**: PASS - `pnpm --filter @erp/services typecheck`
- **Web build local**: PASS - `pnpm --filter @erp/web build`
- **Web build production**: PASS - `pnpm --filter @erp/web build`
- **Production upload route**: PASS - public URL returns `401` with dummy cookie, not `404`; headers include `Content-Security-Policy: frame-ancestors 'self'` and `X-Frame-Options: SAMEORIGIN`.

## Files Touched

| Path | Action | Note |
|------|--------|------|
| `TASK.md` | Update | Added production regression task. |
| `docs/checkpoints/T-0277-prod-sop-pdf-not-found-regression.checkpoint.md` | Add | Investigation checkpoint. |
| `apps/web/lib/upload-storage.ts` | Update | Resolve relative upload storage from repo root instead of process cwd. |
| `packages/services/src/ai/tools/ocr-receipt.ts` | Update | Resolve relative upload storage from repo root for OCR attachment reads. |
| `ecosystem.config.cjs` | Update | Export `ERP_REPO_ROOT` and pass absolute upload storage path to web. |

## Commits So Far

| SHA | Message | Date |
|-----|---------|------|
| _(none yet)_ | | |
