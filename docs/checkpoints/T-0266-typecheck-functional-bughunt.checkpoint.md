# Checkpoint: T-0266 - Typecheck remediation + functional bug hunt sweep

- **Owner**: Codex
- **Started**: 2026-06-02 11:21 WIB
- **Last updated**: 2026-06-02 21:24 WIB
- **Status**: IN_PROGRESS

## Goal
1. Fix current `pnpm --filter @erp/web typecheck` failures and push to GitHub.
2. Run parallel functional bug-hunt across modules, patch validated defects, verify, commit, and push.

Spec references: AGENTS.md, SOURCE-OF-TRUTH.md, SYSTEM-DESIGN.md.

## Plan
1. [x] Fix typecheck errors in fixed assets and POS sale flow.
2. [x] Run `pnpm --filter @erp/web typecheck`.
3. [x] Collect subagent findings from Accounting/Tax/Reporting, POS/Inventory/Kitchen, HR/Payroll/IAM, CMS/Site/MCP/Worker.
4. [~] Patch validated functional bugs with scoped changes.
5. [x] Run focused tests/build/typecheck for hotfixes.
6. [x] Commit and push latest hotfix to GitHub.

## Done so far
- Spawned 4 explorer subagents with disjoint module scopes.
- Confirmed current typecheck failures:
  - `fixed-assets.ts` uses unsupported audit action `dispose`.
  - `pos/create-sale.ts` references `partners` without importing it.
- Subsequent commits by parallel agents landed and were already present locally:
  - `6ac3f9e` fixed `/hr/attendance` `sql.join` crash by using Drizzle `and(...)`.
  - `de032a3` fixed `/hr/attendance` date filters to use WIB end-exclusive ranges.
  - `7001511`, `79da2cd`, `05bbb0e` addressed check-in/checkout and related HR attendance issues.
- Investigated production `/hr/attendance` crash at 2026-06-02 20:51 WIB:
  - Prod source was already on merge commit `53eaba4`, but runtime still crashed in Drizzle `orderSelectedFields`.
  - One-off prod diagnostic showed `users.name` is undefined in the schema object; the attendance page selected `{ id, name, displayName }` for late-forgiveness users.
  - Patched `apps/web/app/(dash)/hr/attendance/page.tsx` to select only `users.id` and `users.displayName`.
- Committed and pushed hotfix: `f5919ac fix(hr): avoid invalid user field in attendance page`.
- Deployed production hotfix:
  - Cherry-picked code fix to prod `master` as `657b778`, then built `@erp/web` successfully.
  - Restarted `aroadri-web`; app ready at 2026-06-02 21:20:51 WIB.
  - Pushed equivalent hotfix to GitHub `master` as `00f6b7f`.
  - Aligned prod HEAD to `origin/master` after verifying both trees were identical.
  - Verified unauthenticated `/hr/attendance` request returns 307 to login and no new `Object.entries` error appeared in PM2 logs after restart.
- Subagent findings collected without 10-item cap:
  - Attendance/GPS/schedule: stale/lintas-lokasi shift assignment, split GPS config source, unstable browser GPS, missing tenant filter, missing check-in location audit, etc.
  - Full-codebase sweep: access-control gaps, MCP/worker bugs, POS/offline/KDS issues, inventory/purchasing transaction bugs, payroll/accounting risks, i18n missing keys.

## Decisions
- Latest user priority overrides the broad sweep: production `/hr/attendance` crash was fixed first.
- Root cause for `/hr/attendance`: selecting a non-existent schema property (`users.name`) creates an undefined selected field; Drizzle then crashes during query preparation with `Object.entries(undefined)`.

## Open issues
- Broad bug-hunt remediation remains incomplete; subagent findings are recorded above and should be triaged into separate scoped fixes.
- Prod still has pre-existing dirty/untracked operational files unrelated to this hotfix (migration scratch scripts/backups). Left untouched.

## Next step
Continue broad bug-hunt remediation from subagent findings. Prioritize access-control gaps and transaction/inventory bugs; keep fixes scoped and verify each module.

## Test status
- `pnpm --filter @erp/web typecheck` PASS after `/hr/attendance` hotfix.
- Production `pnpm --filter @erp/web build` PASS.
- `pm2 restart aroadri-web --update-env` PASS.
