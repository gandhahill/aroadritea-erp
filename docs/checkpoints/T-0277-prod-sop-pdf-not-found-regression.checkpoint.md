# Checkpoint: T-0277 - Production SOP PDF Not Found Regression

- **Owner**: Codex
- **Started**: 2026-06-03 20:53 WIB
- **Last updated**: 2026-06-03 20:53 WIB
- **Status**: IN_PROGRESS
- **Phase**: 1
- **Branch**: master

## Goal

Investigate and fix production `/hr/sop` PDF preview returning `Not Found` after the same-origin preview header hotfix.

Definition of Done:
- [ ] Production app deploy state and commit are known.
- [ ] Actual `/api/uploads/...` response and headers are verified from VPS.
- [ ] Root cause is identified: deploy state, upload key normalization, storage path, permission/session, or proxy routing.
- [ ] Fix is applied locally and/or on production as appropriate.
- [ ] Web typecheck/build pass if code changes are made.
- [ ] Commit and push complete if code changes are made.

## Plan

1. [x] Read active task register and relevant SOP/upload/security references.
2. [ ] SSH into VPS and inspect current commit, PM2 status, env upload root, SOP rows, and upload files.
3. [ ] Reproduce `/api/uploads/...` response on localhost/proxy with curl and headers.
4. [ ] Patch code or prod config based on root cause.
5. [ ] Verify, commit/push/deploy as needed.

## Done So Far

- User reported download worked, then iframe preview was blocked, and after header patch preview now returns Not Found again.
- Local repo is clean on `master`.

## Decisions

- Prefer diagnosing production state before changing code again.
- Keep same-origin-only framing; do not relax ERP pages for external embedding.

## Open Issues / Questions

- Need confirm whether production has pulled/rebuilt commit `c8eec80`.

## Next Step

Run SSH diagnostics against `/home/aroadritea/web/aroadritea.com/public_html/aroadritea-erp`: git status/commit, PM2 status, env, DB SOP file keys, upload storage contents, and curl headers for one SOP file URL.

## Test Status

- **Production SSH diagnostics**: not run yet
- **Typecheck**: not run yet
- **Build**: not run yet

## Files Touched

| Path | Action | Note |
|------|--------|------|
| `TASK.md` | Update | Added production regression task. |
| `docs/checkpoints/T-0277-prod-sop-pdf-not-found-regression.checkpoint.md` | Add | Investigation checkpoint. |

## Commits So Far

| SHA | Message | Date |
|-----|---------|------|
| _(none yet)_ | | |
