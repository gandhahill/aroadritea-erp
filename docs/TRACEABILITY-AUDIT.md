# Traceability Audit - SOURCE-OF-TRUTH & SYSTEM-DESIGN

Audit date: 2026-05-15
Task: T-0167 Production readiness audit and critical fixes
Scope: `SOURCE-OF-TRUTH.md` v1.6 and `SYSTEM-DESIGN.md` v2.0 against the current codebase, including local T-0167 changes not yet deployed.

## Status Legend

- `FULL`: requirement has backend, UI/transport where required, and current evidence indicates it is implemented.
- `PARTIAL`: important pieces exist, but at least one required surface, configuration path, test, workflow, or production verification is missing.
- `NOT_STARTED`: no meaningful implementation found.
- `VERIFY`: implementation appears present, but must not be treated as complete until typecheck/test/build/smoke passes in this T-0167 branch.

Important: this matrix is intentionally skeptical. A feature with code but no current verification is not marked production-complete.

## Business Requirement Matrix

| SoT Section | Requirement | Status | Evidence | Gaps / Required Action |
|---|---|---:|---|---|
| SoT 1 | Company legal profile, brand, NPWP/NIB/PKP facts stored in documentation and public identity | PARTIAL | `SOURCE-OF-TRUTH.md`, public site content/messages | Company facts are not yet editable from ERP settings as structured data. |
| SoT 2 | Future-flexible ERP, no hardcoded single-channel/single-branch assumptions | PARTIAL | `locations`, `pos_settings`, `customfield`, `workflow`, delivery channel settings | Some legacy hardcoded defaults remain in seed and POS/accounting comments. T-0167 is moving delivery channels and locations to UI-managed config. |
| SoT 3 | Roles can be added and permissions managed without source edits | FULL | IAM schema/services, `/settings/permissions`, wildcard access seed | Current branch still needs verification after i18n and sidebar changes. |
| SoT 3.4 | Approval matrix and future tiered approval config | PARTIAL | `packages/services/src/workflow`, `/settings/workflows` | Workflow exists, but docs are insufficient and not all business actions are visibly wired to workflow definitions. |
| SoT 4.1 | Active sales channels: walk-in, GoFood, GrabFood, ShopeeFood | PARTIAL | POS channel selector, `pos_settings.delivery_channels_json` | T-0167 changed delivery channels to UI-managed config; needs typecheck and POS smoke. |
| SoT 4.2 | Delivery commission configurable and can change per platform | VERIFY | `apps/web/app/(dash)/settings/pos/*`, `packages/services/src/reporting/daily-summary.ts`, `packages/services/src/pos/create-sale.ts` | Added in local branch. Must pass typecheck and live POS/report smoke. |
| SoT 4.3 / 13 | Membership/loyalty framework | PARTIAL | member schema/services, member portal, loyalty service, POS member lookup | Signup crash was patched locally; OTP, rate limit, and production signup must be smoke-tested. |
| SoT 5 | Product catalog, categories, variants, modifiers | PARTIAL | inventory schema/services, `/inventory/products`, `scripts/seed-aroadri-menu.ts` | Product images/file upload added locally but unverified. BOM/UI completeness still needs deeper pass. |
| SoT 5.3 | Sugar/ice customization includes normal/less/no sugar and normal/less/no ice | FULL | menu seed and POS modifiers | Needs regression smoke in POS and demo POS. |
| SoT 5.4 | Seasonal products, active dates, bundle/combo extendability | PARTIAL | product schema has active status/dates; promotion schema added locally | Bundle/combo and seasonal UI rules are not yet complete. |
| SoT 6.1 | Payment methods: cash, debit/credit, Flazz, QRIS | VERIFY | POS payment modal | T-0167 modified payment method handling; requires POS payment smoke. |
| SoT 6.3 | Refund and void by cashier | PARTIAL | POS refund service/UI, permissions | Need full browser smoke for refund/void and receipt output. |
| SoT 6.5 | PB1/PBJT 10% inclusive, not added on top | FULL | tax rates/rules, POS create sale, reporting daily revenue | Must keep regression tests as critical release gate. |
| SoT 6.6 | Receipt, kitchen receipt, label with Naixer QR, label size 6x4/4x3 cm, receipt width flexible | PARTIAL | Naixer settings, POS settings receipt width, kitchen QR generator | Print output parity and physical printer smoke not yet evidenced in this audit. |
| SoT 7 | Promo engine: percent, buy X get Y, voucher/member, platform promo, optional free/complimentary | PARTIAL | voucher/loyalty service; local promotion schema/migration added | Rule engine, UI, POS application, audit trail, and MCP tools still need completion. |
| SoT 8 | Inventory FIFO, batch/expiry, stock alert, stock opname, write-off approval, transfer | PARTIAL | inventory schema/services, stock opname UI, variance report | Auto-deduct from BOM on POS sale and full BOM UI need verification; stock alert config needs UI evidence. |
| SoT 8.5 | BOM per product/variant/size and alternative ingredients | PARTIAL | BOM schema exists | Friendly BOM UI and POS auto-deduct proof are not yet confirmed. |
| SoT 9 | Purchasing: PO, approval, supplier, GRN, return/QC | PARTIAL | purchasing schema/services/UI | Supplier and PO UI exist; return/QC and complete payable flow need deeper verification. |
| SoT 10 | Accounting: COA seed, journals, GL, trial balance, balance sheet, P&L, cashflow/equity, per-location reports | PARTIAL | accounting/reporting services/UI/MCP | Cashflow and equity report coverage must be rechecked; admin journal UX was fixed earlier but needs live smoke. |
| SoT 10.2 | Petty cash plafon, replenishment, bank recon monthly | PARTIAL | petty cash schema/service/UI | Bank reconciliation module not confirmed as complete. |
| SoT 10.4 | Fixed assets and straight-line depreciation | PARTIAL | COA supports assets; accounting can journal | Dedicated fixed asset register/depreciation schedule UI not confirmed. |
| SoT 11 | Tax: PPN opt-in, PPN in/out, PPh 21/23/25/29, final UMKM, Coretax export | PARTIAL | tax engine, payroll PPh21, PB1/omzet export | PPh 23/25/29 and latest Coretax layout require deeper formal verification. |
| SoT 12 | HR: employees, contracts, attendance, leave, payroll, disciplinary | PARTIAL | HR schema/services/UI | User-facing docs incomplete; employee data encryption-at-rest must be verified. |
| SoT 13 | CRM: member profile, points, vouchers, complaints, compensation | PARTIAL | member/crm/loyalty services/UI | Voucher redemption and member lifecycle need end-to-end POS smoke. |
| SoT 14 | Kitchen/KDS and Naixer QR-only integration | PARTIAL | kitchen schema/services, Naixer mapping UI | Label QR/print physical format and demo watermark must be verified. |
| SoT 15 | Multi-location branch dimension; public site shows outlets only | PARTIAL | locations schema/UI local patch, public site location pages | Seed still overwrites some location data; local patch required to preserve UI-managed edits. |
| SoT 16 | Dashboard and reports for management | PARTIAL | dashboard/report pages | User requested super-complete BI dashboard for management, not only director; page is linked but not implemented yet. |
| SoT 17 | Infra: Next.js apps, MCP, worker, PM2/HestiaCP | FULL | app layout, `ecosystem.config.cjs`, README/deploy docs | Needs re-run after local changes. |
| SoT 18 | Security, audit, backup, military-level without mandatory 2FA | PARTIAL | auth, RBAC, audit log, backup runbooks, security headers, hardened scheduled jobs | Field-level encryption for PII, dependency scan, incident runbook and restore-drill evidence need completion. |
| SoT 19 | Compliance: PDP, BPOM/Halal docs, tax compliance | PARTIAL | legal pages, member consent, attachments | Legal pages improved earlier; document storage and legal text need final counsel review. |
| SoT 21.2a | XLSX export in all relevant modules with clear labels | PARTIAL | reporting/inventory XLSX exports | Export coverage across all modules and location-name clarity still being patched. |
| SoT 21.2b | Dedicated docs/help page as source of truth for users | PARTIAL | `/docs`, `/cms/docs` local editable docs | Content is still below requested depth; needs module-by-module step-by-step expansion. |
| SoT 21.3/21.4/21.3b | Daily summary, hourly sales, daily revenue PB1-exclusive export | FULL | reporting services/UI/MCP | Must re-run tests after dynamic delivery commission patch. |
| SoT 21.5/21.6/21.7 | Petty cash, reimbursement, stock variance | PARTIAL | services/UI; upload field local patch | File upload and export naming need verification. |
| SoT 21.9 | Journal attachments + MCP audit | PARTIAL | journal attachments service/UI/MCP; local upload API | General attachment upload is local and unverified. |
| SoT 21.10 | Donation / rounding | FULL | POS donation flow, reporting donations | Needs regression smoke. |
| SoT 22 | Public website, CMS, member signup/portal, legal pages | PARTIAL | `apps/site`, CMS services/UI | Public signup crash patched locally; content/legal/i18n still need live verification. |
| SoT 23 | Brand style, tagline, favicon, Chinese tea accent | PARTIAL | site brand assets, pages, ERP favicon/PWA assets | Live favicon/PWA smoke passed; remaining work is full authenticated visual QA across ERP pages. |
| SoT 24 | POS demo/training mode identical to real POS except DB side effects | PARTIAL | `/pos/demo`, offline demo DB | Must compare receipt/label/payment flow against real POS and ensure no server sync/printer side effect. |
| SoT 25 | Resilience: offline POS, auto-sync, RTO <= 2 min, RPO 0 POS, alerts | PARTIAL | PWA/offline packages, PM2 config, healthz, worker run-status tracking, low-stock alert job | Offline scenarios, print recovery, and external alert delivery are not fully proven by automated tests. |

