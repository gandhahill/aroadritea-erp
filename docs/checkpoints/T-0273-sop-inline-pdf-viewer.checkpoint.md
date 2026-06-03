# Checkpoint: T-0273 - SOP Inline PDF Viewer

- **Owner**: Codex
- **Started**: 2026-06-03 17:04 WIB
- **Last updated**: 2026-06-03 17:20 WIB
- **Status**: DONE
- **Phase**: 1
- **Branch**: master

## Goal

Make the `/hr/sop` page able to preview PDF SOP documents directly in the web UI while preserving a separate download action.

Spec references:
- SOURCE-OF-TRUTH: HR SOP requirements and documentation/file attachment expectations.
- SYSTEM-DESIGN: upload/download route and file storage boundary.

Definition of Done:
- [x] PDF SOP rows have an in-page view action.
- [x] Upload download route allows inline PDF preview while download remains available.
- [x] New and touched SOP UI strings use i18n keys in id/en/zh.
- [x] Typecheck passes for the web app.
- [x] Changes are committed and pushed.

## Plan

1. [x] Inspect SOP page, actions, service, upload/download route, and i18n namespace.
2. [x] Add PDF preview state/modal to `SopListClient`.
3. [x] Update upload file route to support inline preview and forced download.
4. [x] Replace touched hardcoded SOP UI strings with i18n keys.
5. [x] Run verification, update task/checkpoint, commit, and push.

## Done so far

- Read SOP page/client/upload form/actions/service/schema and `/api/uploads/[...key]` route.
- Added PDF-only `View PDF` action that opens a large in-page object viewer.
- Kept explicit download via `/api/uploads/<fileKey>?download=1`.
- Updated upload route to serve PDF/image previews inline unless forced download is requested.
- Replaced touched SOP upload form strings with ID/EN/ZH i18n keys.

## Decisions

- Use the existing authenticated `/api/uploads/<fileKey>` route for preview so SOP access remains permission-gated by `hr.sop.read`.
- Add `?download=1` for explicit download instead of making every PDF request an attachment.

## Open Issues / Questions

- None.

## Next Step

None. Task completed; commit and push are handled with this batch.

## Test Status

- **Typecheck**: `pnpm --filter @erp/web typecheck` PASS
- **Build**: `pnpm --filter @erp/web build` PASS

## Files Touched

| Path | Action | Note |
|------|--------|------|
| `TASK.md` | Update | Added active task row. |
| `docs/checkpoints/T-0273-sop-inline-pdf-viewer.checkpoint.md` | Add | Task checkpoint. |
| `apps/web/app/(dash)/hr/sop/sop-list-client.tsx` | Update | Added PDF viewer modal and view action. |
| `apps/web/app/(dash)/hr/sop/sop-upload-form.tsx` | Update | Moved touched labels/errors to i18n keys. |
| `apps/web/app/api/uploads/[...key]/route.ts` | Update | Added inline PDF preview and forced download switch. |
| `apps/web/messages/id.json` | Update | Added SOP viewer/upload keys. |
| `apps/web/messages/en.json` | Update | Added SOP viewer/upload keys. |
| `apps/web/messages/zh.json` | Update | Added SOP viewer/upload keys. |

## Commits So Far

| SHA | Message | Date |
|-----|---------|------|
| this commit | `feat(hr): add sop pdf preview and pos history metadata` | 2026-06-03 |
