# Checkpoint: T-0274 - SOP Links And Consumed History Hotfix

- **Owner**: Codex
- **Started**: 2026-06-03 18:11 WIB
- **Last updated**: 2026-06-03 18:39 WIB
- **Status**: DONE
- **Phase**: 1
- **Branch**: master

## Goal

Fix two follow-up issues:
- SOP `Lihat PDF` and `Unduh` links must resolve existing uploaded files instead of showing `Not Found`.
- Consumed ingredient history must combine created/edited users in one column like manual closing history, and show qty/UOM details in the table.

Definition of Done:
- [x] SOP upload link generation handles raw keys and existing `/api/uploads/...` URLs.
- [x] Upload route tolerates accidental duplicated `/api/uploads` key segments.
- [x] Consumed ingredient history shows item qty + UOM in the table.
- [x] Consumed ingredient history shows editor as subtext under `Dibuat oleh`, not a separate column.
- [x] i18n keys are present in ID/EN/ZH.
- [x] Web typecheck/build pass.
- [x] Commit and push complete.

## Plan

1. [x] Read active task register, upload storage, SOP client, consumed history client/action, and relevant SoT/SD snippets.
2. [x] Normalize SOP upload hrefs and route key parts.
3. [x] Add consumed item summaries with qty/UOM to history query and table.
4. [x] Merge editor display into created-by column.
5. [x] Update i18n, verify, commit, and push.

## Done So Far

- Read current implementation and identified likely duplicate `/api/uploads` path handling issue.
- Normalized SOP upload href generation for raw keys, absolute URLs, existing `/api/uploads/...`, and accidental `storage/uploads/...` prefixes.
- Normalized upload API route key parts before reading from storage, so duplicated upload prefixes no longer resolve to missing files.
- Added consumed ingredient history item summaries with qty and UOM from stock movement rows.
- Removed the separate edited-by column and rendered editor metadata as subtext under the created-by column.
- Updated ID/EN/ZH i18n keys for consumed history summaries.

## Decisions

- Keep SOP files permission-gated through `/api/uploads`; normalize links in the client and tolerate duplicate prefixes in the route.
- Show up to three consumed ingredient lines in the history table and summarize the rest to keep the row scannable.

## Open Issues / Questions

- None.

## Next Step

None. Hotfix is complete.

## Test Status

- **Typecheck**: PASS - `pnpm --filter @erp/web typecheck`
- **Build**: PASS - `pnpm --filter @erp/web build`

## Files Touched

| Path | Action | Note |
|------|--------|------|
| `TASK.md` | Update | Added hotfix task. |
| `docs/checkpoints/T-0274-sop-links-consumed-history-hotfix.checkpoint.md` | Add | Task checkpoint. |
| `apps/web/app/(dash)/hr/sop/sop-list-client.tsx` | Update | Normalize SOP file hrefs before preview/download. |
| `apps/web/app/api/uploads/[...key]/route.ts` | Update | Normalize upload route key parts before storage read. |
| `apps/web/app/(dash)/pos/manual-sales/consumed/actions.ts` | Update | Include consumed item qty/UOM history details. |
| `apps/web/app/(dash)/pos/manual-sales/consumed/client.tsx` | Update | Merge edited-by display into created-by column and show UOM detail lines. |
| `apps/web/messages/id.json` | Update | Added consumed history summary keys. |
| `apps/web/messages/en.json` | Update | Added consumed history summary keys. |
| `apps/web/messages/zh.json` | Update | Added consumed history summary keys. |

## Commits So Far

| SHA | Message | Date |
|-----|---------|------|
| _(none yet)_ | | |
