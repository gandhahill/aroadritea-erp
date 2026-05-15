# TASK.md — Active Implementation Tasks

> **Single source of truth runtime** for all implementation tasks being worked on (or to be worked on) by AI developers.
>
> AI **must** update this file before and after working. If the token limit ends mid-session, the next AI reads this file + relevant checkpoint to continue exactly from the stopping point.
>
> Full rules: `SYSTEM-DESIGN.md §37`.

---

## Status Legend

- 🟦 **PENDING** — scoped, not yet started
- 🟨 **IN_PROGRESS** — in progress, active checkpoint exists
- 🟩 **DONE** — completed, commit link available
- 🟥 **BLOCKED** — stalled, blocker notes present
- ⚪ **RESCHEDULED** — moved to a later scoped task, reason in Note column

---

## Active Tasks

> Only those with 🟨 or 🟥 status. Move to Done when finished.

| ID | Title | Owner | Started | Last Updated | Status | Note |
|----|-------|-------|---------|-------------|--------|------|
| T-0167 | Production readiness audit and critical fixes | Codex | 2026-05-15 13:03 | 2026-05-15 23:43 | 🟨 IN_PROGRESS | Local SoT/SD sweep patched POS client safety, CRUD gaps, HR shift/attendance, exports, product media, POS demo parity, worker scheduled jobs, stock alerts, and i18n gaps; typecheck/services tests/builds/MCP health/i18n/marker scans pass; next step is commit/push/deploy and authenticated ERP browser smoke |

---

## Done This Sprint (≤ 7 days)

> After 7 days, move to `docs/checkpoints/archive/` and delete from here.

### Phase 1 — Foundation + Accounting + Reporting + Tax + MCP + Infra

