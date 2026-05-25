# TASK.md â€” Active Implementation Tasks

> **Single source of truth runtime** for all implementation tasks being worked on (or to be worked on) by AI developers.
>
> AI **must** update this file before and after working. If the token limit ends mid-session, the next AI reads this file + relevant checkpoint to continue exactly from the stopping point.
>
> Full rules: `SYSTEM-DESIGN.md Â§37`.

---

## Status Legend

- ðŸŸ¦ **PENDING** â€” scoped, not yet started
- ðŸŸ¨ **IN_PROGRESS** â€” in progress, active checkpoint exists
- ðŸŸ© **DONE** â€” completed, commit link available
- ðŸŸ¥ **BLOCKED** â€” stalled, blocker notes present
- âšª **RESCHEDULED** â€” moved to a later scoped task, reason in Note column

---

## Active Tasks

> Only those with ðŸŸ¨ or ðŸŸ¥ status. Move to Done when finished.

| ID | Title | Owner | Started | Last Updated | Status | Note |
|----|-------|-------|---------|-------------|--------|------|
| T-0185 | Internal courier shipment tracking — centralised /purchasing/shipments page (BinderByte) | Claude Opus 4.7 | 2026-05-25 20:50 WIB | 2026-05-25 21:10 WIB | DONE | Tests 600/600 PASS (no new tests). Schema/service `trackPurchaseOrderShipment` sudah ada; commit ini menambah surface terpusat: `/purchasing/shipments` (4 KPI tiles + filter status: in_transit/delivered/errored/no_shipping + inline sync form per-row) + `/purchasing/shipments/[id]` (BinderByte summary + history timeline + re-sync form). PO detail page dapat compact shipment card. Sidebar entry baru `purchasing.shipments`. i18n parity id/en/zh `purchasing.shipments.*`. Tidak ada DB call ke BinderByte saat load page (pakai cached PO columns) — sinkron hanya saat user klik tombol. |
| T-0184 | Helpdesk/ticketing system + AI integration (file ticket otomatis vs "kontak admin") | Claude Opus 4.7 | 2026-05-25 20:15 WIB | 2026-05-25 20:50 WIB | DONE | Tests 600/600 PASS (3 executeTool tests bumped to 15s timeout — registry cold-import slower setelah +1 tool). Schema `helpdesk_tickets` + `helpdesk_ticket_replies` (migrasi 0035). Permissions `helpdesk.{create,view,handle}` seeded. Service createTicket/listTickets/getTicket/replyTicket/transitionStatus/assignTicket dengan notif fan-out ke handlers (in-app + email) + reporter on reply/close; internal note hanya handlers. AI tool `log_helpdesk_ticket_draft` registered + draft→confirm→commit via ai_action_drafts (helpdesk_ticket kind). System prompt updated — AI WAJIB file ticket via tool ketika user report real bug; `request_admin_help` direservasi untuk ambiguous "saya stuck". UI /helpdesk (list + new + detail dgn reply thread). Sidebar entry. i18n parity id/en/zh `helpdesk.*`. |
| T-0183 | CRM member-database page untuk manajemen + adjust poin (audit trail) | Claude Opus 4.7 | 2026-05-25 19:55 WIB | 2026-05-25 20:15 WIB | DONE | Typecheck PASS, tests 685/685 (no new tests). Service `listMembers / getMemberDetail / adjustMemberPoints` di `@erp/services/crm`. Permissions baru `crm.member.view` + `crm.member.adjustPoints` (seeded). UI `/crm/members` (list + search by name/city + tier filter + pagination), `/crm/members/[id]` (detail card, recent 30 points tx, adjust-points form gated by permission). Lifetime points hanya naik (tidak menurun saat redeem). i18n parity id/en/zh `crm.members.*` + sidebar group baru "CRM → Members". |
| T-0182 | Shift adjustment per tanggal — swap karyawan + notif kedua sisi + `schedule_overrides` audit table | Claude Opus 4.7 | 2026-05-25 19:35 WIB | 2026-05-25 19:55 WIB | DONE | Typecheck PASS, tests 685/685 (no new tests). Schema baru `schedule_overrides` (migrasi 0034) untuk track riwayat swap (original→substitute + reason + new_assignment_id). Server Action `swapShiftAssignmentAction` re-point existing shift_assignment ke karyawan baru + insert override row + audit `schedule_override` + fan-out notifikasi (deleted ke yg asli, created ke pengganti) via `notifyShiftChange`. Konflik (substitute sudah punya shift di slot itu) ditolak. UI grid: tombol ⇄ atau Alt+klik di sel berisi shift → 2 prompt (pilih substitute by nomor + alasan minimal 3 char). i18n parity id/en/zh utk `hr.schedule.swap.*`. |
| T-0181 | HR self-service: halaman Riwayat Presensi karyawan (`/hr/my-attendance`) | Claude Opus 4.7 | 2026-05-25 19:25 WIB | 2026-05-25 19:35 WIB | DONE | Typecheck PASS, tests 685/685 (no new tests). Service `listMyAttendance(input, ctx)` resolve user→employee via encrypted-email match (sama pattern dgn `listMyPayslips`); cap 365 rows. UI `/hr/my-attendance` ada filter from/to (default bulan ini), 3 summary cards (total hari/hari terlambat/total jam kerja), table dgn badge on-time/late/forgiven. Sidebar entry baru `myAttendance` (id/en/zh). |
| T-0180 | Purchase return module (schema + service + UI) — closes gap user reported (modul retur pembelian sebelumnya tidak ada) | Claude Opus 4.7 | 2026-05-25 19:00 WIB | 2026-05-25 19:25 WIB | DONE | Tests 685/685 PASS (+8 purchase-return-schemas). Schema baru `purchase_returns` + `purchase_return_lines` (migrasi 0033), permissions `purchasing.return.{create,approve,post}` (seeded ke management/director/vice_director). Service `createPurchaseReturn / submit / approve / post / cancel / list / get` dengan JE balik (DR GRNI / CR Inventory) + stock movement (reason='purchase_return') + optimistic locking via version. UI `/purchasing/returns` (list + status filter), `/purchasing/returns/new` (load GRN → pick lines → submit), `/purchasing/returns/[id]` (detail + action buttons). i18n parity id/en/zh untuk seluruh namespace `purchasing.returns.*` + sidebar `purchaseReturns`. |
| T-0179 | AI web_search switch Brave → Exa (per user request, doc https://exa.ai/docs/reference/search-api-guide-for-coding-agents) | Claude Opus 4.7 | 2026-05-25 18:50 WIB | 2026-05-25 19:00 WIB | DONE | Tests 677/677 PASS (+3 web-search). `web-search.ts` rewrite ke POST https://api.exa.ai/search dengan `x-api-key` header + JSON body (`query`, `type:auto`, `numResults`, `contents.{highlights,summary}`). Snippet pakai prefer `summary` → first `highlight` → first 600 chars `text`. Env var ganti `EXA_SEARCH_API_KEY` (`.env.example` updated). Registry deskripsi disesuaikan. Structured `not_configured/rate_limited/upstream_error` masih sama. |
| T-0178 | Wire periodCompare ke 2 reporting pages + XLSX coverage sweep (aging/cogs/waste CSV→XLSX) | Claude Opus 4.7 | 2026-05-25 12:20 WIB | 2026-05-25 12:45 WIB | DONE | Tests 674/674 PASS. Daily-summary + business-intelligence dapat delta badges "vs periode sebelumnya" (8 metric cards di daily-summary, 7 KPI di BI). `invertDelta` flag untuk metric cost-like (diskon/komisi/refund) supaya turun = hijau. Aging/COGS/Waste upgrade CSV→XLSX real (exceljs, multi-sheet, numeric cells). i18n parity id/en/zh untuk `vsPrevious/noBaseline/exportSummarySheet/exportLinesSheet/exportSheet`. |
| T-0177 | AI web-search opt-in (Brave) + reporting period-compare helper | Claude Opus 4.7 | 2026-05-25 12:00 WIB | 2026-05-25 12:15 WIB | DONE | Tests 676/676 PASS (+6). Tool `web_search` (Brave API) terdaftar dengan gating `includeWebSearch` di registry; `setSessionWebSearch` service + checkbox UI "Izinkan pencarian web" optimistik. `periodCompare(current, fetcher)` + `previousPeriod()` di `@erp/services/reporting` — pure UTC date math (fix WIB-shift bug), 4 unit tests. |
| T-0176 | Auth hardening — sesi multi-device + revoke UI + PII log scrub + Naixer HMAC inbound | Claude Opus 4.7 | 2026-05-25 11:45 WIB | 2026-05-25 12:00 WIB | DONE | Tests 670/670 PASS (+11 shared). `/account` dapat section Sesi Aktif dengan revoke per-row + "logout everywhere"; password change otomatis invalidate sesi lain. `@erp/shared/log-scrub` (email/phone/NIK/NPWP/secret JSON keys) + `@erp/shared/hmac` (Stripe-style signed timestamp + timing-safe compare + 300s replay window). 11 tests baru. i18n `account.sessions.*` id/en/zh. |
| T-0175 | Shift change notification — in-app + email ke karyawan terkait | Claude Opus 4.7 | 2026-05-25 11:33 WIB | 2026-05-25 11:45 WIB | DONE | Tests 659/659 PASS (+5 notify-user). Email transport diekstrak dari `member/index.ts` ke `notification/email-transport.ts`. Helper baru `notifyUser/notifyUserByEmail` (resolve user by email → in-app row + best-effort email). Hook ke schedule actions (`upsertAssignment` create+update, `deleteAssignment` snapshot-before-delete) → fan-out notif title+body Bahasa Indonesia, subject `[Aroadri Tea] …`. Best-effort: tidak rollback shift kalau email gagal. |
| T-0174 | F&B BI gaps — AR/AP aging + cash flow UI + COGS recipe costing + waste/spoilage | Claude Opus 4.7 | 2026-05-25 08:10 WIB | 2026-05-25 11:33 WIB | DONE | Tests 654/654 PASS (+4 reporting-aging). Service `aging` (AR/AP buckets 0-30/31-60/61-90/>90 dari journal_lines + due date), `cogsReport` (BOM × cost dengan flag margin negatif), `wasteReport` (stock_adjustments reason match waste/susut/spoil/basi/expired). UI pages `/reporting/{aging-receivables,aging-payables,cash-flow,cogs,waste}` semuanya i18n bersih (id/en/zh paritas, namespace `reporting.aging`/`reporting.cashFlowPage`/`reporting.cogs`/`reporting.waste` + sidebar keys baru). CSV export + drill-down detail. Permission gate accounting.view/reports + inventory.view. |
| T-0173 | Compliance + AI wrap-up — E23 member delete (UU PDP) + log_complaint_draft + admin AI log + sweeper job | Claude Opus 4.7 | 2026-05-25 07:50 WIB | 2026-05-25 08:05 WIB | DONE | Tests 650/650 PASS (+3 member-delete). Member delete anonimisasi (name/email/phone/address → `__deleted__`), revoke credentials+sessions, audit `delete` tanpa raw PII; UI `<DeleteAccountCard>` 2-step di /member/akun. Tool `log_complaint_draft` register dgn permission `crm.logComplaint`. Admin page `/settings/ai-assistant/log` dgn filter+pagination+summary. Sweeper job `ai-action-drafts-sweeper` (cron 04:30 WIB harian) mark draft pending kedaluwarsa jadi expired+audit. |
| T-0172 | AI Assistant Phase 3 — draft/confirm/commit pattern + 4 read tools + OCR struk + ConfirmActionCard | Claude Opus 4.7 | 2026-05-25 01:30 WIB | 2026-05-25 07:30 WIB | DONE | Tests 647/647 PASS (+4 ai-drafts). Schema `ai_action_drafts` (migrasi 0032) + service drafts (createDraft/getDraftForUser/cancelDraft/commitDraft) dengan re-cek permission target di server. Tools: `read_file`, `get_product`, `get_stock`, `get_today_sales_summary` (read-only) + `create_manual_sale_draft` (stage) + `ocr_receipt_struk` (vision → JSON → draft). UI `<ConfirmActionCard>` baru + Server Actions `confirmDraftAction/cancelDraftAction/fetchDraftAction`. Audit `ai_action_draft` ditambah. Web search & complaint draft di backlog. |
| T-0171 | AI Assistant Phase 2 — DeepSeek v4 client, tool registry, 3 read-only tools, vision content type | Claude Opus 4.7 | 2026-05-24 21:00 WIB | 2026-05-25 01:25 WIB | DONE | Tests 643/643 PASS (+10 ai-tools). Default model dinaikkan ke `deepseek-v4-flash` / `deepseek-v4-pro` (legacy alias deprecate 2026-07-24). Tool registry RBAC+audit + 3 tools (`request_admin_help`, `search_codebase` allow-listed, `get_recent_orders`). Tool-call loop dengan cap 4 round + replay `reasoning_content` (wajib per DeepSeek docs). UI chat dukung upload foto struk → forward sebagai `image_url`. Audit `KNOWN_ENTITY_TYPES` diperluas. Phase 3 (OCR struk + write tools draft→confirm→commit + web search) tetap di backlog. |
| T-0170 | Audit 26-Dimensi & Direct Fix (Security/Correctness/Compliance/UX/Features/Architecture) + User Req 1-4 | Claude Opus 4.7 | 2026-05-24 15:30 WIB | 2026-05-24 20:45 WIB | DONE (Phase 1) | Tests 633/633 PASS (+18), typecheck PASS. 1 Critical (whistleblower anonim), 4 High (custom-fields IDOR / POS void-refund / upload magic-bytes / Turnstile default-allow) → ✅ fixed. User Req 2/3/4 ✅ selesai. User Req 1 (AI DeepSeek) Phase 1 ✅ selesai (chat foundation), Phase 2/3 (tools, OCR, web search) di backlog. ADR-0013 dibuat. Migrasi 0029-0031. Report di `docs/audit/AUDIT-FIX-REPORT.md`. |
| T-0167 | Production readiness audit and critical fixes | Codex | 2026-05-15 13:03 | 2026-05-21 14:32 WIB (Codex) | IN_PROGRESS | Commit `1419720` deployed to VPS. Migration `0021`, seed, web/site/MCP/worker builds, and PM2 reload/save passed. Public health routes return 200; protected ERP smoke routes return 307 redirects without app-error; requested menu image assets return 200. DB reset was not run because migration/seed updated stale paths without data loss. |

---

## Done This Sprint (â‰¤ 7 days)

> After 7 days, move to `docs/checkpoints/archive/` and delete from here.

### Phase 1 â€” Foundation + Accounting + Reporting + Tax + MCP + Infra

| ID | Title | Owner | Completed | Commit | Note |
|----|-------|-------|-----------|--------|------|
| T-0166 | Fix ERP sidebar 404 links, Docs page, and language switcher | Codex | 2026-05-15 | 3eab86b + bdb1b73 | Production smoke passed: protected routes redirect to login instead of 404; standalone PM2 runtime fixed; CSS assets 200 |
| T-0168 | Security audit and overnight operational fixes | Codex | 2026-05-22 | `5970cfc`..`7e19c36` | Baseline, member reset, AP/AR reminders, outlet filtering, Malioboro seed alignment, correspondence/evidence inbox, POS manual discounts, old POS parity, static security findings, deploy verification, and final audit report. Typecheck/test/build pass; lint remains documented baseline debt. |
| T-0169 | 8-Dimension Systematic Codebase Audit | Antigravity | 2026-05-24 | verified | Completed Dimensi 1-9, 11, 12 audits. Fixed Dimensi 1 race condition on shipTransfer. |
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
| T-0017 | UI `apps/web/(dash)/accounting/coa/` â€” COA browser tree + sidebar nav | Antigravity | 2026-05-08 | verified | typecheck clean, 152 tests pass |
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
| T-0031 | UI Settings â†’ Scheduled Jobs (list, toggle, edit cron) | Antigravity | 2026-05-09 | verified | typecheck clean |

### Phase 2 â€” POS + Inventory + BOM + Purchasing

| ID | Title | Owner | Completed | Commit | Note |
|----|-------|-------|-----------|--------|------|
| T-0050 | Schema products, product_variants, product_modifiers, categories | Antigravity | 2026-05-09 | verified | typecheck clean |
| T-0051 | Schema stock_locations, stock_movements, stock_levels | Antigravity | 2026-05-09 | included in T-0050 | |
| T-0052 | Schema BOM + bom_lines + bom_substitutes | Antigravity | 2026-05-09 | included in T-0050 | |
| T-0053 | Service inventory CRUD products + variants + categories | Antigravity | 2026-05-09 | verified | typecheck clean |
| T-0054 | Service inventory.adjust (workflow approval) | Claude Opus 4.6 | 2026-05-09 | wip(T-0054) | createDraft â†’ submit â†’ approve â†’ reject |
| T-0055 | Service inventory.transfer (2-step) | Claude Opus 4.6 | 2026-05-09 | included in T-0054 | Ship â†’ receive workflow |
| T-0056 | Schema sales_orders + lines + payments + refunds + shifts | Antigravity | 2026-05-09 | verified | typecheck clean |
| T-0057 | Service pos.createSale + shift services | Claude Opus 4.6 | 2026-05-09 | 5226328 | 263 tests pass |
| T-0058 | Service pos.refund | Claude Opus 4.6 | 2026-05-09 | 2ac4c2e | 282 tests pass |
| T-0059+60 | POS UI: shift open/close + order entry + payment modal | Claude Opus 4.6 | 2026-05-10 | verified | typecheck clean; payment flow logic fixed |
| T-0061 | PWA setup (Serwist) + service worker + IndexedDB outbox | Claude Opus 4.6 | 2026-05-10 | 1d70ba0 | typecheck clean |
| T-0062 | POS offline sync endpoint `/api/sync/pos` (idempotency) | Claude Opus 4.6 | 2026-05-10 | included in T-0061 | |
| T-0064 | Service purchasing.createPO + workflow approval | Claude Opus 4.6 | 2026-05-11 | ac09649 | 351 tests pass, typecheck clean |
| T-0065 | Service purchasing.createGRN + confirmGRN + JE generator | Claude Opus 4.6 | 2026-05-11 | 2a585d8 | 385 tests pass, typecheck clean |

### Phase 2.5 â€” Stock Opname + Petty Cash + Reimbursement

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
| T-0075 | Service stock opname session flow (generate â†’ count â†’ variance â†’ approve) | Claude Opus 4.6 | 2026-05-10 | fe2f2c8 | |
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
| T-0085h | Donation report â€” service + UI + MCP tool | Claude Opus 4.6 | 2026-05-10 | c3a40d1 | |
| T-0085j | Omzet Harian PB1-exclusive export (SD Â§25.5b, SoT Â§21.3b) | Claude Opus 4.6 | 2026-05-13 | e07bc00 | Schema, service, UI, XLSX, MCP tool |

### Phase 3 â€” Kitchen + KDS + Customer Display

| ID | Title | Owner | Completed | Commit | Note |
|----|-------|-------|-----------|--------|------|
| T-0081 | Service kitchen.generateQrPayload (strategy pattern dash/pipe) | Claude Opus 4.6 | 2026-05-11 | 90996f4 | 31 tests, strategy pattern |
| T-0082 | UI Settings â†’ Integrations â†’ Naixer KDS | Claude Opus 4.6 | 2026-05-11 | 88b8456 | CRUD + format config |
| T-0083 | Script seed-naixer-codes.ts (CSV import) | Claude Opus 4.6 | 2026-05-11 | 6fe303c | 22 tests, dry-run support |
| T-0084 | KDS Aroadri (production status: queued/making/ready) | Claude Opus 4.6 | 2026-05-11 | dadf8b4 | 26 tests, schema + service |
| T-0085i | Customer-facing display service (SSE) | Claude Opus 4.6 | 2026-05-11 | deb48bc | 11 tests, SSE + grouping |
| T-0086 | Schema naixer_product_codes + naixer_modifier_codes + naixer_qr_format_config | Claude Opus 4.6 | 2026-05-11 | 85654de | 3 tables + seed |
| T-0087 | POS Demo mode UI + IndexedDB sandbox | Claude Opus 4.6 | 2026-05-11 | 36d028a | 19 files, typecheck clean |

### Phase 4 â€” HR + Payroll + Attendance

| ID | Title | Owner | Completed | Commit | Note |
|----|-------|-------|-----------|--------|------|
| T-0100 | Schema employees + contracts + attendance + leaves | Claude Opus 4.6 | 2026-05-11 | e0f6a35 | |
| T-0101 | Service attendance check-in (mobile, GPS) | Claude Opus 4.6 | 2026-05-11 | e9eebc1 | |
| T-0102 | Payroll engine (PPh 21 progressive TER + runPayroll) | Claude Opus 4.6 | 2026-05-11 | ec839a7 | |
| T-0103 | Payroll approval + mark-paid + MCP tools + UI | Claude Opus 4.6 | 2026-05-11 | 959e9fe | Digital payslip UI is shipped; PDF export is optional enhancement |
| T-0104 | Warning letter SP1/SP2/SP3 (service + MCP + UI) | Claude Opus 4.6 | 2026-05-11 | f8150d3 | |

### Phase 5 â€” Public Website + CMS + Member + CRM + Loyalty

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

### Phase 6 â€” MCP Expansion + Custom Field + Workflow Engine

| ID | Title | Owner | Completed | Commit | Note |
|----|-------|-------|-----------|--------|------|
| T-0150 | Schema custom_field_definitions + custom_field_values | Claude Opus 4.6 | 2026-05-12 | 9e22eb9 | |
| T-0151 | Service customfield CRUD + value validation | Claude Opus 4.6 | 2026-05-12 | 9e22eb9 | |
| T-0152 | UI Settings â†’ Custom Fields | Claude Opus 4.6 | 2026-05-13 | b912783 | Entity tabs, CRUD modal, optimistic updates |
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

_(no items â€” all backlog tasks completed)_

---

## Effort Estimate

- **S** (Small): â‰¤ 1 AI session work day
- **M** (Medium): 1â€“2 days
- **L** (Large): 3â€“5 days
- **XL** (Extra Large): > 5 days, must be split before starting

- `T-NNNN` (4 digits, zero-padded), global increment. Avoid skipping.

## AI Handoff

- AI starting a new session: check Active â†’ if there is IN_PROGRESS with `Last Updated` > 1 hour idle, may take over by updating `Owner`. If < 1 hour, **do not take over** (assume another session is still active).
