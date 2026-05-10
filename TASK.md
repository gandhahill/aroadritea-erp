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
- ⚪ **DEFERRED** — rescheduled, reason in Note column

---

## Active Tasks

> Only those with 🟨 or 🟥 status. Move to Done when finished.

| ID | Title | Owner | Started | Last Updated | Status | Note |
|----|-------|-------|---------|-------------|--------|------|
| T-0083 | Script seed-naixer-codes.ts (CSV import) | Claude Opus 4.6 | 2026-05-11 | 2026-05-11 | 🟨 IN_PROGRESS | ADR-0007 |

---

## Done This Sprint (≤ 7 days)

> After 7 days, move to `docs/checkpoints/archive/` and delete from here.

### Phase 1 — Foundation + Accounting + Reporting + Tax + MCP + Infra

| ID | Title | Owner | Completed | Commit |
|----|-------|-------|-----------|--------|
| T-0001 | Scaffold pnpm workspace + apps/web stub + packages skeleton | Claude Opus 4.6 | 2026-05-06 | (initial commit) |
| T-0002 | Drizzle ORM config + IAM schema (8 tables, relations) | Antigravity (Opus 4.6) | 2026-05-06 | wip(T-0002): drizzle iam |
| T-0003 | Tailwind v4 + brand tokens + globals.css + login UI | Antigravity (Opus 4.6) | 2026-05-06 | wip(T-0003): tailwind brand |
| T-0004 | `packages/shared` full impl (ULID, Money, Date, Types, i18n) | Antigravity (Opus 4.6) | 2026-05-06 | wip(T-0004): shared utils |
| T-0005 | IAM seed (tenant, 4 locations, 7 roles, 40+ permissions) | Antigravity (Opus 4.6) | 2026-05-06 | wip(T-0005): iam seed |
| T-0006 | Service `auth` (better-auth integration) + login UI | Antigravity (Opus 4.6) | 2026-05-07 | verified: tests pass, typecheck clean |
| T-0007 | Service `iam.can()` permission engine + cache + tests | Antigravity (Opus 4.6) | 2026-05-07 | verified: 17 tests pass |
| T-0008 | Accounting schema (periods, COA, journal, partners, tax_rates) | Antigravity (Opus 4.6) | 2026-05-06 | wip(T-0008): accounting schema |
| T-0009 | COA seed (90+ accounts, trilingual, SAK ETAP) | Antigravity (Opus 4.6) | 2026-05-06 | wip(T-0009): coa seed |
| T-0010 | Result pattern + AppError (factories, combinators, 16 tests) | Antigravity | 2026-05-07 | wip(T-0010): result+errors |
| T-0012 | Service `accounting.createJournal` + Zod input + Result type | Antigravity (Opus 4.6) | 2026-05-07 | verified: 27 tests pass, typecheck clean |
| T-0013 | Service `accounting.postJournal` (balance check, period check, audit) | Antigravity (Opus 4.6) | 2026-05-07 | verified: 17 tests pass, typecheck clean |
| T-0014 | Service `accounting.reverseJournal` | Antigravity (Opus 4.6) | 2026-05-07 | verified: 18 tests pass, typecheck clean |
| T-0015 | Service `accounting.closePeriod` + getPeriodStatus | Antigravity (Opus 4.6) | 2026-05-07 | verified: 19 tests pass, typecheck clean |
| T-0010b | Seed permissions modules `accounting`, `iam`, `tax` | Antigravity (Opus 4.6) | 2026-05-07 | verified: permissions seeded in iam.ts |
| T-0011 | Schema journal_entries + journal_lines | Antigravity (Opus 4.6) | 2026-05-07 | verified: accounting schema lines 81+ |
| T-0016 | Audit log schema (immutable, indexed, MCP-queryable) | Antigravity | 2026-05-07 | wip(T-0016): audit schema |
| T-0016b | Service `audit.record` (audit log write) | Claude Opus 4.6 | 2026-05-09 | 33c822f: 292 tests pass, typecheck clean |
| T-0017 | UI `apps/web/(dash)/accounting/coa/` — COA browser tree + sidebar nav | Antigravity (Opus 4.6) | 2026-05-08 | verified: typecheck clean, 152 tests pass |
| T-0018 | UI Journals list + detail page (table, search, filters, detail view) | Antigravity (Opus 4.6) | 2026-05-08 | verified: typecheck clean, 152 tests pass |
| T-0019 | Service `tax.listRates` + `getRateByCode` + seed 6 tarif | Antigravity (Opus 4.6) | 2026-05-07 | verified: 9 tests pass, typecheck clean |
| T-0019b | Schema `tax_rules` + seed default rules (6 rules) | Antigravity (Opus 4.6) | 2026-05-07 | verified: schema added, seed runner updated, typecheck clean |
| T-0019c | Service `tax.resolve(context)` + `tax.calculate()` + tests | Antigravity (Opus 4.6) | 2026-05-07 | verified: 27 tests pass, typecheck clean |
| T-0020 | Service `reporting.balanceSheet` + `profitLoss` + `trialBalance` | Antigravity (Opus 4.6) | 2026-05-07 | verified: 18 tests pass, typecheck clean |
| T-0021 | UI Reporting pages (Trial Balance, Balance Sheet, P&L) | Antigravity (Opus 4.6) | 2026-05-08 | verified: typecheck clean |
| T-0022 | i18n shell (next-intl) + messages id/en/zh + login i18n | Antigravity (Opus 4.6) | 2026-05-06 | wip(T-0022): i18n shell |
| T-0023 | apps/mcp scaffolding + auth token + Phase 1 tools | Claude Opus 4.6 | 2026-05-09 | 3af9f81 |
| T-0024 | MCP tools accounting (6 tools) | Claude Opus 4.6 | 2026-05-09 | included in T-0023 |
| T-0025 | MCP tools reporting (5 tools) | Claude Opus 4.6 | 2026-05-09 | included in T-0023 |
| T-0026 | Worker scaffolding + pg-boss (DB-driven cron) | Claude Opus 4.6 | 2026-05-09 | 2410084 |
| T-0027 | Healthz endpoints for web, site, mcp | Claude Opus 4.6 | 2026-05-09 | 0594041 |
| T-0028 | Docker Compose + Dockerfile + Caddyfile + CI/CD | Antigravity (Opus 4.6) | 2026-05-09 | verified: typecheck clean |
| T-0029 | CI workflow (lint, typecheck, test, build) | Antigravity (Opus 4.6) | 2026-05-09 | included in T-0028 |
| T-0030 | Resilience tests scripts (4/8 Phase 1 scenarios) | Antigravity (Opus 4.6) | 2026-05-09 | verified: scripts created |
| T-0031 | UI Settings → Scheduled Jobs (list, toggle, edit cron) | Antigravity (Opus 4.6) | 2026-05-09 | verified: typecheck clean |

