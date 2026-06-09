# ERP Feature Completeness & Adaptability Audit — 2026-06-09

Owner: Codex  
Scope: Aroadri Tea ERP-wide functional completeness, flexibility, and best-practice ERP readiness.  
Evidence inspected: route inventory, service modules, DB schemas, permissions seed, MCP tools, custom field service, workflow service, `SOURCE-OF-TRUTH.md`, and `SYSTEM-DESIGN.md`.

## Executive Conclusion

The ERP already has broad module coverage: 152 dashboard routes, 24 service-module directories, 120 seeded permissions, custom fields, workflow definitions, audit logs, settings pages, MCP tools, and core modules for Accounting, Reporting, Tax, POS, Inventory, Purchasing, HR/Payroll, CRM, CMS, Logistics, and Settings.

However, "complete and future-proof ERP" is not proven yet. The current system is functionally wide, but adaptability is uneven: several processes are still hardcoded per module, many UI pages query DB directly instead of going through services, generic workflow/custom-field capabilities are not consistently embedded into every master/transaction form, and MCP/API coverage is not yet equal to the UI. To handle unpredictable future business-process changes, the ERP needs a platform layer that lets admins configure fields, approvals, document statuses, numbering, reports, imports, exports, notifications, and integrations without code changes.

The target product direction should be: **Odoo-level breadth and configurability, but purpose-built for FnB retail operations in Indonesia**. That means keeping generic ERP platform capabilities (custom fields, workflows, permissions, modules, imports, report builder, automation, integrations) while shipping an opinionated FnB domain pack (outlets, POS/offline, recipes/BOM, kitchen/KDS, stock depletion, waste, shift handover, delivery-channel commissions, PB1/PBJT, payroll attendance deductions, and outlet-level controls).

## Product Target: Odoo-Like Platform, FnB-Specific Pack

The ERP should support two layers:

1. **Generic ERP platform layer**
   - Entity registry and metadata.
   - Custom fields on every eligible entity.
   - Workflow/approval engine across document lifecycles.
   - Document numbering and templates.
   - Attachments, comments, timeline, audit history.
   - Import/export mapping framework.
   - Report builder, saved views, scheduled reports.
   - Automation/rule engine and notifications.
   - RBAC, location scope, MCP/API parity.

2. **FnB operating layer**
   - Multi-outlet POS with offline sync, refund/void controls, shift open/close.
   - Menu product variants, modifier groups, recipe/BOM and ingredient depletion.
   - Kitchen/KDS/Naixer QR and production queue.
   - Stock opname, transfer, waste, expiry/lot readiness, reorder rules.
   - Delivery channel settlement and commission handling.
   - PB1/PBJT inclusive tax and Indonesian accounting/tax reporting.
   - HR shift schedule, attendance GPS/face verification, late/absence payroll deductions.
   - Store-manager work queues for daily close, stock issues, attendance exceptions, and purchase needs.

## Best-Practice Criteria Used

- Functional end-to-end coverage: create, search/filter, detail, edit/amend, approve/post, cancel/reverse, print/export, attachment evidence, audit trail.
- Operational usability: role-specific queues, dashboards, mobile-ready staff flows, pagination, actionable empty/error states, notifications.
- Financial/ERP controls: period locks, immutable posted records, sequential numbering, maker/checker approval, segregation of duties, reconciliation, cutoff controls.
- Flexibility: DB-driven policies, workflow rules, custom fields, document templates, numbering schemes, location-scoped configuration, import/export mapping.
- Adaptability: new entity types and process variants should be configurable through platform services, not hardcoded in pages/actions.
- Integration readiness: MCP/API parity, idempotency, audit parity, import/export, external connector boundaries.
- Multilingual UX: ID/EN/ZH coverage, user-facing copy understandable by operational staff, no raw technical messages.

## Current Strengths

| Area | Evidence | Assessment |
|---|---|---|
| Module breadth | UI routes exist for Accounting, Reporting, Tax, POS, Inventory, Purchasing, HR, CRM, Settings, CMS, Logistics | Strong breadth for a custom ERP |
| Service layer | `packages/services/src` has modules for accounting, reporting, tax, pos, inventory, purchasing, hr, payroll, crm, workflow, customfield, etc. | Good foundation, but not consistently used by all UI routes |
| Permission engine | `packages/db/seed/iam.ts` seeds 120 permissions across 23 modules | Good start for RBAC and location scoping |
| Custom fields | `packages/services/src/customfield/index.ts` supports typed fields: string, number, boolean, date, enum, reference | Good metadata extension layer |
| Workflow engine | `packages/services/src/workflow/index.ts` supports condition-based sequential approvals | Good approval foundation |
| Audit trail | Audit schema and many service helpers exist | Strong principle, but direct DB actions need ongoing scrutiny |
| Settings | 23 settings routes including custom fields, workflow editor, POS, attendance, integrations, MCP tokens | Strong configurability surface |
| MCP | MCP tools cover IAM, accounting, reporting, tax, inventory, purchasing, POS, HR, payroll, CRM, docs, operations, audit | Good direction, but not full UI parity yet |