| ID | Title | Owner | Completed | Commit | Note |
|----|-------|-------|-----------|--------|------|
| T-0166 | Fix ERP sidebar 404 links, Docs page, and language switcher | Codex | 2026-05-15 | 3eab86b + bdb1b73 | Production smoke passed: protected routes redirect to login instead of 404; standalone PM2 runtime fixed; CSS assets 200 |
| T-0001 | Scaffold pnpm workspace + apps/web baseline + packages skeleton | Claude Opus 4.6 | 2026-05-06 | (initial) | |
| T-0002 | Drizzle ORM config + IAM schema (8 tables, relations) | Antigravity | 2026-05-06 | wip(T-0002) | |
| T-0003 | Tailwind v4 + brand tokens + globals.css + login UI | Antigravity | 2026-05-06 | wip(T-0003) | |
| T-0004 | `packages/shared` full impl (ULID, Money, Date, Types, i18n) | Antigravity | 2026-05-06 | wip(T-0004) | |
| T-0005 | IAM seed (tenant, 4 locations, 7 roles, 40+ permissions) | Antigravity | 2026-05-06 | wip(T-0005) | |
| T-0006 | Service `auth` (better-auth integration) + login UI | Antigravity | 2026-05-07 | verified | tests pass, typecheck clean |
| T-0007 | Service `iam.can()` permission engine + cache + tests | Antigravity | 2026-05-07 | verified | 17 tests pass |
| T-0008 | Accounting schema (periods, COA, journal, partners, tax_rates) | Antigravity | 2026-05-06 | wip(T-0008) | |
| T-0009 | COA seed (90+ accounts, trilingual, SAK ETAP) | Antigravity | 2026-05-06 | wip(T-0009) | |
| T-0010 | Result pattern + AppError (factories, combinators, 16 tests) | Antigravity | 2026-05-07 | wip(T-0010) | |
| T-0010b | Seed permissions modules `accounting`, `iam`, `tax` | Antigravity | 2026-05-07 | verified | permissions seeded in iam.ts |
| T-0011 | Schema journal_entries + journal_lines | Antigravity | 2026-05-07 | verified | accounting schema lines 81+ |
| T-0012 | Service `accounting.createJournal` + Zod input + Result type | Antigravity | 2026-05-07 | verified | 27 tests pass, typecheck clean |
| T-0013 | Service `accounting.postJournal` (balance check, period check, audit) | Antigravity | 2026-05-07 | verified | 17 tests pass, typecheck clean |
| T-0014 | Service `accounting.reverseJournal` | Antigravity | 2026-05-07 | verified | 18 tests pass, typecheck clean |
| T-0015 | Service `accounting.closePeriod` + getPeriodStatus | Antigravity | 2026-05-07 | verified | 19 tests pass, typecheck clean |
| T-0016 | Audit log schema (immutable, indexed, MCP-queryable) | Antigravity | 2026-05-07 | wip(T-0016) | |
| T-0016b | Service `audit.record` (audit log write) | Claude Opus 4.6 | 2026-05-09 | 33c822f | 292 tests pass, typecheck clean |
| T-0017 | UI `apps/web/(dash)/accounting/coa/` — COA browser tree + sidebar nav | Antigravity | 2026-05-08 | verified | typecheck clean, 152 tests pass |
| T-0018 | UI Journals list + detail page (table, search, filters, detail view) | Antigravity | 2026-05-08 | verified | typecheck clean, 152 tests pass |
| T-0019 | Service `tax.listRates` + `getRateByCode` + seed 6 tarif | Antigravity | 2026-05-07 | verified | 9 tests pass, typecheck clean |
| T-0019b | Schema `tax_rules` + seed default rules (6 rules) | Antigravity | 2026-05-07 | verified | schema added, seed runner updated, typecheck clean |
| T-0019c | Service `tax.resolve(context)` + `tax.calculate()` + tests | Antigravity | 2026-05-07 | verified | 27 tests pass, typecheck clean |
| T-0020 | Service `reporting.balanceSheet` + `profitLoss` + `trialBalance` | Antigravity | 2026-05-07 | verified | 18 tests pass, typecheck clean |
| T-0021 | UI Reporting pages (Trial Balance, Balance Sheet, P&L) | Antigravity | 2026-05-08 | verified | typecheck clean |
| T-0022 | i18n shell (next-intl) + messages id/en/zh + login i18n | Antigravity | 2026-05-06 | wip(T-0022) | |
| T-0023 | apps/mcp scaffolding + auth token + Phase 1 tools | Claude Opus 4.6 | 2026-05-09 | 3af9f81 | |
| T-0024 | MCP tools accounting (6 tools) | Claude Opus 4.6 | 2026-05-09 | included in T-0023 | |
| T-0025 | MCP tools reporting (5 tools) | Claude Opus 4.6 | 2026-05-09 | included in T-0023 | |
| T-0026 | Worker scaffolding + pg-boss (DB-driven cron) | Claude Opus 4.6 | 2026-05-09 | 2410084 | |
| T-0027 | Healthz endpoints for web, site, mcp | Claude Opus 4.6 | 2026-05-09 | 0594041 | |
| T-0028 | Docker Compose + Dockerfile + Caddyfile + CI/CD | Antigravity | 2026-05-09 | verified | typecheck clean |
| T-0029 | CI workflow (lint, typecheck, test, build) | Antigravity | 2026-05-09 | included in T-0028 | |
| T-0030 | Resilience tests scripts (4/8 Phase 1 scenarios) | Antigravity | 2026-05-09 | verified | scripts created |
| T-0031 | UI Settings → Scheduled Jobs (list, toggle, edit cron) | Antigravity | 2026-05-09 | verified | typecheck clean |

### Phase 2 — POS + Inventory + BOM + Purchasing

| ID | Title | Owner | Completed | Commit | Note |
|----|-------|-------|-----------|--------|------|
| T-0050 | Schema products, product_variants, product_modifiers, categories | Antigravity | 2026-05-09 | verified | typecheck clean |
| T-0051 | Schema stock_locations, stock_movements, stock_levels | Antigravity | 2026-05-09 | included in T-0050 | |
| T-0052 | Schema BOM + bom_lines + bom_substitutes | Antigravity | 2026-05-09 | included in T-0050 | |
| T-0053 | Service inventory CRUD products + variants + categories | Antigravity | 2026-05-09 | verified | typecheck clean |
| T-0054 | Service inventory.adjust (workflow approval) | Claude Opus 4.6 | 2026-05-09 | wip(T-0054) | createDraft → submit → approve → reject |
| T-0055 | Service inventory.transfer (2-step) | Claude Opus 4.6 | 2026-05-09 | included in T-0054 | Ship → receive workflow |
| T-0056 | Schema sales_orders + lines + payments + refunds + shifts | Antigravity | 2026-05-09 | verified | typecheck clean |
| T-0057 | Service pos.createSale + shift services | Claude Opus 4.6 | 2026-05-09 | 5226328 | 263 tests pass |
| T-0058 | Service pos.refund | Claude Opus 4.6 | 2026-05-09 | 2ac4c2e | 282 tests pass |
| T-0059+60 | POS UI: shift open/close + order entry + payment modal | Claude Opus 4.6 | 2026-05-10 | verified | typecheck clean; payment flow logic fixed |
| T-0061 | PWA setup (Serwist) + service worker + IndexedDB outbox | Claude Opus 4.6 | 2026-05-10 | 1d70ba0 | typecheck clean |
| T-0062 | POS offline sync endpoint `/api/sync/pos` (idempotency) | Claude Opus 4.6 | 2026-05-10 | included in T-0061 | |
| T-0064 | Service purchasing.createPO + workflow approval | Claude Opus 4.6 | 2026-05-11 | ac09649 | 351 tests pass, typecheck clean |
| T-0065 | Service purchasing.createGRN + confirmGRN + JE generator | Claude Opus 4.6 | 2026-05-11 | 2a585d8 | 385 tests pass, typecheck clean |

