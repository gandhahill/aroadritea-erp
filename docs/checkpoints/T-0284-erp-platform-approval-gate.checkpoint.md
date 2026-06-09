# Checkpoint: T-0284 - ERP platform approval-gate foundation

- **Owner:** Codex
- **Started:** 2026-06-09 21:31 WIB
- **Last updated:** 2026-06-09 21:45 WIB
- **Status:** IN_PROGRESS

## Goal

Implement the P0 approval-gate foundation from `docs/audit/erp-feature-completeness-2026-06-09.md`, so sensitive ERP state transitions can be workflow-gated by configuration instead of being hardcoded per module. This moves the ERP closer to Odoo-like flexibility while keeping FnB-specific workflows.

## Design Intent

- Modules call one service before sensitive transitions.
- If no workflow definition matches, transition may continue immediately.
- If a workflow definition matches, the gate creates a workflow instance and returns `pending_approval`.
- The caller can store the workflow instance ID and stop the transition until approval.
- The gate must return `Result<T, AppError>` and keep business logic in `packages/services`.

## Plan

1. [x] Register task and checkpoint.
2. [x] Inspect existing workflow service exports and test patterns.
3. [x] Add approval-gate service and tests.
4. [x] Export the service.
5. [x] Run focused validation, commit, push.

## Changes

- Added `runApprovalGate()` to `packages/services/src/workflow/index.ts`.
- The gate returns a standard decision:
  - `approved` when no workflow rule matches.
  - `pending_approval` when a workflow rule matches and a workflow instance is created.
  - `pending_approval` with `reusedExisting=true` when a pending workflow already exists for the entity.
- Gate data injects `entityType`, `entityId`, and `transition` into workflow condition evaluation so admins can configure transition-specific rules.
- Added audit trail entries for workflow instance creation, approval, rejection, and cancellation.
- Added workflow entity types to known audit entities.
- Added focused unit tests for no-workflow, matched workflow, duplicate-pending reuse, validation failure, and error propagation.

## Verification

- `pnpm --filter @erp/services exec vitest run tests/workflow-approval-gate.test.ts`: PASS, 5 tests
- `pnpm --filter @erp/services typecheck`: PASS
- `node .\node_modules\@biomejs\biome\bin\biome lint --max-diagnostics=100 packages/services/src/workflow/index.ts packages/services/src/audit/index.ts packages/services/tests/workflow-approval-gate.test.ts`: PASS with 2 existing style warnings about removable `else` branches in workflow service.

## Next step

Commit and push this foundation. Next P0 step should wire `runApprovalGate()` into one or more sensitive transitions, starting with purchase-order submit/approve, stock adjustment posting, journal posting, payroll approval, and POS refund/discount approval.
