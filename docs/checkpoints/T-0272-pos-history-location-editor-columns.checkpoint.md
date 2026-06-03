# Checkpoint: T-0272 - POS History Location And Editor Columns

- **Owner**: Codex
- **Started**: 2026-06-03 16:57 WIB
- **Last updated**: 2026-06-03 17:20 WIB
- **Status**: DONE
- **Phase**: 1
- **Branch**: master

## Goal

Expose existing location and audit metadata in POS manual history tables:
- Manual closing history must show the human-readable location.
- Consumed ingredient history must keep showing location and add the user who last edited the entry.

Spec references:
- SOURCE-OF-TRUTH: POS/manual operational entry and stock movement requirements.
- SYSTEM-DESIGN: POS manual closing and audit/location dimensions.

Definition of Done:
- [x] Manual closing history includes a location column.
- [x] Consumed ingredient history includes location and editor columns.
- [x] All new UI labels use i18n keys in id/en/zh.
- [x] Typecheck passes for the web app.
- [x] Changes are committed and pushed.

## Plan

1. [x] Read task context, SoT/SD snippets, and existing manual sales/consumed ingredient actions.
2. [x] Add location labels to manual closing page data and table.
3. [x] Add updated-by names to consumed ingredient history data and table.
4. [x] Add missing i18n keys in all locales.
5. [x] Run verification, update task/checkpoint, commit, and push.

## Done so far

- Read `TASK.md`, manual sales actions/client, consumed ingredients actions/client, and translation namespace `pos.manualSales`.
- Added `locationLabel` mapping to manual closing page data and export.
- Added location column to the manual closing history table.
- Added `updatedByName` to consumed ingredient history query and table.
- Added `editedByName` translation key in ID/EN/ZH.

## Decisions

- No migration is needed because both tables already store the required `location_id` and audit user references.
- Manual closing can map the existing `locationId` to the page's loaded location options instead of adding another service join.

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
| `docs/checkpoints/T-0272-pos-history-location-editor-columns.checkpoint.md` | Add | Task checkpoint. |
| `apps/web/app/(dash)/pos/manual-sales/actions.ts` | Update | Added location label mapping and export label. |
| `apps/web/app/(dash)/pos/manual-sales/manual-sales-client.tsx` | Update | Added history location column. |
| `apps/web/app/(dash)/pos/manual-sales/consumed/actions.ts` | Update | Added updated-by name query. |
| `apps/web/app/(dash)/pos/manual-sales/consumed/client.tsx` | Update | Added edited-by column. |
| `apps/web/messages/id.json` | Update | Added POS edited-by header key. |
| `apps/web/messages/en.json` | Update | Added POS edited-by header key. |
| `apps/web/messages/zh.json` | Update | Added POS edited-by header key. |

## Commits So Far

| SHA | Message | Date |
|-----|---------|------|
| this commit | `feat(hr): add sop pdf preview and pos history metadata` | 2026-06-03 |