### Phase 2.5 — Stock Opname + Petty Cash + Reimbursement

| ID | Title | Owner | Completed | Commit | Note |
|----|-------|-------|-----------|--------|------|
| T-0067 | Schema petty_cash_accounts + petty_cash_transactions | Claude Opus 4.6 | 2026-05-10 | wip(T-0067) | |
| T-0068 | Service petty cash (balance, transactions, replenish) | Claude Opus 4.6 | 2026-05-10 | wip(T-0068) | 5 functions |
| T-0069 | UI petty cash (balance view + history) | Claude Opus 4.6 | 2026-05-10 | feat(T-0069) | 3 files + sidebar + i18n |
| T-0070 | Schema reimbursement_requests | Claude Opus 4.6 | 2026-05-10 | wip(T-0070) | |
| T-0071 | Service reimbursement (CRUD + workflow + escalation) | Claude Opus 4.6 | 2026-05-10 | wip(T-0071) | 7 functions |
| T-0072 | UI reimbursement | Claude Opus 4.6 | 2026-05-10 | wip(T-0072) | |
| T-0073 | Schema stock_opname_sessions + stock_opname_lines + stock_movement_manual | Claude Opus 4.6 | 2026-05-10 | fe2f2c8 | |
| T-0074 | Service import master Excel (Sheet 1) + movement log (Sheet 2) | Claude Opus 4.6 | 2026-05-10 | eb3e8ed | |
| T-0075 | Service stock opname session flow (generate → count → variance → approve) | Claude Opus 4.6 | 2026-05-10 | fe2f2c8 | |
| T-0076 | UI stock opname (session create + input fisik + approve variance) | Claude Opus 4.6 | 2026-05-10 | 68e4782 | |
| T-0077 | UI inventory variance dashboard + report (service + UI + XLSX export) | Claude Opus 4.6 | 2026-05-10 | 4dab99f | |
| T-0079 | Service journal attachments (upload + download) + MCP tools | Claude Opus 4.6 | 2026-05-10 | wip(T-0079) | 4 service + 2 MCP tools |
| T-0080 | UI journal attachments (list + delete + upload flow) | Claude Opus 4.6 | 2026-05-10 | d7e9680 | |
| T-0081a | Service pos.payment + donation/rounding flow | Claude Opus 4.6 | 2026-05-10 | 01afcc7 | donation.ts + JE + UI |
| T-0085b | Service reporting.dailySummary + payment breakdown + top products | Claude Opus 4.6 | 2026-05-10 | a3035f6 | |
| T-0085c | UI reporting/daily-summary (table + charts + export XLSX) | Antigravity | 2026-05-10 | c1fad34 | 292 tests pass |
| T-0085d | MCP tool reporting.get_daily_summary | Antigravity | 2026-05-10 | aeb78dd | |
| T-0085e | Service reporting.hourlySales + groupBy logic | Claude Opus 4.6 | 2026-05-11 | feat(T-0085e) | 3 files, 8 tests |
| T-0085f | UI reporting/hourly-sales (heatmap + table + export XLSX) | Claude Opus 4.6 | 2026-05-11 | feat(T-0085f) | 4 files, typecheck clean |
| T-0085g | MCP tool reporting.get_hourly_sales | Claude Opus 4.6 | 2026-05-11 | feat(T-0085g) | |
| T-0085h | Donation report — service + UI + MCP tool | Claude Opus 4.6 | 2026-05-10 | c3a40d1 | |
| T-0085j | Omzet Harian PB1-exclusive export (SD §25.5b, SoT §21.3b) | Claude Opus 4.6 | 2026-05-13 | e07bc00 | Schema, service, UI, XLSX, MCP tool |

### Phase 3 — Kitchen + KDS + Customer Display

