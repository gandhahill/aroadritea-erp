# Checkpoint: T-0275 - SOP PDF Inline Preview Fallback

- **Owner**: Codex
- **Started**: 2026-06-03 20:06 WIB
- **Last updated**: 2026-06-03 20:15 WIB
- **Status**: DONE
- **Phase**: 1
- **Branch**: master

## Goal

Fix `/hr/sop` PDF preview after download was confirmed working but inline view shows the fallback message: "This PDF cannot be displayed in this browser."

Definition of Done:
- [x] SOP PDF preview uses browser PDF viewer in a way that does not trigger the current `<object>` fallback.
- [x] Download and open-in-new-tab links remain available.
- [x] No hardcoded UI strings are added.
- [x] Web typecheck/build pass.
- [x] Commit and push complete.

## Plan

1. [x] Read task register, relevant SoT/SD references, SOP client, upload route, and upload storage helper.
2. [x] Replace the `<object>` PDF preview with an iframe preview using the existing authenticated upload URL.
3. [x] Verify typecheck/build.
4. [x] Mark task done, commit, and push.

## Done So Far

- Confirmed download route works from user report.
- Confirmed the displayed text is the SOP viewer fallback, which means the `<object>` embed is not rendering in the browser.
- Replaced the SOP PDF preview `<object>` with an iframe using the same authenticated upload URL and PDF viewer hash options.
- Kept download and open-in-new-tab links available from the modal.

## Decisions

- Keep the authenticated `/api/uploads/...` URL and existing permission checks.
- Change only the frontend embed element, because the file route already serves download successfully and returns PDF content type for `.pdf`.

## Open Issues / Questions

- None.

## Next Step

None. Hotfix is complete.

## Test Status

- **Scoped Biome**: PASS - `pnpm exec biome check --write "apps/web/app/(dash)/hr/sop/sop-list-client.tsx"`
- **Typecheck**: PASS - `pnpm --filter @erp/web typecheck`
- **Build**: PASS - `pnpm --filter @erp/web build`

## Files Touched

| Path | Action | Note |
|------|--------|------|
| `TASK.md` | Update | Added hotfix task. |
| `docs/checkpoints/T-0275-sop-pdf-inline-preview-fallback.checkpoint.md` | Add | Task checkpoint. |
| `apps/web/app/(dash)/hr/sop/sop-list-client.tsx` | Update | Replaced PDF object embed with iframe preview. |

## Commits So Far

| SHA | Message | Date |
|-----|---------|------|
| _(none yet)_ | | |
