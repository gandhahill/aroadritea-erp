# TASK.md — Active Implementation Tasks

> **Single source of truth runtime** untuk semua task implementasi yang sedang/akan dikerjakan AI developer.
>
> AI **wajib** update file ini sebelum dan sesudah bekerja. Bila token sesi habis di tengah jalan, AI berikutnya membaca file ini + checkpoint relevan untuk lanjut tepat dari titik berhenti.
>
> Aturan lengkap: `SYSTEM-DESIGN.md §37`.

---

## Legend Status

- 🟦 **PENDING** — sudah di-scope, belum dimulai
- 🟨 **IN_PROGRESS** — sedang dikerjakan, ada checkpoint aktif
- 🟩 **DONE** — selesai, ada link commit
- 🟥 **BLOCKED** — terhenti, ada catatan blocker
- ⚪ **DEFERRED** — dijadwal ulang, alasan di kolom Note

---

## Active Tasks (sedang dikerjakan)

> Hanya yang status 🟨 atau 🟥. Pindah ke Done setelah selesai.

| ID | Status | Title | Owner (AI model) | Started | Last Updated | Checkpoint | Phase | Note |
|----|--------|-------|------------------|---------|--------------|-----------|-------|------|
| _(none)_ | | | | | | | | |

---

## Done This Sprint (≤ 7 hari)

> Setelah 7 hari, pindahkan ke `docs/checkpoints/archive/` dan hapus dari sini.

