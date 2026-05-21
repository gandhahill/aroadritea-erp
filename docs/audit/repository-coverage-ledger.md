# Repository Coverage Ledger

**Task:** T-0168
**Purpose:** Track audit coverage for repository-wide security and data-integrity review.

| Area | Coverage status | Evidence | Next action |
|---|---|---|---|
| SoT/SD/ADR ingestion | Done | `SOURCE-OF-TRUTH.md`, `SYSTEM-DESIGN.md`, `AGENTS.md`, `CLAUDE.md`, ADR-0001/0004/0006/0008/0009/0011 read | Re-open module-specific ADRs when a finding touches that area. |
| Baseline health | Done | `docs/audit/00-baseline.md` | Re-run after Fase 4 fixes. |
| Attack surface map | Done | `docs/audit/01-attack-surface.md` | Use as routing map for static findings. |
| Static analysis | Pending | Not yet run for Fase 2 | Run prompt-specified `rg` sweeps plus typecheck/lint/audit. |
| Authentication/member | Partial audit | Password reset fixed in `e52d7e7` | Continue rate-limit, OTP, complete-signup, session checks. |
| Accounting/financial integrity | Pending deep audit | Baseline tests pass | Inspect money precision, period close, reverse idempotency, AP/AR and asset sync. |
| POS/offline/inventory | Pending deep audit | Manual sales/outlet/inventory code fixes in T-0168 | Inspect sync idempotency, future timestamps, inventory deduction atomicity. |
| Upload/private files | Pending deep audit | Upload code inventoried | Inspect ownership, MIME, file-size, and path traversal tests. |
| MCP tools | Pending deep audit | Tool inventory captured | Inspect Zod and permission guard for every write/read tool. |
| Worker jobs | Pending deep audit | Job inventory captured | Inspect retry/fail-closed/no-secret logging. |
| Final report | Pending | Not started | Fill `docs/audit/AUDIT-REPORT.md` after fixes and final verification. |
