# Checkpoint: T-0266 - Typecheck remediation + functional bug hunt sweep

- **Owner**: Codex
- **Started**: 2026-06-02 11:21 WIB
- **Last updated**: 2026-06-02 22:26 WIB
- **Status**: IN_PROGRESS

## Goal
1. Fix current `pnpm --filter @erp/web typecheck` failures and push to GitHub.
2. Run parallel functional bug-hunt across modules, patch validated defects, verify, commit, and push.
3. Add attendance face verification with inline first-check-in enrollment on `/hr/checkin` (no separate enrollment page).

Spec references: AGENTS.md, SOURCE-OF-TRUTH.md, SYSTEM-DESIGN.md.

## Plan
1. [x] Fix typecheck errors in fixed assets and POS sale flow.
2. [x] Run `pnpm --filter @erp/web typecheck`.
3. [x] Collect subagent findings from Accounting/Tax/Reporting, POS/Inventory/Kitchen, HR/Payroll/IAM, CMS/Site/MCP/Worker.
4. [~] Patch validated functional bugs with scoped changes.
5. [~] Implement inline attendance face verification enrollment.
6. [x] Run focused tests/build/typecheck for hotfixes.
7. [x] Commit and push latest hotfix to GitHub.

## Done so far
- Resumed scoped remediation for inventory/purchasing service correctness findings. Current scope excludes HR attendance/face verification files.
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
- Started scoped access-control/data-scope remediation for:
  - GRN report permission result handling and location scope.
  - HR whistleblower, attendance, and disciplinary pages.
  - Reporting BI tenant/location data scope.
  - Inventory stock page scope and export surface.
  - PO detail / GRN receive permission gates.
  - Purchase return GRN lookup permission leak.
- Started parallel POS/offline/KDS remediation for:
  - Cup-label QR payload source (`sales_order_lines.kds_qr_token` instead of order number).
  - Offline sync retry semantics and RPO 0 acceptance for old outbox rows.
  - Loud failures for missing ingredient stock / UOM mismatch during sale/refund stock movement.
  - Refund ledger rows and partial-refund order status.
- New user request at 2026-06-02 21:48 WIB:
  - Patch all previously reported subagent bug findings.
  - Add face verification to attendance.
  - Face enrollment must happen inside the check-in page when an employee has no face template yet; first check-in after rollout should prompt enrollment and then continue the same presensi flow.
- Spawned parallel workers for disjoint bug-fix scopes:
  - Access-control/data-scope web pages and actions.
  - MCP/worker service bugs.
  - POS/offline/KDS correctness.
  - Inventory/purchasing service correctness.
  - Payroll/accounting correctness.
- Updated source-of-truth docs for face verification:
  - `SOURCE-OF-TRUTH.md` §12.4.
  - `SYSTEM-DESIGN.md` §9.6, §21.8, §25.2.1.
  - ADR-0013 `docs/adr/0013-attendance-face-verification.md`.

- Completed scoped access-control/data-scope patch:
  - `purchasing/grn-report/page.tsx` now fails closed using location-aware `purchasing.view` scope before rendering.
  - `hr/whistleblower/page.tsx` now checks `hr.whistleblower.read` location scope and filters report queries/counts by authorized locations; unscoped legacy reports remain global-only.
  - `reporting/business-intelligence/page.tsx` now checks `reporting.view`, limits active store list to authorized locations, and filters all POS/manual-sales raw BI queries by `location_id`.
  - `hr/attendance/page.tsx` now checks `hr.attendance.read` and filters attendance rows plus employee dropdown/name lookups by authorized locations.
  - `hr/disciplinary/page.tsx` now checks `hr.disciplinary.read`, filters disciplinary rows/employees by authorized locations, and resolves only issuer users referenced by scoped rows.
  - `inventory/stock/page.tsx` now checks `inventory.view`, limits outlet/warehouse columns to authorized locations, and filters stock totals/export to those locations.
  - `purchasing/po/[id]/page.tsx` now 404s when the user lacks `purchasing.view` for the PO location and only renders the GRN form when `purchasing.grn.create` is granted at that location.
  - `purchasing/actions.ts` `receiveGoodsAction` now derives `locationId` from the PO and rejects forged form `locationId`.
  - `purchasing/returns/actions.ts` `fetchGrnForReturnAction` now requires both `purchasing.view` and `purchasing.return.create` at the GRN location before returning lines/unit cost.