### Phase 2 — POS + Inventory + BOM + Purchasing

| ID | Title | Owner | Completed | Commit |
|----|-------|-------|-----------|--------|
| T-0050 | Schema products, product_variants, product_modifiers, categories | Antigravity (Opus 4.6) | 2026-05-09 | verified: typecheck clean |
| T-0051 | Schema stock_locations, stock_movements, stock_levels | Antigravity (Opus 4.6) | 2026-05-09 | included in T-0050 |
| T-0052 | Schema BOM + bom_lines + bom_substitutes | Antigravity (Opus 4.6) | 2026-05-09 | included in T-0050 |
| T-0053 | Service inventory CRUD products + variants + categories | Antigravity (Opus 4.6) | 2026-05-09 | verified: typecheck clean |
| T-0054 | Service inventory.adjust (workflow approval) | Claude Opus 4.6 | 2026-05-09 | wip(T-0054): inventory adjust+transfer | createDraft → submit → approve → reject |
| T-0055 | Service inventory.transfer (2-step) | Claude Opus 4.6 | 2026-05-09 | included in T-0054 | Ship → receive workflow |
| T-0056 | Schema sales_orders + lines + payments + refunds + shifts | Antigravity (Opus 4.6) | 2026-05-09 | verified: typecheck clean | |
| T-0057 | Service pos.createSale + shift services | Claude Opus 4.6 | 2026-05-09 | 5226328: 263 tests pass | |
| T-0058 | Service pos.refund | Claude Opus 4.6 | 2026-05-09 | 2ac4c2e: 282 tests pass | |
| T-0059+60 | POS UI: shift open/close + order entry + payment modal | Claude Opus 4.6 | 2026-05-10 | typecheck clean | Payment flow logic fixed |
| T-0061 | PWA setup (Serwist) + service worker + IndexedDB outbox | Claude Opus 4.6 | 2026-05-10 | 1d70ba0: typecheck clean | |
| T-0062 | POS offline sync endpoint `/api/sync/pos` (idempotency) | Claude Opus 4.6 | 2026-05-10 | included in T-0061 | |

