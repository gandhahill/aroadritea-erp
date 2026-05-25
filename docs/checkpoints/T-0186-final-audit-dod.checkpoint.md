# Checkpoint: T-0186 - Finalize first 26-dimension audit DoD

- **Owner**: Codex
- **Started**: 2026-05-25 22:43 WIB
- **Last updated**: 2026-05-25 23:48 WIB
- **Status**: DONE
- **Phase**: Cross-cutting audit closure
- **Branch**: master

## Goal

Close the remaining gaps from the original 26-dimension audit prompt so T-0170 is no longer only "Phase 1". This task focuses on evidence-backed closure: remove known DoD violations, rerun required verification commands, update the audit ledger/report with current T-0171..T-0186 outcomes, and document residual risk honestly.

Relevant specs:
- AGENTS.md / CLAUDE.md task workflow and DoD.
- SOURCE-OF-TRUTH sections on POS, HR, CRM, reporting, security, and compliance.
- SYSTEM-DESIGN sections 11, 13, 16, 21, 23, 25, 36, and 37.
- ADR-0006, ADR-0009, ADR-0010, ADR-0011, ADR-0012, ADR-0013.

## Definition of Done

- [x] `pnpm -w lint` PASS.
- [x] `pnpm -w typecheck` PASS.
- [x] `pnpm -w test` PASS.
- [x] `pnpm build` PASS.
- [x] Known native `alert/confirm/prompt` production UI violations are replaced with in-app dialog/banner patterns.
- [x] T-0170 audit ledger/report reflect current T-0171..T-0186 state, including items that moved from backlog to done.
- [x] TASK.md and this checkpoint are updated with final status.

## Completed

- Re-read TASK.md, SOURCE-OF-TRUTH.md, SYSTEM-DESIGN.md, CLAUDE.md, ADR index, T-0170 audit report, and Codex Security scan workflow.
- Ran Biome formatting and fixed remaining blocking diagnostics:
  - CMS sanitized HTML render path no longer trips `noDangerouslySetInnerHtml`.
  - `sanitize-cms-html.ts` no longer uses regex control-character range rejected by Biome.
  - Dialog overlays use semantic `<dialog open>` instead of `role="dialog"` overlays.
  - `petty-cash-view.tsx` uses `t.rich` instead of HTML injection.
  - Product form boolean defaults and optional chaining lint blockers cleaned.
- Replaced native browser dialogs in production UI:
  - Export buttons now use `InlineAlert`.
  - Bank recon and bank account destructive flows use `ConfirmDialog`.
  - Purchase return action errors use `InlineAlert`.
  - HR shift swap uses an in-app dialog instead of `window.prompt`.
- Updated audit docs:
  - `docs/audit/AUDIT-FIX-LEDGER.md`
  - `docs/audit/AUDIT-FIX-REPORT.md`
- Root build verified after a transient Windows `.next` lock/race:
  - First `pnpm -r build` failed because stale Next process held `apps/site/.next/trace`.
  - Cleaned stale processes and `.next` artifacts inside workspace.
  - `pnpm --filter @erp/site build` PASS.
  - `pnpm --filter @erp/web build` PASS.
  - Final `pnpm build` PASS.

## Verification

| Command | Status | Evidence |
|---|---|---|
| `pnpm -w typecheck` | PASS | 10/10 workspaces. |
| `pnpm -w test` | PASS | 685/685 tests: shared 85 + services 600. |
| `pnpm -w lint` | PASS | Biome checked 696 files, exit 0, 884 warnings remain. |
| `pnpm build` | PASS | Root serial build: worker, MCP, site, web. |
| native dialog grep | PASS | Only comments remain in `apps/web/components/confirm-dialog.tsx`. |

Native dialog check:

```powershell
rg -n "\b(alert|confirm|prompt)\s*\(|window\.(alert|confirm|prompt)" apps packages --glob '!**/*.test.ts' --glob '!**/*.test.tsx'
```

Result only:

```text
apps\web\components\confirm-dialog.tsx:16: * Brand-styled confirmation dialog. Replaces browser-native window.confirm().
apps\web\components\confirm-dialog.tsx:83: * Inline alert banner. Replaces browser-native window.alert() in non-blocking flows.
```

## Residual Risk

- Biome has 884 warnings after error-level cleanup. They are non-blocking hygiene issues (`noExplicitAny`, label associations, useless fragments, test thenables, etc.).
- Formal tablet/mobile/WCAG manual pass should still be scheduled before store pilot; blocking lint/a11y errors from this closure are resolved.
- CSP nonce migration remains a low-risk hardening backlog.

## Next step

T-0186 is complete. Next AI can pick the next active item from TASK.md; currently T-0187 appears to be a separate user-guide refresh task and is intentionally not part of this audit-closure commit.

## Commits

| SHA | Message | Date |
|-----|---------|------|
| this commit | `chore(t-0186): close first audit dod` | 2026-05-25 |
