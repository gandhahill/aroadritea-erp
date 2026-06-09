# Checkpoint: T-0285 - Manual journal posting approval-gate integration

- **Owner:** Codex
- **Started:** 2026-06-09 22:01 WIB
- **Last updated:** 2026-06-09 22:19 WIB
- **Status:** IN_PROGRESS

## Goal

Wire the reusable approval gate into manual journal posting so configurable workflow rules can stop sensitive GL postings before they become immutable. This advances the ERP-wide objective of Odoo-like configurability with FnB-specific controls.

## Context

- SoT requires future approval rules to be configurable without code edits.
- SD says Manual JE can follow draft -> workflow approval -> posted, while automatic JEs from validated source documents can post directly.
- The audit roadmap marks approval-gate integration for journal posting as a P0 platform control.

## Plan

1. [x] Register task and checkpoint.
2. [x] Extend approval gate so an already-approved instance satisfies the gate instead of creating a new pending instance.
3. [x] Call approval gate from manual `postJournal()` only, leaving automatic postings and explicit internal bypasses unaffected.
4. [x] Add focused tests for pending approval, approved approval reuse, and auto JE bypass.
5. [x] Expose `journal_entry_manual` in the workflow editor entity list and condition fields.
6. [x] Run focused validation, commit, and push.

## Changes

- `runApprovalGate()` now recognizes an approved workflow instance for the matching entity/scope/definition and lets the transition continue.
- `postJournal()` now gates manual journal postings through `journal_entry_manual` workflow rules before immutable posting.
- Pending manual journal approval returns `workflow.approvalGate.pending` with workflow instance details and does not fetch lines or post the journal.
- Automatic journal postings and explicit internal bypasses continue without the gate.
- Workflow editor now offers `journal_entry_manual` and condition fields for debit, credit, posting date, location, period, and transition.
- Accounting journal server action translates pending approval into user-facing EN/ID/ZH copy instead of surfacing the technical message key.

## Verification

- `pnpm --filter @erp/services exec vitest run tests/workflow-approval-gate.test.ts tests/accounting-post-journal.test.ts`: PASS, 26 tests
- `pnpm --filter @erp/services typecheck`: PASS
- `node .\node_modules\@biomejs\biome\bin\biome lint --max-diagnostics=80 packages/services/src/workflow/index.ts packages/services/src/accounting/post-journal.ts packages/services/tests/workflow-approval-gate.test.ts packages/services/tests/accounting-post-journal.test.ts 'apps/web/app/(dash)/settings/workflow-editor/workflow-editor-client.tsx' 'apps/web/app/(dash)/accounting/journals/actions.ts' apps/web/messages/en.json apps/web/messages/id.json apps/web/messages/zh.json`: PASS with existing warnings in workflow editor/test mock style
- Locale JSON parse for `en.json`, `id.json`, `zh.json`: PASS
- `rg -n "\?\?\?" apps/web/messages/zh.json`: no matches
- `pnpm --filter @erp/web typecheck`: stopped after 120 seconds with no result to avoid a long-running silent command.

## Next step

Commit and push this implementation. Next ERP-wide P0 step should add approval inbox/outbox UX and MCP workflow tools so pending approvals are easy to act on outside the source module.