## Technical Requirement Matrix

| SD Section | Requirement | Status | Evidence | Gaps / Required Action |
|---|---|---:|---|---|
| SD 1-6 | Modular monolith with apps/site, apps/web, apps/mcp, worker, packages | FULL | repository layout | Keep memory budget verified during build/deploy. |
| SD 7 | TypeScript strict, Result/AppError service layer, no HTTP in service | PARTIAL | services package patterns | Some server actions still contain business mapping; need deeper static audit. |
| SD 8 | Audit columns, tenant/location dimension, soft delete | PARTIAL | common schema helpers | Need automated schema audit to catch tables missing audit/location columns. |
| SD 9 | Core database schema for all modules | PARTIAL | schema files | Promotion schema added locally; fixed assets/recon/complete docs settings still incomplete. |
| SD 10 | Minimal API only where needed | PARTIAL | sync/upload/member APIs | Upload API added locally; authorization and private file serving must be tested. |
| SD 11 | AuthZ via DB permission engine; no hardcoded role checks | PARTIAL | IAM service/UI | Need `rg` audit for `role ===` and route-level gaps before marking full. |
| SD 12 | Multi-location dimension and active-location filtering | PARTIAL | locations schema, local settings UI | Seed overwrite must be fixed; export/name localization pass in progress. |
| SD 13 | ID/EN/ZH i18n from day one | PARTIAL | message JSON files, locale switcher, HR check-in i18n patch | ID/EN/ZH key parity passes; remaining risk is hardcoded UI copy in older pages that still needs migration. |
| SD 14 | Offline-first POS PWA, IndexedDB outbox, idempotency | PARTIAL | `packages/offline`, POS sync API | Offline/no-network/reboot/server-down scenarios not yet fully automated. |
| SD 15 | Audit log immutable and queryable | PARTIAL | audit service, local audit UI | Audit UI added locally; needs typecheck and smoke. |
| SD 16 | MCP read/write/audit tools using same permission engine | PARTIAL | `apps/mcp/src/tools/*` | Need tool inventory and smoke test; new locations/docs/promotions tools missing. |
| SD 17 | Custom field engine | FULL | customfield schema/service/UI | Need current build verification only. |
| SD 18 | Workflow engine/editor | PARTIAL | workflow schema/service/UI | Docs and real module integration coverage incomplete. |
| SD 19 | Tax engine database-driven | PARTIAL | tax schema/services | Need current statutory layout validation for Coretax; PPh scope incomplete. |
| SD 20 | Accounting engine strict double-entry and period closing | FULL | accounting tests historically passed | Must re-run service tests after local branch changes. |
| SD 21 | Module specifications | PARTIAL | app/module folders | Several modules have backend/UI gaps noted above. |
| SD 22 | Error handling/logging: fail loud, structured errors | PARTIAL | AppError, services | Need scan for swallowed errors and production `console.*`. |
| SD 23 | Tests: unit, integration, e2e, Playwright smoke | PARTIAL | Vitest tests, some scripts | Current T-0167 branch not yet verified; Playwright smoke missing for many UI paths. |
| SD 24 | Performance/memory discipline for 2 GB VPS | PARTIAL | PM2 memory limits, healthz memory | Need load/OOM simulation and bundle/memory measurement. |
| SD 25 | Security checklist / military-level | PARTIAL | RBAC, secure cookies, rate limit pieces | 2FA intentionally not mandatory; PII encryption and dependency security scan must be closed. |
| SD 25.3 | XLSX export in all modules | PARTIAL | ExcelJS exports in reporting/inventory | Need complete export coverage list. |
| SD 25.4 | Comprehensive editable documentation | PARTIAL | local `/docs` and `/cms/docs` | Needs full content expansion and UI verification. |
| SD 25.10 | Journal attachments with MCP audit | PARTIAL | attachments + local upload API | File upload must be authorized and smoke-tested. |
| SD 26 | CI/CD deployment with PM2/HestiaCP | FULL | README, `ecosystem.config.cjs` | Must redeploy after local fixes. |
| SD 27 | Backup/restore/DR | PARTIAL | runbooks/scripts, DB-managed backup job behavior | Backup job no longer crashes when managed backup mode is used; restore drill evidence is still missing. |
| SD 28 | Observability and alerts | PARTIAL | healthz, worker run-status persistence, stock-low alert delivery path | Alert configuration and delivery code exist; external email/WhatsApp delivery and escalation proof are still missing. |
| SD 29/37 | AI workflow via TASK/checkpoint | PARTIAL | `TASK.md`, checkpoint | Checkpoint must be updated after this audit. |
| SD 31 | Public website + CMS + member portal | PARTIAL | `apps/site`, CMS/member services | Current public/signup regression needs verification. |
| SD 33 | Naixer QR integration | PARTIAL | kitchen/Naixer services/UI | Physical QR/label test not evidenced. |
| SD 34 | POS demo mode | PARTIAL | `/pos/demo` | Must be made identical to real POS print/payment behavior. |
| SD 35 | Resilience and auto-recovery | PARTIAL | PWA outbox, PM2 config | Resilience test scripts incomplete vs 8 required scenarios. |
| SD 36 | Anti-generic UI design system | PARTIAL | brand tokens | `rg` still finds `bg-white` and generic classes in production UI; needs cleanup. |
| SD 38 | UI-managed non-secret configuration | PARTIAL | POS/settings/customfields/workflow/CMS/local locations UI | Promotions/docs/locations/file upload are being added; seed still risks overwriting settings. |