| ID | Title | Owner | Completed | Commit / PR | Phase |
|----|-------|-------|-----------|-------------|-------|
| T-0001 | Scaffold pnpm workspace + apps/web stub + packages skeleton | Claude Opus 4.6 | 2026-05-06 | (initial commit) | 1 |
| T-0004 | `packages/shared` full impl (ULID, Money, Date, Types, i18n) | Antigravity (Opus 4.6) | 2026-05-06 | wip(T-0004): shared utils | 1 |
| T-0003 | Tailwind v4 + brand tokens + globals.css + login UI | Antigravity (Opus 4.6) | 2026-05-06 | wip(T-0003): tailwind brand | 1 |
| T-0002 | Drizzle ORM config + IAM schema (8 tables, relations) | Antigravity (Opus 4.6) | 2026-05-06 | wip(T-0002): drizzle iam | 1 |
| T-0008 | Accounting schema (periods, COA, journal, partners, tax_rates) | Antigravity (Opus 4.6) | 2026-05-06 | wip(T-0008): accounting schema | 1 |
| T-0005 | IAM seed (tenant, 4 locations, 7 roles, 40+ permissions) | Antigravity (Opus 4.6) | 2026-05-06 | wip(T-0005): iam seed | 1 |
| T-0009 | COA seed (90+ accounts, trilingual, SAK ETAP) | Antigravity (Opus 4.6) | 2026-05-06 | wip(T-0009): coa seed | 1 |
| T-0022 | i18n shell (next-intl) + messages id/en/zh + login i18n | Antigravity (Opus 4.6) | 2026-05-06 | wip(T-0022): i18n shell | 1 |
| T-0010 | Result pattern + AppError (factories, combinators, 16 tests) | Antigravity | 2026-05-07 | wip(T-0010): result+errors | 1 |
| T-0016 | Audit log schema (immutable, indexed, MCP-queryable) | Antigravity | 2026-05-07 | wip(T-0016): audit schema | 1 |
| T-0006 | Service `auth` (better-auth integration) + login UI | Antigravity (Opus 4.6) | 2026-05-07 | verified: tests pass, typecheck clean | 1 |
| T-0007 | Service `iam.can()` permission engine + cache + tests | Antigravity (Opus 4.6) | 2026-05-07 | verified: 17 tests pass | 1 |
| T-0012 | Service `accounting.createJournal` + Zod input + Result type | Antigravity (Opus 4.6) | 2026-05-07 | verified: 27 tests pass, typecheck clean | 1 |
| T-0013 | Service `accounting.postJournal` (balance check, period check, audit) | Antigravity (Opus 4.6) | 2026-05-07 | verified: 17 tests pass, typecheck clean | 1 |
| T-0014 | Service `accounting.reverseJournal` | Antigravity (Opus 4.6) | 2026-05-07 | verified: 18 tests pass, typecheck clean | 1 |
| T-0015 | Service `accounting.closePeriod` + getPeriodStatus | Antigravity (Opus 4.6) | 2026-05-07 | verified: 19 tests pass, typecheck clean | 1 |
| T-0019 | Service `tax.listRates` + `getRateByCode` + seed 6 tarif | Antigravity (Opus 4.6) | 2026-05-07 | verified: 9 tests pass, typecheck clean | 1 |
| T-0019b | Schema `tax_rules` + seed default rules (6 rules) | Antigravity (Opus 4.6) | 2026-05-07 | verified: schema added, seed runner updated, typecheck clean | 1 |
| T-0019c | Service `tax.resolve(context)` + `tax.calculate()` + tests | Antigravity (Opus 4.6) | 2026-05-07 | verified: 27 tests pass (16 calculate + 11 resolve), typecheck clean | 1 |
| T-0020 | Service `reporting.balanceSheet` + `profitLoss` + `trialBalance` | Antigravity (Opus 4.6) | 2026-05-07 | verified: 18 tests pass, typecheck clean | 1 |
| T-0017 | UI `apps/web/(dash)/accounting/coa/` — COA browser tree + sidebar nav | Antigravity (Opus 4.6) | 2026-05-08 | verified: typecheck clean, 152 tests pass | 1 |
| T-0018 | UI Journals list + detail page (table, search, filters, detail view) | Antigravity (Opus 4.6) | 2026-05-08 | verified: typecheck clean, 152 tests pass | 1 |
| T-0021 | UI Reporting pages (Trial Balance, Balance Sheet, P&L) | Antigravity (Opus 4.6) | 2026-05-08 | verified: typecheck clean | 1 |
| T-0023 | apps/mcp scaffolding + auth token + Phase 1 tools | Claude Opus 4.6 | 2026-05-09 | 3af9f81 | 1 |
| T-0026 | Worker scaffolding + pg-boss (DB-driven cron) | Claude Opus 4.6 | 2026-05-09 | 2410084 | 1 |
| T-0027 | Healthz endpoints for web, site, mcp | Claude Opus 4.6 | 2026-05-09 | 0594041 | 1 |
| T-0028 | Docker Compose + Dockerfile + Caddyfile + CI/CD | Antigravity (Opus 4.6) | 2026-05-09 | verified: typecheck clean | 1 |
| T-0029 | CI workflow (lint, typecheck, test, build) | Antigravity (Opus 4.6) | 2026-05-09 | included in T-0028 | 1 |
| T-0024 | MCP tools accounting (6 tools) | Claude Opus 4.6 | 2026-05-09 | included in T-0023 | 1 |
| T-0025 | MCP tools reporting (5 tools) | Claude Opus 4.6 | 2026-05-09 | included in T-0023 | 1 |
| T-0030 | Resilience tests scripts (4/8 Phase 1 scenarios) | Antigravity (Opus 4.6) | 2026-05-09 | verified: scripts created | 1 |
| T-0031 | UI Settings → Scheduled Jobs (list, toggle, edit cron) | Antigravity (Opus 4.6) | 2026-05-09 | verified: typecheck clean | 1 |
| T-0050 | Schema products, product_variants, product_modifiers, categories | Antigravity (Opus 4.6) | 2026-05-09 | verified: typecheck clean | 2 |
| T-0051 | Schema stock_locations, stock_movements, stock_levels | Antigravity (Opus 4.6) | 2026-05-09 | included in T-0050 | 2 |
| T-0052 | Schema BOM + bom_lines + bom_substitutes | Antigravity (Opus 4.6) | 2026-05-09 | included in T-0050 | 2 |
| T-0056 | Schema sales_orders + lines + payments + refunds + shifts | Antigravity (Opus 4.6) | 2026-05-09 | verified: typecheck clean | 2 |
| T-0063 | Schema purchase_orders + GRN + purchase_invoices | Antigravity (Opus 4.6) | 2026-05-09 | verified: typecheck clean | 2 |
| T-0053 | Service inventory CRUD products + variants + categories | Antigravity (Opus 4.6) | 2026-05-09 | verified: typecheck clean | 2 |

