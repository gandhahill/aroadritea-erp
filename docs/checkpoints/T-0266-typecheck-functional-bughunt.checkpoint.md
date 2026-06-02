# Checkpoint: T-0266 - Typecheck remediation + functional bug hunt sweep

- **Owner**: Codex
- **Started**: 2026-06-02 11:21 WIB
- **Last updated**: 2026-06-02 11:21 WIB
- **Status**: IN_PROGRESS

## Goal
1. Fix current `pnpm --filter @erp/web typecheck` failures and push to GitHub.
2. Run parallel functional bug-hunt across modules, patch validated defects, verify, commit, and push.

Spec references: AGENTS.md, SOURCE-OF-TRUTH.md, SYSTEM-DESIGN.md.

## Plan
1. [ ] Fix typecheck errors in fixed assets and POS sale flow.
2. [ ] Run `pnpm --filter @erp/web typecheck`.
3. [ ] Collect subagent findings from Accounting/Tax/Reporting, POS/Inventory/Kitchen, HR/Payroll/IAM, CMS/Site/MCP/Worker.
4. [ ] Patch validated functional bugs with scoped changes.
5. [ ] Run focused tests/build/typecheck.
6. [ ] Commit and push to GitHub.

## Done so far
- Spawned 4 explorer subagents with disjoint module scopes.
- Confirmed current typecheck failures:
  - `fixed-assets.ts` uses unsupported audit action `dispose`.
  - `pos/create-sale.ts` references `partners` without importing it.

## Decisions
- Critical path stays local: fix typecheck first while subagents scan in parallel.

## Open issues
- Awaiting subagent bug-hunt findings.

## Next step
Patch `packages/services/src/accounting/fixed-assets.ts` audit action and import `partners` in `packages/services/src/pos/create-sale.ts`, then rerun `pnpm --filter @erp/web typecheck`.

## Test status
- Pending.
