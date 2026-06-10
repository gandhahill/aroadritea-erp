# Checkpoint: T-0294 — Odoo-like FnB ERP Platform

- **Owner**: Codex
- **Started**: 2026-06-10 23:33 WIB
- **Last updated**: 2026-06-10 23:36 WIB
- **Status**: 🟩 DONE
- **Phase**: Cross-cutting product architecture
- **Branch**: master

## Goal

Capture the user's clarified product direction: Aroadri Tea ERP must be as complete and flexible as Odoo while remaining specific to FnB operations. This is a cross-module business and architecture requirement, so it must be reflected in SoT, SD, ADR, and the master plan.

- Spec bisnis: `SOURCE-OF-TRUTH.md` §18.7
- Spec teknis: `SYSTEM-DESIGN.md` P17 and §38
- ADR terkait: ADR-0018

**Kriteria selesai (Definition of Done):**
- [x] Business requirement captured in SOURCE-OF-TRUTH.
- [x] Technical implementation principle captured in SYSTEM-DESIGN.
- [x] ADR records the cross-module decision.
- [x] Master plan framing updated so future agents use Odoo-like FnB as the product benchmark.
- [x] No UI strings, schema, permissions, or audit-path code changes introduced.

## Plan

1. [x] Read AGENTS, TASK, SoT, SD, master plan, feature-completeness audit, and relevant phase cards.
2. [x] Add SoT product direction for Odoo-like completeness/flexibility with FnB-specific domain pack.
3. [x] Add SD technical principle and customization rules for DB-driven platform services.
4. [x] Create ADR-0018 and update ADR index.
5. [x] Update master plan and platform/enterprise cards to reference Odoo-like FnB target.
6. [x] Validate markdown references and commit.

## Done so far

- Added `SOURCE-OF-TRUTH.md` §18.7.
- Added `SYSTEM-DESIGN.md` principle P17 and expanded §38.
- Added `docs/adr/0018-odoo-like-fnb-erp-platform.md`.
- Updated `docs/adr/README.md`.
- Reframed `docs/plans/MASTER-PLAN-S4-CLASS.md`.
- Updated F4/F5 card headings/notes.
- Registered T-0294 in `TASK.md`.

## Decisions

- Odoo is the benchmark for functional breadth and configurability; S/4HANA remains useful as a benchmark for financial controls, governance, and traceability.
- Flexibility must come from typed, DB-driven, audited platform services rather than heavy plugins or user-supplied scripting.
- Changes touching money, tax, stock, permission, formal relations, or immutable lifecycle must be promoted to schema/service changes, not hidden in custom fields.

## Open issues / Questions

- None for this documentation task.

## Next step

Resume the master plan execution order. The next implementation work should continue from the active plan gates in `docs/plans/MASTER-PLAN-S4-CLASS.md` and the remaining IN_PROGRESS items in `TASK.md`; do not create broad Odoo-like feature work outside the phase/card sequence.

## Test status

- **Docs validation**: `git diff --check` PASS (only Git CRLF warnings).
- **Unit**: N/A (documentation-only task).
- **Integration**: N/A.
- **E2E**: N/A.

## Files Touched

| Path | Action | Note |
|------|--------|------|
| `SOURCE-OF-TRUTH.md` | Modified | Added §18.7 Odoo-like FnB product direction |
| `SYSTEM-DESIGN.md` | Modified | Added P17 and expanded §38 |
| `docs/adr/0018-odoo-like-fnb-erp-platform.md` | Added | New accepted ADR |
| `docs/adr/README.md` | Modified | Added ADR-0018 to index |
| `docs/plans/MASTER-PLAN-S4-CLASS.md` | Modified | Reframed target as Odoo-like FnB + S/4 controls |
| `docs/plans/cards/F4-platform-cards.md` | Modified | Reframed F4 as Odoo-like extensibility |
| `docs/plans/cards/F5-s4-capability-cards.md` | Modified | Reframed F5 as enterprise capabilities for Odoo-like FnB ERP |
| `TASK.md` | Modified | Registered T-0294 |

## Commits So Far

| SHA | Message | Date |
|-----|---------|------|
| `this commit` | docs: define Odoo-like FnB ERP platform target | 2026-06-10 |

## Handoff Notes

- Worktree had unrelated MCP changes before this task (`apps/mcp/package.json`, `apps/mcp/src/helpers.ts`, `pnpm-lock.yaml`, `apps/mcp/src/helpers.test.ts`). Do not stage or revert them as part of T-0294.
