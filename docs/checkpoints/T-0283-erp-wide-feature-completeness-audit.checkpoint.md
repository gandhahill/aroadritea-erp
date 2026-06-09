# Checkpoint: T-0283 - ERP-wide feature completeness and flexibility audit

- **Owner:** Codex
- **Started:** 2026-06-09 16:13 WIB
- **Last updated:** 2026-06-09 16:25 WIB
- **Status:** IN_PROGRESS

## Goal

Ensure the ERP feature set is complete, flexible, and aligned with ERP best practices across all modules, not only one page. Compare current implementation against `SOURCE-OF-TRUTH.md`, `SYSTEM-DESIGN.md`, ADR constraints, repo evidence, and broader ERP best-practice expectations even when they are not explicitly listed in the internal SoT/SD.

## Audit Dimensions

- Module coverage: Accounting, Reporting, Tax, POS, Inventory, Purchasing, Kitchen, HR/Payroll, CRM, CMS/site, AI/MCP, Settings/IAM.
- Architecture: UI transport stays thin, business logic in services, DB schema/audit/i18n/permission conventions respected.
- ERP controls: approvals, period locks, audit trail, numbering, attachment evidence, status workflows, location dimension, idempotency, exports.
- Flexibility: DB-driven settings/policies/mappings, custom fields, workflow rules, location-scoped configuration, opt-in tax engine.
- User experience: multilingual ID/EN/ZH, no hardcoded UI strings, non-technical locale copy for users.
- Integration/automation: MCP tool coverage and audit parity with UI.
- ERP best-practice baseline beyond SoT/SD:
  - Functional end-to-end completeness for daily operational workflows, not only security/integrity controls.
  - Role-specific work queues, dashboards, exception handling, and task handoff.
  - CRUD completeness where appropriate: create, search/filter, detail, edit/amend, approve/post, cancel/reverse, export/print.
  - Operational usability: mobile-friendly screens for store staff, fast filters, pagination, empty/error states, printable documents, and actionable notifications.
  - Segregation of duties and maker/checker approvals for sensitive transactions.
  - Full document lifecycle/status workflow with cancellation/reversal rather than destructive edits.
  - Sequential numbering and immutable posted records.
  - Period locks, cutoff controls, and audit-ready trails.
  - Master-data governance, versioning, import/export, and duplicate prevention.
  - Attachments/evidence on financial, HR, inventory, and procurement documents.
  - Exception queues, reconciliation views, and drilldown from reports to source documents.
  - Configurable policies per tenant/location without code changes.
  - Data quality validation, idempotency, optimistic locking, and recoverable errors.
  - Role-based dashboards, self-service where appropriate, and operational mobile readiness.
  - Odoo-level platform breadth and configurability, but purpose-built for FnB retail operations in Indonesia.

## Plan

1. [x] Register task and checkpoint.
2. [x] Inventory routes, services, schemas, permissions, MCP tools.
3. [x] Build module-by-module completeness matrix.
4. [x] Patch obvious small gaps safely.
5. [x] Record larger gaps as prioritized backlog items with exact evidence.
6. [x] Run focused validation and push results.

## Evidence Collected

- Dashboard route inventory: 152 `page.tsx` routes across accounting/reporting/tax/POS/inventory/purchasing/HR/CRM/settings/CMS/logistics/etc.
- Service inventory: 24 service module directories.
- Permission inventory: 120 seeded permissions across 23 modules.
- MCP inventory: tools exist for IAM, accounting, reporting, tax, inventory, purchasing, POS, HR, payroll, CRM, docs, operations, audit.
- Extensibility inspection: custom field service and workflow service exist, but integration is not universal across all entity pages/workflows.
- Architecture risk: many `apps/web/app/(dash)` files import `@erp/db` directly, so business rules are still scattered in UI actions/pages.

## Artifacts Created

- `docs/audit/erp-feature-completeness-2026-06-09.md`
- `packages/shared/src/erp/entity-extension-registry.ts`
- `packages/shared/tests/entity-extension-registry.test.ts`

## Verification

- `pnpm --filter @erp/shared typecheck`: PASS
- `pnpm --filter @erp/shared test`: PASS, 91 tests
- `node .\node_modules\@biomejs\biome\bin\biome lint --max-diagnostics=100 packages/shared/src/erp/entity-extension-registry.ts packages/shared/tests/entity-extension-registry.test.ts packages/shared/package.json docs/audit/erp-feature-completeness-2026-06-09.md`: PASS

## Next step

Commit and push the audit plus entity extension registry. Next implementation task should start with P0 from the audit: universal custom-field embedding, approval-gate integration, workflow inbox/outbox, and direct-DB import allowlist/lint rule.