### Phase 2.5 — Stock Opname

| ID | Title | Owner | Completed | Commit | Note |
|----|-------|-------|-----------|--------|------|
| T-0073 | Schema stock_opname_sessions + stock_opname_lines + stock_movement_manual | Claude Opus 4.6 | 2026-05-10 | fe2f2c8 | |
| T-0074 | Service import master Excel (Sheet 1) + movement log (Sheet 2) | Claude Opus 4.6 | 2026-05-10 | eb3e8ed | |
| T-0075 | Service stock opname session flow (generate → count → variance → approve) | Claude Opus 4.6 | 2026-05-10 | fe2f2c8 | |
| T-0076 | UI stock opname (session create + input fisik + approve variance) | Claude Opus 4.6 | 2026-05-10 | 68e4782 | |
| T-0077 | UI inventory variance dashboard + report (service + UI + XLSX export) | Claude Opus 4.6 | 2026-05-10 | 4dab99f | 6 files |
| T-0080 | UI journal attachments (list + delete + upload placeholder) | Claude Opus 4.6 | 2026-05-10 | d7e9680 | 4 files |
| T-0079 | Service journal attachments (upload + download) + MCP tools | Claude Opus 4.6 | 2026-05-10 | wip(T-0079): journal attachments | 4 service + 2 MCP tools |
| T-0069 | UI petty cash (balance view + history) | Claude Opus 4.6 | 2026-05-10 | feat(T-0069): petty cash UI | 3 files + sidebar + i18n |
| T-0067 | Schema petty_cash_accounts + petty_cash_transactions | Claude Opus 4.6 | 2026-05-10 | wip(T-0067): petty cash schema | |
| T-0068 | Service petty cash (balance, transactions, replenish) | Claude Opus 4.6 | 2026-05-10 | wip(T-0068): petty cash service | 5 functions |
| T-0070 | Schema reimbursement_requests | Claude Opus 4.6 | 2026-05-10 | wip(T-0070): reimbursement schema | |
| T-0071 | Service reimbursement (CRUD + workflow + escalation) | Claude Opus 4.6 | 2026-05-10 | wip(T-0071): reimbursement service | 7 functions |
| T-0085b | Service reporting.dailySummary + payment breakdown + top products | Claude Opus 4.6 | 2026-05-10 | a3035f6 | |
| T-0085c | UI reporting/daily-summary (table + charts + export XLSX) | Antigravity (Opus 4.6) | 2026-05-10 | c1fad34 | 292 tests pass |
| T-0085d | MCP tool reporting.get_daily_summary | Antigravity (Opus 4.6) | 2026-05-10 | aeb78dd | |
| T-0081a | Service pos.payment + donation/rounding flow | Claude Opus 4.6 | 2026-05-10 | 01afcc7 | donation.ts + JE + UI |
| T-0085h | Donation report — service + UI + MCP tool | Claude Opus 4.6 | 2026-05-10 | c3a40d1 | 9 files |
| T-0085e | Service reporting.hourlySales + groupBy logic | Claude Opus 4.6 | 2026-05-11 | feat(T-0085e): hourly sales service | 3 files, 8 tests |
| T-0085f | UI reporting/hourly-sales (heatmap + table + export XLSX) | Claude Opus 4.6 | 2026-05-11 | feat(T-0085f): hourly sales UI | 4 files, typecheck clean |
| T-0085g | MCP tool reporting.get_hourly_sales | Claude Opus 4.6 | 2026-05-11 | feat(T-0085g): MCP get_hourly_sales tool | 1 file |
| T-0064 | Service purchasing.createPO + workflow approval | Claude Opus 4.6 | 2026-05-11 | ac09649: 351 tests pass, typecheck clean | 6 files |
| T-0065 | Service purchasing.createGRN + confirmGRN + JE generator | Claude Opus 4.6 | 2026-05-11 | 2a585d8: 385 tests pass, typecheck clean | 5 files |

### Phase 3 — Kitchen + KDS + Customer Display

| ID | Title | Owner | Completed | Commit | Note |
|----|-------|-------|-----------|--------|------|
| T-0086 | Schema naixer_product_codes + naixer_modifier_codes + naixer_qr_format_config | Claude Opus 4.6 | 2026-05-11 | 85654de | 3 tables + seed |
| T-0081 | Service kitchen.generateQrPayload (strategy pattern dash/pipe) | Claude Opus 4.6 | 2026-05-11 | 90996f4 | 31 tests, strategy pattern |