| ID | Title | Owner | Completed | Commit | Note |
|----|-------|-------|-----------|--------|------|
| T-0081 | Service kitchen.generateQrPayload (strategy pattern dash/pipe) | Claude Opus 4.6 | 2026-05-11 | 90996f4 | 31 tests, strategy pattern |
| T-0082 | UI Settings → Integrations → Naixer KDS | Claude Opus 4.6 | 2026-05-11 | 88b8456 | CRUD + format config |
| T-0083 | Script seed-naixer-codes.ts (CSV import) | Claude Opus 4.6 | 2026-05-11 | 6fe303c | 22 tests, dry-run support |
| T-0084 | KDS Aroadri (production status: queued/making/ready) | Claude Opus 4.6 | 2026-05-11 | dadf8b4 | 26 tests, schema + service |
| T-0085i | Customer-facing display service (SSE) | Claude Opus 4.6 | 2026-05-11 | deb48bc | 11 tests, SSE + grouping |
| T-0086 | Schema naixer_product_codes + naixer_modifier_codes + naixer_qr_format_config | Claude Opus 4.6 | 2026-05-11 | 85654de | 3 tables + seed |
| T-0087 | POS Demo mode UI + IndexedDB sandbox | Claude Opus 4.6 | 2026-05-11 | 36d028a | 19 files, typecheck clean |

### Phase 4 — HR + Payroll + Attendance

| ID | Title | Owner | Completed | Commit | Note |
|----|-------|-------|-----------|--------|------|
| T-0100 | Schema employees + contracts + attendance + leaves | Claude Opus 4.6 | 2026-05-11 | e0f6a35 | |
| T-0101 | Service attendance check-in (mobile, GPS) | Claude Opus 4.6 | 2026-05-11 | e9eebc1 | |
| T-0102 | Payroll engine (PPh 21 progressive TER + runPayroll) | Claude Opus 4.6 | 2026-05-11 | ec839a7 | |
| T-0103 | Payroll approval + mark-paid + MCP tools + UI | Claude Opus 4.6 | 2026-05-11 | 959e9fe | Digital payslip UI is shipped; PDF export is optional enhancement |
| T-0104 | Warning letter SP1/SP2/SP3 (service + MCP + UI) | Claude Opus 4.6 | 2026-05-11 | f8150d3 | |

### Phase 5 — Public Website + CMS + Member + CRM + Loyalty

| ID | Title | Owner | Completed | Commit | Note |
|----|-------|-------|-----------|--------|------|
| T-0120 | Schema cms (pages, posts, banners, faqs, settings, revisions) | Claude Opus 4.6 | 2026-05-12 | 2aa4f35 | |
| T-0121 | Service cms (CRUD, publish, ISR webhook) | Claude Opus 4.6 | 2026-05-12 | 2aa4f35 | |
| T-0122 | apps/site scaffold (Next.js, i18n routing /id /en /zh) | Claude Opus 4.6 | 2026-05-12 | 8e121f5 | |
| T-0123 | Public pages: home, menu, about, locations shell | Claude Opus 4.6 | 2026-05-12 | d174a45 | CMS service integration completed in T-0121 |
| T-0124 | Schema members + member_otp_codes + member_signup_attempts + member_sessions | Claude Opus 4.6 | 2026-05-13 | 7eca03b | |
| T-0125 | Service member signup (OTP email + Turnstile + rate limit) | Claude Opus 4.6 | 2026-05-13 | 7eca03b | |
| T-0126 | Member portal /id/member/akun (point balance, QR card, history) | Claude Opus 4.6 | 2026-05-13 | 6249b38 | |
| T-0127 | Service crm + complaints + compensation tracking | Claude Opus 4.6 | 2026-05-13 | 1c23017 | |
| T-0128 | Service loyalty (points, tiers, vouchers) | Claude Opus 4.6 | 2026-05-13 | 1c23017 | loyalty earn in pos.createSale + redeemLoyaltyPoints |
| T-0129 | UI cms admin at `apps/web/(dash)/cms/` (CRUD form) | Claude Opus 4.6 | 2026-05-12 | 2aa4f35 | Structured content editor shipped; advanced block editing is optional enhancement |

### Phase 6 — MCP Expansion + Custom Field + Workflow Engine