---

## Backlog (sudah di-scope, belum dimulai)

> Diisi saat scoping awal Phase 1. AI dapat memilih dari sini saat tidak ada Active Task yang dapat dilanjutkan.

### Phase 1 — Foundation + Accounting + Reporting + Tax

| ID | Title | Module | Spec link | Estimasi |
|----|-------|--------|-----------|----------|
| T-0001 | Scaffold pnpm workspace + apps/web stub + packages skeleton | infra | SD §6 | M |
| T-0002 | Setup Drizzle ORM + connection ke Neon Postgres | db | SD §5, §8 | S |
| T-0003 | Tailwind config + token brand + globals.css map shadcn vars | ui | SD §36, ADR-0006 | M |
| T-0004 | `packages/shared/{result,errors,money,id,date,types}` | shared | SD §7 | M |
| T-0005 | Schema IAM: users, roles, permissions, role_permissions, user_roles, sessions | iam | SD §9.1, §11 | M |
| T-0006 | Service `auth` (better-auth integration) + login UI | auth | SD §11 | L |
| T-0007 | Service `iam.can()` permission engine + cache + tests | iam | SD §11 | M |
| T-0008 | Schema accounting_periods, accounts (COA) | accounting | SD §9.2 | S |
| T-0009 | Seed COA dari SOURCE-OF-TRUTH Lampiran A | accounting | SoT App. A | S |
| T-0010 | Seed permissions modul `accounting`, `iam`, `tax` | iam | SD §11 | S |
| T-0011 | Schema journal_entries + journal_lines | accounting | SD §9.2 | M |
| T-0012 | Service `accounting.createJournal` + Zod input + Result type | accounting | SD §20 | M |
| T-0013 | Service `accounting.postJournal` (balance check, period check, audit) | accounting | SD §20 | L |
| T-0014 | Service `accounting.reverseJournal` | accounting | SD §20 | M |
| T-0015 | Service `accounting.closePeriod` + closing entry generator | accounting | SD §20.4 | L |
| T-0016 | Schema audit_log + trigger + service `audit.record` | audit | SD §15 | M |
| T-0017 | UI `apps/web/(dash)/accounting/coa/` (browser COA tree) | ui | SD §21.1 | M |
| T-0018 | UI `apps/web/(dash)/accounting/journals/` (list + create + post) | ui | SD §21.1 | L |
| T-0019 | Service `tax.listRates` + seed tarif PB1, PPN_OUT, PPN_IN, PPH21, PPH23, PPH25 | tax | SD §19.1 | S |
| T-0019b | Schema `tax_rules` + seed default rules (PB1 untuk retail channel, PPN_IN global) | tax | SD §19.3, ADR-0010 | S |
| T-0019c | Service `tax.resolve(context)` + `tax.calculate()` + tests | tax | SD §19.3.3 | M |
| T-0020 | Service `reporting.balanceSheet` + `profitLoss` + `trialBalance` | reporting | SD §21.2 | L |
| T-0021 | UI `apps/web/(dash)/reporting/` (Neraca + L/R + Trial Balance) | ui | SD §21.2 | L |
| T-0022 | i18n shell (next-intl) + messages dasar id/en/zh untuk modul accounting | i18n | SD §13 | M |
| T-0023 | apps/mcp scaffolding + auth token + tool `iam.whoami` | mcp | SD §16 | M |
| T-0024 | MCP tools accounting (createJournal, postJournal, listAccounts, closePeriod) | mcp | SD §16.4 | M |
| T-0025 | MCP tools reporting (balanceSheet, profitLoss, generalLedger) | mcp | SD §16.4 | M |
| T-0026 | apps/worker scaffolding + cron job structure (pg-boss) | infra | SD §35.1.4 | M |
| T-0027 | `/healthz` endpoint di apps/web + apps/site + apps/mcp | infra | SD §35.1.2 | S |
| T-0028 | Docker Compose + Dockerfile multi-stage + Caddyfile | infra | SD §26.3 | M |
| T-0029 | CI workflow (lint, typecheck, test, build) | infra | SD §26.1 | M |
| T-0030 | Resilience tests scripts (8 skenario di SD §35.2) | infra | SD §35.2 | L |
| T-0031 | UI Settings → Scheduled Jobs (CRUD cron schedules) | ui | SD §21.10 | M |