- Completed scoped inventory/purchasing service correctness patch:
  - `stock-depletion-service.ts` now plans FEFO depletion first, rejects shortage before mutating, and performs stock-level updates plus movements in one transaction with per-row qty guards.
  - `production-service.ts` now runs raw-material depletion, finished-good stock update, movement insert, COGM journal creation, batch insert, and audit in one transaction; mock costs and fake account IDs were removed.
  - `transfer-service.ts` now handles create/ship/receive/cancel in transactions, uses null-safe variant matching plus batch/expiry identity, enforces source qty guards on ship, rejects receive qty greater than sent, and audits via `auditRecord`.
  - `grn-service.ts` now uses the transaction client inside `confirmGRN`, guards PO line received qty against remaining ordered qty, updates stock levels by variant/batch/expiry, and fails on PO version conflicts.
  - Added `production` to accounting journal reference types and added audit support for `ship`, `stock_transfer`, and `production_batch`.

## Decisions
- Latest user priority overrides the broad sweep: production `/hr/attendance` crash was fixed first.
- Root cause for `/hr/attendance`: selecting a non-existent schema property (`users.name`) creates an undefined selected field; Drizzle then crashes during query preparation with `Object.entries(undefined)`.
- Face verification decision: use inline enrollment on `/hr/checkin`; store encrypted template/verifier only, not raw face photos; audit enrollment and store per-attendance verification result in existing attendance face columns.

## Open issues
- Broad bug-hunt remediation remains incomplete; subagent findings are recorded above and should be triaged into separate scoped fixes.
- Prod still has pre-existing dirty/untracked operational files unrelated to this hotfix (migration scratch scripts/backups). Left untouched.

## Next step
Continue integrating parallel worker patches. For this inventory/purchasing slice, remaining verification blocker is unrelated POS typecheck debt in `packages/services/src/pos/create-sale.ts` and `packages/services/src/pos/manual-sales.ts`.

## Test status
- `pnpm --filter @erp/web typecheck` PASS after `/hr/attendance` hotfix.
- Production `pnpm --filter @erp/web build` PASS.
- `pm2 restart aroadri-web --update-env` PASS.
- Access-control scoped diff check: `git diff --check -- <access-control files>` PASS.
- Inventory/purchasing targeted tests PASS: `pnpm --filter @erp/services exec vitest run tests/purchasing-grn.test.ts tests/inventory-adjust-transfer.test.ts` = 95/95.
- `pnpm --filter @erp/services typecheck -- --pretty false` FAILS only on POS files outside this scope after inventory/purchasing fixes:
  - `packages/services/src/pos/create-sale.ts` possible undefined `p`.
  - `packages/services/src/pos/manual-sales.ts` missing `stockLocationId` in ingredient deductions.
- Full `pnpm --filter @erp/services exec vitest run` still FAILS on pre-existing/non-scope accounting/payroll/reporting/PII/create-PO mock expectations; targeted GRN/transfer tests pass.
- Current full `pnpm --filter @erp/web exec tsc --noEmit --pretty false` FAILS on parallel worker changes outside this scope:
  - `apps/web/app/(dash)/hr/checkin/check-in-client.tsx` missing new required `enrollFace`.
  - `apps/web/app/(dash)/hr/checkin/page.tsx` passes `faceVerification` prop not yet declared in client props.
  - `packages/services/src/pos/create-sale.ts` possible undefined `p`.
  - `packages/services/src/pos/manual-sales.ts` missing `stockLocationId` in ingredient deductions.