## T-0167 Update - 2026-05-15 22:48 WIB

This update records the current local evidence after the second SoT/SD sweep. It does not claim absolute zero bugs; it records what has been verified and what remains a release risk.

### Fixed / Improved In This Pass

1. POS production client crash path: client POS no longer imports server/database service code for donation options.
2. Member signup standalone tracing: site build now transpiles service/db packages and member OTP email uses static `nodemailer` import.
3. Settings/master CRUD:
   - Roles can be created, edited, deleted when unassigned, and mapped to permissions.
   - Locations can be edited and soft-deleted from UI; active location selectors exclude soft-deleted locations.
   - Leave types can be created, edited, deleted from UI.
   - COA and tax rates/rules now have UI CRUD surfaces.
   - Product variants can now be activated/deactivated from product detail UI.
4. POS settings:
   - Posting accounts are dropdowns from active postable COA accounts, not free-text account numbers.
   - Receipt width remains UI-configurable.
   - Delivery channel commission remains UI-configurable.
5. Public/member/upload:
   - Product image previews resolve public-site assets and ERP uploads.
   - Generic file upload API and reusable upload field are used for product images, CMS images, reimbursement, disciplinary files, and journal attachments.
6. Reporting/export:
   - Daily summary export now uses outlet label instead of raw location ID.
   - Donation and hourly-sales reports now generate real `.xlsx` workbooks via `exportWorkbook`.
   - Export button style is normalized to the same green XLSX action style.