## Major Gap Themes

### 1. Platform Adaptability Is Present But Not Universal

Custom fields and workflow definitions exist, but they are not visibly embedded across all entity create/edit/detail pages. A future process change should not require editing every module page. The ERP needs a standard "entity extension contract" used by all master and transactional entities.

Recommended actions:
- Define a registry of extensible entity types such as `product`, `partner`, `employee`, `purchase_order`, `goods_receipt`, `journal_entry`, `invoice`, `stock_adjustment`, `sales_order`, `payroll_run`, `member`, `complaint`.
- Add a reusable custom-field renderer/validator for create/edit/detail pages.
- Ensure custom-field values are searchable/exportable when fields are marked indexed.
- Add MCP tools for custom-field definition/value CRUD.

### 2. Workflow Engine Exists, But Process Integration Is Uneven

Best-practice ERP requires maker/checker flows for high-risk actions: posting journals, closing periods, approving refunds, approving stock adjustments, purchase approvals, payroll approval, price changes, supplier changes, discounts, and void/refund rules. The generic workflow engine exists, but module services still appear to implement many approvals directly.

Recommended actions:
- Create a central `approval-gate` service that modules call before state transitions.
- Map every sensitive transition to workflow entity types and default definitions.
- Add approval inbox/outbox pages and notifications across modules.
- Add MCP workflow tools: list pending approvals, approve, reject, comment, inspect history.

### 3. UI Still Contains Many Direct DB Calls

Evidence: many `apps/web/app/(dash)` routes/actions import `@erp/db` directly. This violates the ideal ERP layering where business logic lives in services and UI is transport. Direct DB access makes future process changes harder because rules are scattered.

Recommended actions:
- Add a lint/audit rule for new direct DB imports in `apps/web`, with temporary allowlist for existing pages.
- Refactor direct DB pages into service queries incrementally by module priority.
- Start with high-risk modules: Accounting, POS, Inventory, Purchasing, HR/Payroll, Tax.

### 4. Functional Completeness Needs Entity-by-Entity Lifecycle Coverage

Many modules have pages, but completeness should be proven by lifecycle, not by route count. Each transactional entity needs: draft, submit, approve, post/receive/pay, cancel/reverse, attachments, audit, print/export, status history, comments, and search.

Recommended actions:
- Create a lifecycle matrix per entity and mark which states/actions exist.
- Add status history tables or audit-derived timelines for transactional documents.
- Standardize attachments/comments/timeline components across modules.

### 5. Reporting Is Broad But Needs Drilldown and Self-Service Flexibility

Reports exist for financials, aging, COGS, waste, hourly sales, BI, etc. Best-practice ERP reporting also needs drilldown to source documents, saved report views, scheduled distribution, export parity, and dimension filters.

Recommended actions:
- Add drilldown links from report lines to source docs.
- Add saved filters/report templates per user.
- Add scheduled report jobs and notification/email delivery.
- Add consistent XLSX export for all operational reports.

### 6. Import/Export and Data Governance Are Not Yet a Unified Platform

There are imports/exports in specific modules, but future-proof ERP needs a reusable import mapping and validation framework.

Recommended actions:
- Build a generic import wizard with field mapping, dry-run validation, duplicate detection, error row export, and audit.
- Build reusable export templates for CSV/XLSX/PDF.
- Add master-data governance: duplicate detection, merge workflow, deactivation rules, and change history.

### 7. MCP/API Parity Is Not Complete Enough For Future Automation

MCP exists and has useful tools, but future processes will need automation parity for every core workflow.

Recommended actions:
- For every module, document UI actions and matching MCP tools.
- Add MCP tools for custom fields, workflow approvals, inventory opname, purchase returns, logistics shipments, HR leave/overtime/kasbon, CRM member adjustments, and report exports.
- Ensure MCP mutations pass the same service/permission/audit paths as UI.

## Module Matrix