### Phase 2 — POS + Inventory + BOM + Purchasing

| ID | Title | Module | Spec link | Estimasi |
|----|-------|--------|-----------|----------|
| T-0050 | Schema products, product_variants, product_modifiers, categories | inventory | SD §9.3 | M |
| T-0051 | Schema stock_locations, stock_movements, stock_levels | inventory | SD §9.3 | M |
| T-0052 | Schema BOM + bom_lines + bom_substitutes | inventory | SD §9.3 | M |
| T-0053 | Service inventory CRUD products + variants | inventory | SD §21.5 | L |
| T-0054 | Service inventory.adjust (workflow approval) | inventory | SD §21.5 | M |
| T-0055 | Service inventory.transfer (2-step) | inventory | SD §21.5 | M |
| T-0056 | Schema sales_orders + lines + payments + refunds + shifts | pos | SD §9.5 | L |
| T-0057 | Service pos.createSale (online) + JE generator | pos | SD §21.4 | L |
| T-0058 | Service pos.refund | pos | SD §21.4 | M |
| T-0059 | Service pos.openShift / closeShift | pos | SD §21.4 | M |
| T-0060 | UI `apps/web/(dash)/pos/` order entry | ui | SD §21.4 | XL |
| T-0061 | PWA setup (Serwist) + service worker + IndexedDB outbox | pos | SD §14, §35.1.1 | L |
| T-0062 | POS offline sync endpoint `/api/sync/pos` (idempotency) | pos | SD §10.3, §14 | M |
| T-0063 | Schema purchase_orders + GRN + purchase_invoices | purchasing | SD §9.4 | M |
| T-0064 | Service purchasing.createPO + workflow approval | purchasing | SD §21.6 | L |
| T-0065 | Service purchasing.createGRN + JE generator | purchasing | SD §21.6 | M |

### Phase 3 — Kitchen + KDS + Customer Display

| ID | Title | Module | Spec link | Estimasi |
|----|-------|--------|-----------|----------|
| T-0080 | Schema naixer_product_codes, naixer_modifier_codes, naixer_qr_format_config | kitchen | SD §33.2 | S |
| T-0081 | Service kitchen.generateQrPayload (strategy pattern dash/pipe) | kitchen | SD §33.3, ADR-0007 | M |
| T-0082 | UI Settings → Integrations → Naixer KDS | ui | SD §33.7 | L |
| T-0083 | Skrip seed-naixer-codes.ts (CSV import) | infra | ADR-0007 | S |
| T-0084 | KDS Aroadri (status produksi: queued/making/ready) | kitchen | SD §21.7 | L |
| T-0085 | Customer-facing display `/display/:location` (SSE) | display | SD §21.4 | M |
| T-0086 | POS Demo mode UI + IndexedDB sandbox | pos | SD §34, ADR-0008 | L |

### Phase 4 — HR + Payroll + Attendance

| ID | Title | Module | Spec link | Estimasi |
|----|-------|--------|-----------|----------|
| T-0100 | Schema employees + contracts + attendance + leaves | hr | SD §9.6 | L |
| T-0101 | Service attendance check-in (mobile, GPS) | hr | SD §21.8 | L |
| T-0102 | Service payroll engine (PPh 21 progresif TER) | payroll | SD §19.5, §21.8 | XL |
| T-0103 | Service payroll.run + slip gaji digital (PDF) | payroll | SD §21.8 | L |
| T-0104 | Workflow surat peringatan (SP1/SP2/SP3) + attachment | hr | SD §21.8 | M |

### Phase 5 — Public Website + CMS + Member + CRM + Loyalty