| ID | Title | Owner | Completed | Commit | Note |
|----|-------|-------|-----------|--------|------|
| T-0150 | Schema custom_field_definitions + custom_field_values | Claude Opus 4.6 | 2026-05-12 | 9e22eb9 | |
| T-0151 | Service customfield CRUD + value validation | Claude Opus 4.6 | 2026-05-12 | 9e22eb9 | |
| T-0152 | UI Settings → Custom Fields | Claude Opus 4.6 | 2026-05-13 | b912783 | Entity tabs, CRUD modal, optimistic updates |
| T-0153 | Schema workflow_definitions + instances + steps | Claude Opus 4.6 | 2026-05-12 | 9e22eb9 | |
| T-0154 | Service workflow engine (rule eval + step execution) | Claude Opus 4.6 | 2026-05-12 | 9e22eb9 | |
| T-0155 | UI workflow definition editor | Claude Opus 4.6 | 2026-05-13 | 2f432bd | Condition builder, steps editor, JSON preview tab |
| T-0156 | Full MCP tools per module (cms, member, hr, payroll, crm, kitchen) | Claude Opus 4.6 | 2026-05-13 | 4a8ec8b | All tool handlers implemented (POS, HR, Audit done) |
| T-0157 | Production readiness config, security, Naixer print settings, HestiaCP README | Codex | 2026-05-13 | 6a7709d | UI-configurable POS/Naixer settings, login language selector, security hardening, HestiaCP docs |
| T-0158 | Expand README step-by-step deployment guide | Codex | 2026-05-13 | 15c3fd0 | README now covers local setup, HestiaCP deploy, update, rollback, troubleshooting |
| T-0159 | Switch automatic email to HestiaCP SMTP | Codex | 2026-05-13 | e7d86bb | OTP member and worker email now use HestiaCP SMTP mailbox via `SMTP_*`; docs/ADR updated |
| T-0160 | Switch VPS deployment runtime from Docker to PM2 | Codex | 2026-05-14 | 697cb98 | PM2 runtime deployed on VPS; site/web/MCP health checks OK |
| T-0161 | Final production hardening and smoke test | Codex | 2026-05-14 | b91cab0 | Production checks, redirect fix, i18n parity, public site CSS, SSH key verified |
| T-0162 | Public site polish + POS/accounting/tax production hardening | Codex | 2026-05-14 | c829e30 | Real menu/photos, member lookup flow, POS/accounting/tax fixes, worker fail-closed safety, PM2 deploy and health checks OK |
| T-0163 | Public site CSS fix, Yogyakarta-only locations, and production readiness audit | Codex | 2026-05-15 | aeeb295 | Tailwind CSS fixed on live site, Yogyakarta-only public locations seeded, POS/accounting/tax tests pass, PM2 deploy and live smoke checks OK |
| T-0164 | Public site brand/legal/i18n polish + office-aware COA correction | Codex | 2026-05-15 | 841f4fd | Normal sugar/ice added, legal pages/member i18n, outlet-only public site, legacy COA/POS defaults, bootstrap admin hardened, PM2 deploy and live smoke checks OK |
| T-0165 | Fix ERP staff login credential account integration | Codex | 2026-05-15 | 0cf676f | better-auth credential account schema, secure cookie middleware, root POS redirect, production login verified |

---

## Backlog

> Filled during initial scoping. AI picks from here when no Active Task can be continued.
> Completed tasks are moved to Done This Sprint and **removed from here**.

_(no items — all backlog tasks completed)_

---

## Effort Estimate

- **S** (Small): ≤ 1 AI session work day
- **M** (Medium): 1–2 days
- **L** (Large): 3–5 days
- **XL** (Extra Large): > 5 days, must be split before starting

---

## File Update Rules

1. **Add new task to Backlog**: AI that discovers a new need (e.g., from user discussion) adds entry to the Backlog section of the appropriate phase.
2. **Start a task**: move from Backlog → Active, fill in `Owner`, `Started`, `Last Updated`, create new checkpoint file at `docs/checkpoints/<id>-<slug>.checkpoint.md`.
3. **Update while working**: after writing 100+ lines of code or completing one Plan sub-step, update `Last Updated` in the table + fill in checkpoint.
4. **When stopping (token limit)**: **MANDATORY** write `## Next step` explicit and executable in checkpoint. Commit code with message `wip(T-XXXX): <brief>`.
5. **When done**: move to Done This Sprint, remove from Backlog & Active. Delete checkpoint from `docs/checkpoints/` after ≤ 7 days (or move to `archive/`).
6. **BLOCKED**: stay in Active with 🟥, fill Note column with blocker + tag who needs to decide.

## ID Format

- `T-NNNN` (4 digits, zero-padded), global increment. Avoid skipping.

## AI Handoff

- AI starting a new session: check Active → if there is IN_PROGRESS with `Last Updated` > 1 hour idle, may take over by updating `Owner`. If < 1 hour, **do not take over** (assume another session is still active).