7. HR/SOP:
   - Shift definitions are now seeded by the main seed runner.
   - Check-in shift options come from DB, not hardcoded UI constants.
   - Attendance service rejects missing/inactive shift IDs instead of silently recording attendance without shift validation.
   - Payroll late penalty now uses late event count with 3 free events/month per SOP.
8. POS demo:
   - Demo payment now mirrors production payment methods per channel.
   - Demo payment now includes cash change donation options and receipt preview shows paid/donation/change amounts.
9. Naixer label:
   - 4x3 cm preview uses compact QR/text/padding sizing instead of scaling the 6x4 layout unchanged.
10. Docs/help:
   - HR/SOP docs have been expanded with employee attendance, leave, opening/closing, product handling, and payroll guidance.

### Current Verification Evidence

1. `pnpm -r typecheck` PASS across 10 workspace projects.
2. `pnpm --filter @erp/services test` PASS: 24 files, 528 tests.
3. `pnpm --filter @erp/web build` PASS: Next production build, Serwist PWA bundle, standalone asset sync.
4. `pnpm --filter @erp/site build` PASS: 31 static public pages.
5. `pnpm --filter @erp/mcp build` PASS.
6. `pnpm --filter @erp/worker build` PASS.
7. MCP local health smoke PASS: `http://127.0.0.1:3912/healthz` returned HTTP 200.
8. Sidebar route audit PASS: 49 sidebar hrefs, 0 missing route files.
9. i18n key parity PASS: web/site ID/EN/ZH have 0 missing keys.
10. Marker scan PASS: no `TODO`, `FIXME`, `NOT_IMPLEMENTED`, `not implemented`, `stub`, `coming soon`, `under construction`, `lorem`, `dummy`, `Belum tersedia`, or `Segera hadir` markers in `apps` or `packages`.