---

## Backlog (scoped, not yet started)

> Filled during initial scoping. AI picks from here when no Active Task can be continued.
> Completed tasks are moved to Done This Sprint and **removed from here**.

### Phase 1 — Foundation + Accounting + Reporting + Tax + MCP + Infra

| ID | Title | Module | Spec link | Estimate |
|----|-------|--------|-----------|----------|
| _(empty — all Phase 1 tasks completed)_ | | | | |

### Phase 2 — POS + Inventory + BOM + Purchasing

| ID | Title | Module | Spec link | Estimate |
|----|-------|--------|-----------|----------|
| _(empty — all Phase 2 tasks completed)_ | | | | |

### Phase 3 — Kitchen + KDS + Customer Display

| ID | Title | Module | Spec link | Estimate |
|----|-------|--------|-----------|----------|
| T-0082 | UI Settings → Integrations → Naixer KDS | ui | SD §33.7 | L |
| T-0084 | KDS Aroadri (production status: queued/making/ready) | kitchen | SD §21.7 | L |
| T-0085 | Customer-facing display `/display/:location` (SSE) | display | SD §21.4 | M |
| T-0086 | POS Demo mode UI + IndexedDB sandbox | pos | SD §34, ADR-0008 | L |

### Phase 4 — HR + Payroll + Attendance

| ID | Title | Module | Spec link | Estimate |
|----|-------|--------|-----------|----------|
| T-0100 | Schema employees + contracts + attendance + leaves | hr | SD §9.6 | L |
| T-0101 | Service attendance check-in (mobile, GPS) | hr | SD §21.8 | L |
| T-0102 | Service payroll engine (PPh 21 progressive TER) | payroll | SD §19.5, §21.8 | XL |
| T-0103 | Service payroll.run + digital pay slip (PDF) | payroll | SD §21.8 | L |
| T-0104 | Warning letter workflow (SP1/SP2/SP3) + attachment | hr | SD §21.8 | M |

### Phase 5 — Public Website + CMS + Member + CRM + Loyalty

| ID | Title | Module | Spec link | Estimate |
|----|-------|--------|-----------|----------|
| T-0120 | Schema cms (pages, posts, banners, faqs, settings, revisions) | cms | SD §31.2, ADR-0003 | M |
| T-0121 | Service cms (CRUD, publish, ISR webhook) | cms | SD §31.4 | L |
| T-0122 | apps/site scaffold (Next.js, i18n routing /id /en /zh) | infra | SD §31.1 | M |
| T-0123 | Public pages: home, menu, about, locations, blog, contact | site | SD §31.1, SoT §22.2 | XL |
| T-0124 | Schema members + member_otp_codes + member_signup_attempts + member_sessions | member | SD §31.5, ADR-0004 | M |
| T-0125 | Service member signup (OTP email + Turnstile + rate limit) | member | SD §31.6, ADR-0004 | L |
| T-0126 | Member portal /id/member/akun (point balance, QR card, history) | site | SD §31.5, §31.7 | L |
| T-0127 | Service crm + complaints + compensation tracking | crm | SD §21.9 | M |
| T-0128 | Service loyalty (points, tiers, vouchers) | crm | SD §21.9 | L |
| T-0129 | UI cms admin at `apps/web/(dash)/cms/` (block editor) | ui | SD §31.3 | XL |

### Phase 6 — MCP Expansion + Custom Field + Workflow Engine

| ID | Title | Module | Spec link | Estimate |
|----|-------|--------|-----------|----------|
| T-0150 | Schema custom_field_definitions + custom_field_values | customfield | SD §9.9, §17 | M |
| T-0151 | Service customfield CRUD + value validation | customfield | SD §17 | M |
| T-0152 | UI Settings → Custom Fields | ui | SD §17.3 | L |
| T-0153 | Schema workflow_definitions + instances + steps | workflow | SD §9.10, §18 | M |
| T-0154 | Service workflow engine (rule eval + step execution) | workflow | SD §18 | XL |
| T-0155 | UI workflow definition editor | ui | SD §18 | L |
| T-0156 | Full MCP tools per module (cms, member, hr, payroll, crm, kitchen) | mcp | SD §16 | XL |
| T-0157 | Outage notification (uptime monitor + WA/email webhook) | infra | SD §35.1.6 | M |

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