| ID | Title | Module | Spec link | Estimasi |
|----|-------|--------|-----------|----------|
| T-0120 | Schema cms (pages, posts, banners, faqs, settings, revisions) | cms | SD §31.2, ADR-0003 | M |
| T-0121 | Service cms (CRUD, publish, ISR webhook) | cms | SD §31.4 | L |
| T-0122 | apps/site scaffold (Next.js, i18n routing /id /en /zh) | infra | SD §31.1 | M |
| T-0123 | Halaman publik: beranda, menu, tentang, lokasi, blog, kontak | site | SD §31.1, SoT §22.2 | XL |
| T-0124 | Schema members + member_otp_codes + member_signup_attempts + member_sessions | member | SD §31.5, ADR-0004 | M |
| T-0125 | Service member signup (OTP email + Turnstile + rate limit) | member | SD §31.6, ADR-0004 | L |
| T-0126 | Member portal /id/member/akun (saldo poin, kartu QR, riwayat) | site | SD §31.5, §31.7 | L |
| T-0127 | Service crm + complaints + compensation tracking | crm | SD §21.9 | M |
| T-0128 | Service loyalty (points, tiers, vouchers) | crm | SD §21.9 | L |
| T-0129 | UI cms admin di `apps/web /(dash)/cms/` (block editor) | ui | SD §31.3 | XL |

### Phase 6 — MCP Expansion + Custom Field + Workflow Engine

| ID | Title | Module | Spec link | Estimasi |
|----|-------|--------|-----------|----------|
| T-0150 | Schema custom_field_definitions + custom_field_values | customfield | SD §9.9, §17 | M |
| T-0151 | Service customfield CRUD + value validation | customfield | SD §17 | M |
| T-0152 | UI Settings → Custom Fields | ui | SD §17.3 | L |
| T-0153 | Schema workflow_definitions + instances + steps | workflow | SD §9.10, §18 | M |
| T-0154 | Service workflow engine (rule eval + step execution) | workflow | SD §18 | XL |
| T-0155 | UI workflow definition editor | ui | SD §18 | L |
| T-0156 | MCP tools penuh per modul (cms, member, hr, payroll, crm, kitchen) | mcp | SD §16 | XL |
| T-0157 | Notifikasi outage (uptime monitor + WA/email webhook) | infra | SD §35.1.6 | M |

---

## Estimasi Effort
- **S** (Small): ≤ 1 hari kerja AI sesi
- **M** (Medium): 1–2 hari
- **L** (Large): 3–5 hari
- **XL** (Extra Large): > 5 hari, perlu di-split sebelum mulai

---

## Aturan Update File Ini

1. **Tambah task baru di Backlog**: AI yang menemukan kebutuhan baru (mis. dari diskusi user) tambah entry di section Backlog yang sesuai phase.
2. **Mulai task**: pindahkan dari Backlog ke Active, isi `Owner`, `Started`, `Last Updated`, buat file checkpoint baru di `docs/checkpoints/<id>-<slug>.checkpoint.md`.
3. **Update saat bekerja**: setelah menulis 100+ baris code atau menyelesaikan satu sub-step, update `Last Updated` di tabel + isi checkpoint.
4. **Saat berhenti (token limit)**: WAJIB tulis `Next step` eksplisit di checkpoint. Commit dengan pesan `wip(T-XXXX): <ringkas>`.
5. **Saat selesai**: pindah ke Done, isi Commit. Hapus checkpoint dari `docs/checkpoints/` setelah ≤ 7 hari (atau pindah ke `archive/`).
6. **BLOCKED**: tetap di Active dengan 🟥, isi kolom Note dengan blocker + tag siapa yang harus memutuskan.

## ID Format
- `T-NNNN` (4 digit, zero-padded), increment global. Hindari skip.

## Pembagian Antar AI
- AI yang baru memulai sesi: cek Active → jika ada IN_PROGRESS dengan `Last Updated` > 1 jam idle, boleh ambil alih dengan update `Owner`. Jika < 1 jam, **jangan ambil alih** (asumsi sesi lain masih aktif).