### Remaining Release Risks

1. Hardcoded UI copy still exists in older ERP pages even though key parity passes. This is an i18n quality gap, not a missing-key gap.
2. POS demo is closer to production, but physical receipt/label print parity still needs browser/printer smoke.
3. Payroll absence penalty is supported by the engine, but automatic no-notice absence capture still needs a formal schedule/absence recording flow.
4. MCP has 47 runtime tools and health passes, but newly added UI CRUD surfaces such as COA/tax management are not all exposed as MCP write tools yet.
5. PII encryption-at-rest and full legal/compliance counsel review remain formal assurance tasks before calling the whole ERP compliance-complete.
6. Production deploy and authenticated browser smoke are still required after this local patch set.

## T-0167 Update - 2026-05-15 23:31 WIB

Additional SoT/SD sweep focused on worker resilience and HR i18n gaps found after the 22:52 pass.

### Fixed / Improved In This Pass

1. Worker scheduled jobs now record last-run success/failure back to `scheduled_jobs`, so the UI can show operational evidence instead of static configuration only.
2. Backup, public-site revalidation, payroll batch, and stock-low alert jobs no longer fail by default just because optional production integrations are not configured.
3. Stock-low alert job now queries inventory thresholds and sends operational alerts through active configured notification channels for email or WhatsApp.
4. Scheduled-jobs settings page/table is now localized through `scheduledJobs` message keys instead of hardcoded UI copy.
5. HR check-in page now follows selected ERP language for labels, GPS status, date/time locale, error messages, shift warnings, and submit state.

### Verification Evidence

1. `pnpm -r typecheck` PASS across 10 workspace projects after worker/scheduled-job changes.
2. `pnpm --filter @erp/web typecheck` PASS after HR check-in i18n changes.
3. `pnpm --filter @erp/services test` PASS: 24 files, 528 tests.
4. `pnpm --filter @erp/web build`, `pnpm --filter @erp/site build`, `pnpm --filter @erp/worker build`, and `pnpm --filter @erp/mcp build` PASS.
5. Local MCP HTTP health smoke PASS on `http://127.0.0.1:3912/healthz`.
6. Web/site i18n key parity PASS: `apps/web/messages` has 746 keys and `apps/site/messages` has 98 keys with 0 missing keys across ID/EN/ZH.
7. Unfinished-marker scan PASS over `apps` and `packages` for TODO/FIXME/not-implemented/stub/coming-soon/lorem/dummy markers.

## Next Implementation Order

1. Commit/push this verified patch set and deploy to VPS.
2. Run production DB seed/migration and `admin:ensure-access`.
3. Run authenticated browser smoke for `/pos`, `/pos/demo`, `/docs`, `/inventory/products`, `/settings/permissions`, `/settings/locations`, `/settings/pos`, `/settings/promotions`, `/tax/rates`, `/tax/rules`, `/accounting/coa`, `/hr/checkin`, `/hr/leave`, `/account`, and `/audit`.
4. Continue the next sweep on remaining enterprise gaps: hardcoded i18n copy migration, absence scheduling, print parity, PII encryption verification, and MCP write-tool expansion.
