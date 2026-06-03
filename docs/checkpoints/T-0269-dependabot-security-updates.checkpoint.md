# Checkpoint: T-0269 - Dependabot security updates

- **Owner**: Codex
- **Started**: 2026-06-03 12:46 WIB
- **Last updated**: 2026-06-03 12:46 WIB
- **Status**: DONE

## Goal
Resolve all current Dependabot security warnings reported for the repository dependency graph.

## Findings
- `pnpm audit --prod` and `pnpm audit` initially reported:
  - Critical: `vitest <4.1.0`, advisory `GHSA-5xrq-8626-4rwp`.
  - High: `tmp <0.2.6`, advisory `GHSA-ph9p-34f9-6g65`, via `exceljs`.

## Actions
- Updated direct workspace Vitest dev dependencies:
  - `packages/shared/package.json`: `vitest` to `^4.1.0`.
  - `packages/services/package.json`: `vitest` to `^4.1.0`.
- Added root pnpm override:
  - `tmp` to `^0.2.6`, resolved in lockfile to `0.2.7`.
- Regenerated `pnpm-lock.yaml`.

## Verification
- `pnpm audit --prod` PASS: no known vulnerabilities.
- `pnpm audit` PASS: no known vulnerabilities.
- `pnpm typecheck` PASS.
- `pnpm --filter @erp/shared test` PASS: 85/85.
- `pnpm --filter @erp/services exec vitest run tests/accounting-close-period.test.ts tests/payroll-approve.test.ts tests/pos.test.ts tests/inventory-adjust-transfer.test.ts tests/purchasing-grn.test.ts` PASS: 210/210.
- `git diff --check` PASS.

## Next step
After push, GitHub Dependabot should re-evaluate the default branch and close the alerts.