| Module | Current coverage | ERP best-practice gap | Priority |
|---|---|---|---|
| Accounting | COA, journals, periods, invoices, AR/AP, petty cash, reimbursement, bank recon, fixed assets, close center | Recurring journals, budget control, full approval-gate integration, universal attachments/timeline, report drilldown, immutable amendment policy | High |
| Reporting | Balance sheet, P&L, cash flow, trial balance, GL, aging, COGS, waste, daily/hourly/BI | Saved views, scheduled distribution, drilldown, consistent XLSX/PDF, user-defined dashboards and dimensions | High |
| Tax | PB1, rates/rules, SPT, e-Faktur, Bupot | Full tax calendar, reconciliation to GL/POS/purchase docs, e-document lifecycle, Coretax/e-Faktur version management | High |
| POS | Orders, manual sales, demo, shift, offline concepts, refunds | Full offline sync observability, cashier exception queue, promotion/discount approval, device management, shift handover checklist | High |
| Inventory | Products, categories, stock, ledger, adjustment, transfer, opname, recipes, variance, supplies | Lot/expiry optionality, UOM conversion UI, reorder rules, costing audit, stock reservation, generic import/export, approval-gate on high variance | High |
| Purchasing | PO, GRN, returns, shipments, reports, auto PO service | Supplier quotation/RFQ comparison, purchase invoice UI completeness, landed cost UI, contract price lists, workflow-gated procurement matrix | High |
| Kitchen | KDS/Naixer services exist | UI/operator queue coverage unclear, recipe production workflow, waste/rework feedback loop, kitchen performance metrics | Medium |
| HR/Payroll | Employees, schedule, attendance, payroll, leave, overtime, kasbon, disciplinary, SOP, whistleblower, recruitment | Contract lifecycle, flexible payroll components/rules, attendance exception queue, approval inbox, document attachments, legal compliance checklist | High |
| CRM/Member | Members, loyalty, complaints, points adjustment | Member segmentation, campaign workflow, consent/privacy management, duplicate merge, voucher lifecycle analytics | Medium |
| Logistics | Outgoing shipments CRUD/edit/detail | Carrier abstraction, label/manifest printing, exception tracking, proof of delivery attachment, shipment cost allocation | Medium |
| CMS/Site | Pages/posts/docs/settings | Preview workflow, multi-approver publish, content scheduling, asset governance | Medium |
| Settings/IAM | Locations, permissions, custom fields, workflow editor, policies, integrations, MCP tokens | Change impact preview, config versioning/rollback, policy simulation, environment-specific config export/import | High |
| AI/MCP | Assistant tools, MCP server, audit tools | Full workflow parity, approval for AI actions, tool coverage ledger, sandboxed dry-run for mutations | High |

## Priority Backlog To Make ERP Future-Proof

### P0 — Adaptability Foundation

1. Build an `entity-extension-registry` defining extensible entities, supported custom-field placements, export behavior, searchable fields, and MCP exposure.
2. Build reusable custom-field UI components and wire them into core master data first: products, partners, employees, members, suppliers.
3. Build `approval-gate` service and require modules to call it before sensitive state transitions.
4. Add workflow inbox/outbox with approve/reject/comment/history.
5. Add direct-DB import audit rule for `apps/web`, with allowlist and migration plan.

### P1 — Functional ERP Completeness

1. Create lifecycle matrices for all transactional entities: journal, invoice, PO, GRN, purchase return, stock adjustment, stock transfer, opname, sales order, refund, payroll, leave, overtime, kasbon, complaint.
2. Add universal document timeline with status history, comments, attachments, and audit references.
3. Add generic import wizard with dry-run validation and row-level error export.
4. Add saved report views and scheduled report delivery.
5. Add MCP parity ledger and implement missing tools per core workflow.

### P2 — Operational Excellence

1. Role-specific work queues: cashier, store manager, accountant, HR, purchasing, director.
2. Exception center: failed sync, unmatched bank lines, negative stock, missing BOM, pending approvals, payroll blockers, tax export blockers.
3. Config versioning and rollback for policies/settings/workflows.
4. Business process simulation/dry-run for payroll, tax, closing, purchasing, stock adjustments.

## Definition of Done For "Flexible ERP"

The ERP can be considered adaptable when a new business process can usually be handled by configuration:

- Add fields through custom fields and have them appear in forms, detail pages, exports, filters, and MCP.
- Add approval rules through workflow editor and have all relevant module transitions honor them.
- Add numbering/document templates without code changes.
- Add import/export mappings without writing a module-specific parser.
- Add policy/rule changes per tenant/location/effective date.
- Add role permissions and work queues without hardcoding role names.
- Expose new automation via MCP using the same permission/audit path as UI.

## Immediate Engineering Notes

- Treat route count as breadth evidence only, not completeness proof.
- Direct DB usage in `apps/web` is the largest technical drag on future process changes.
- Custom fields and workflows are the correct strategic foundation; the next work should focus on making them universal and impossible to bypass.
- Functional completeness must be tested by end-to-end business scenarios, not isolated pages.
