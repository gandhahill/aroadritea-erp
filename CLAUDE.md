# CLAUDE.md — Guide for Claude Code

This document explains how Claude Code (and other AI assistants) work in the Aroadri Tea ERP repository. **Must be read before writing any code or making architectural recommendations.**

---

## 1. Project Context

This repository is a **custom ERP system** for **PT. Gandha Hill Catering Management Indonesia** (brand **Aroadri Tea**) — a Chinese-style bubble tea & dessert shop with active public outlets in Yogyakarta. Internal offices exist in Yogyakarta and Jakarta for ERP/accounting purposes, but public surfaces must show outlets only.

- **PIC + developer**: Lintang Maulana Zulfan (`lintangmaulanazulfan@gmail.com`)
- **Working language**: Bahasa Indonesia (for communication & documentation). Code comments may be in English.
- **Team communication**: WhatsApp.
- **AI/harness communication**: via Claude Code (this file) and the **MCP server** to be built (see §6).

---

## 2. Two Sources of Truth

This repository has **two** source-of-truth documents that are **mandatory to read** before making any changes:

📌 **`SOURCE-OF-TRUTH.md`** — source of truth for **business** (what is being built & why).
📌 **`SYSTEM-DESIGN.md`** — source of truth for **technical** (how it is built: stack, DB schema, architectural patterns, conventions).
📌 **`skills/`** — Reference directory. **If you need a specific skill or guide, you must read the relevant files in the `skills/` folder.**

Conflict rules:
- Business requirements questions → SOURCE-OF-TRUTH wins.
- Technical implementation questions → SYSTEM-DESIGN wins.

Before:
- Adding/changing DB schema → read **SYSTEM-DESIGN §8–§9**
- Adding a module or feature → read **SOURCE-OF-TRUTH** relevant section + **SYSTEM-DESIGN §21**
- Changing roles/permissions → read **SYSTEM-DESIGN §11**
- Adding a field/attribute → check if it needs a real DB column or the custom field engine (**SYSTEM-DESIGN §17**)
- Changing accounting/tax rules → read **SYSTEM-DESIGN §19–§20**
- Writing an MCP tool → read **SYSTEM-DESIGN §16**
- Writing offline POS code → read **SYSTEM-DESIGN §14**

If there is a new requirement that does not yet exist, **update the relevant document first** (SoT for business, SD for technical), then write the code.

Raw source (original questionnaire) is at `../ERP-Questionaire.pdf`. Use only as a last resort when both SoTs are silent.

---

## 3. Repository Status

When this document was written (2026-05-05), the repository **did not contain code** — still in the design phase. What existed:

```
ERP/
├── CLAUDE.md             ← this file (daily AI guide)
├── SOURCE-OF-TRUTH.md    ← business requirements specification (v1.3)
├── SYSTEM-DESIGN.md      ← technical system design for AI developer (v1.3)
├── TASK.md               ← active task register & backlog (runtime, AI MUST update)
├── brand-assets/
│   └── BRAND.md          ← logo, palette, typography, visual restrictions, UI guide
└── docs/
    ├── adr/              ← Architecture Decision Records
    │   ├── README.md     ← ADR index (10 ADRs decided)
    │   ├── 0001-stack-choice.md
    │   ├── 0002-monorepo-and-app-split.md
    │   ├── 0003-public-website-cms-architecture.md
    │   ├── 0004-member-registration-and-auth.md
    │   ├── 0005-build-vs-modify-existing-erp.md
    │   ├── 0006-design-system-anti-generic.md
    │   ├── 0007-naixer-qr-integration.md
    │   ├── 0008-pos-demo-mode-client-side.md
    │   ├── 0009-resilience-and-auto-recovery.md
    │   └── 0010-ppn-engine-opt-in.md
    ├── checkpoints/      ← state per IN_PROGRESS task
    │   ├── README.md     ← usage guide
    │   ├── TEMPLATE.checkpoint.md
    │   └── archive/      ← checkpoints older than 7 days
    └── runbook/          ← (to be filled: server outage, backup restore, etc.)
```

Once code starts being written, follow the structure in **SYSTEM-DESIGN.md §6** (Repository Layout).

### 3.1 Decided ADR List

| # | Title | Status | Message |
|---|-------|--------|---------|
| [0001](docs/adr/0001-stack-choice.md) | Technology Stack Choice | Accepted | Next.js 15 + Drizzle + managed Postgres; **no** Prisma/Bun/Odoo |
| [0002](docs/adr/0002-monorepo-and-app-split.md) | Monorepo + App Split | Accepted | 4 apps: `site` (public), `web` (ERP), `mcp`, `worker` |
| [0003](docs/adr/0003-public-website-cms-architecture.md) | Public Website + CMS | Accepted | Internal custom CMS + JAMstack ISR + Cloudflare CDN |
| [0004](docs/adr/0004-member-registration-and-auth.md) | Member Registration & Auth | Accepted | Email + OTP + Turnstile; sessions separate from ERP staff |
| [0005](docs/adr/0005-build-vs-modify-existing-erp.md) | Build vs Modify ERP Open Source | Accepted | Build custom — Odoo/ERPNext do not fit the 2 GB RAM constraint |
| [0006](docs/adr/0006-design-system-anti-generic.md) | Anti-Generic UI Design System | Accepted | Brand tokens + shadcn/ui override; lint rule bans `bg-white`, `text-zinc-*`, `border-slate-*` |
| [0007](docs/adr/0007-naixer-qr-integration.md) | Naixer KDS Integration via QR | Accepted | QR-only (no API); pluggable dash/pipe strategy; mapping master in DB |
| [0008](docs/adr/0008-pos-demo-mode-client-side.md) | POS Demo / Training Mode | Accepted | Client-side IndexedDB sandbox; never syncs to server; demo QR prefix `DEMO-` |
| [0009](docs/adr/0009-resilience-and-auto-recovery.md) | Resilience & Auto-Recovery | Accepted | PWA offline POS + Docker auto-restart + healthcheck + idempotency; RTO 2m, RPO 0 for POS |
| [0010](docs/adr/0010-ppn-engine-opt-in.md) | PPN Engine — Opt-In | Accepted | PB1 default, output PPN off for retail; engine ready for B2B via `tax_rules` |

When a new decision affects >1 module, changes a schema, or adds a major dependency → **must** write a new ADR in `docs/adr/`. Format: see `docs/adr/README.md`.

---

## 4. Architecture Summary

Full detail in **`SYSTEM-DESIGN.md`**. Operational summary:

- **Stack**: TypeScript + Next.js 15 (App Router) + Hono (MCP) + Drizzle ORM + managed PostgreSQL (Neon/Supabase) + Tailwind + shadcn/ui (brand-overridden) + better-auth + next-intl + Serwist (PWA).
- **Shape**: modular monolith in a pnpm workspace with 4 apps: `site` (public, aroadritea.com), `web` (ERP, erp.aroadritea.com), `mcp` (Hono), `worker` (cron + queue).
- **Three layers**: `apps/*` (transport) → `packages/services/*` (business logic, Result-typed) → `packages/db` (Drizzle schema).
- **Managed DB** separate from VPS (offloads RAM); VPS only runs compute (Next.js × 2 + MCP + worker + Caddy).

**Hard constraints**:
- VPS server **1 vCPU / 2 GB RAM / 60 GB disk** (upgraded from 1 GB on 2026-05-05) — Odoo/ERPNext/Frappe (≥ 4 GB) **remain excluded**.
- POS **must** be **PWA + offline mode + idempotent sync** (see SD §14, §35).
- Multilingual **ID/EN/ZH** from day one (see SD §13).
- **MCP server** required (see SD §16).
- Multi-branch via **`location_id` dimension** (see SD §12).
- Custom fields & permissions **database-driven**, not hardcoded (see SD §17, §11).
- **Distinctive UI** — not default shadcn (see SD §36, ADR-0006).
- **Naixer KDS** integration via **QR-only**, not API (see SD §33, ADR-0007).
- **POS Demo mode** required (client-side sandbox, no server sync) — see SD §34, ADR-0008.
- **Resilience**: RTO ≤ 2 minutes, RPO 0 for POS (see SD §35, ADR-0009).

---

## 5. Code Conventions (Pre-established)

### 5.1 Language & Comments
- **Code identifiers**: English (camelCase / PascalCase / snake_case per language convention).
- **Code comments**: Concise English. Only write a comment when the *why* is not obvious from the code.
- **UI strings**: via i18n key (do not hardcode Bahasa Indonesia in JSX/templates).
- **Commit messages**: English, conventional commits (`feat:`, `fix:`, `refactor:`, `docs:`, `chore:`).

### 5.2 Multilingual (i18n)
- All labels, buttons, column headers, validation messages → **must use i18n key**.
- Master data (products, categories, modifiers) stores `name_id`, `name_en`, `name_zh` columns (or JSON pattern `{ id, en, zh }`).
- Currency format: IDR (no decimals), thousand separator dot, decimal comma for locale ID; EN/ZH locales follow their own conventions.
- Date format: `YYYY-MM-DD` in database; UI display per locale.

### 5.3 Database Schema
- Every transactional table **must** have audit columns:
  - `id` (UUID or ULID)
  - `created_at`, `updated_at`, `deleted_at` (soft delete)
  - `created_by_user_id`, `updated_by_user_id`
  - `location_id` (except for global master tables)
  - `tenant_id` if multi-tenant is prepared for franchise
- **Audit trail** separate in `audit_log` table (entity_type, entity_id, action, before_json, after_json, user_id, timestamp).

### 5.4 Accounting (Special Rules)
- Every journal entry: **total debit = total credit** (server-side validation required).
- Every journal entry **must** have: `posting_date`, `location_id`, `currency=IDR`, `period_id`.
- COA follows **Appendix A of SOURCE-OF-TRUTH.md**, seeded at go-live. Do not add ad-hoc accounts from code — always via UI/migration that is tracked.
- Closed accounting periods **must not** accept new postings.

### 5.5 Security
- **Never** commit secrets (API keys, DB passwords, JWT secrets) to repo. Use `.env` + `.env.example`.
- User passwords: hash with **argon2id** or **bcrypt cost ≥ 12**.
- Personal data of employees & customers (KTP, NPWP, phone) → **encryption at rest** (per UU PDP law).
- HTTPS only in production. Session cookie: `Secure`, `HttpOnly`, `SameSite=Lax`.

### 5.6 Tax — Standing Rules
- **PB1/PBJT 10%, inclusive**: rate stored in `tax_rate` table, do not hardcode.
- **Output/Input PPN**: tracked per document, not just summary.
- Export format for **Coretax**: CSV/Excel per Coretax layout (current version at commit date).

### 5.7 Prohibitions
- ❌ Hardcode role check in middleware (`if user.role === 'admin'`) — use permission lookup in DB.
- ❌ Hardcode product menu / prices / tax rates in code.
- ❌ Add large libraries (>5 MB bundle / >100 MB node_modules) without discussion — small server.
- ❌ Mock database in integration tests — use real DB (or Testcontainers).
- ❌ Console.log in production code path.
- ❌ Skip pre-commit hook (`--no-verify`).
- ❌ Use generic Tailwind shadcn classes (`bg-white`, `text-zinc-*`, `border-slate-*`) in `apps/*` — must use `brand.*` tokens. See ADR-0006.
- ❌ Generate UI with raw default shadcn — always via `packages/ui/` that has been brand-overridden.
- ❌ Use Date.now() / setInterval for DB time — use `now()` SQL and server-side timers.
- ❌ Use `number` for money — use `Money` (bigint).
- ❌ Start a task without entry in `TASK.md` + checkpoint.
- ❌ Exit a session without updating checkpoint with explicit `Next step`.
- ❌ **STRICT PROHIBITION**: Hardcode Bahasa Indonesia (or any language) strings in UI components. ALL UI text must use i18n keys and be added to the translation JSON files (`en.json`, `id.json`, `zh.json`) immediately.
- ❌ **STRICT PROHIBITION**: Skip audit trails. Any transactional or state-changing action MUST include audit logs (either via audit columns in the table or an entry in the `audit_log` table).

---

## 5.8 TASK.md Workflow (Mandatory for Multi-Session AI)

Because AI has token limits, sessions can be interrupted mid-implementation. For continuity:

1. **`TASK.md` at repo root** = single source of truth for all tasks.
2. **`docs/checkpoints/<id>-<slug>.checkpoint.md`** = detailed notes per active task.
3. **Template**: `docs/checkpoints/TEMPLATE.checkpoint.md`.
4. **Specification**: `SYSTEM-DESIGN.md §37`.

### Quick rules (see SD §37 for full detail):

**Before starting work**:
- Read `TASK.md`. Find 🟨 IN_PROGRESS with owner idle > 1 hour → may take over. If < 1 hour, do not take over.
- If no active task to continue → pick from Backlog per phase.
- Move task from Backlog → Active, fill in Owner, Started, Last Updated, create new checkpoint.

**While working**:
- Update checkpoint every 100+ lines of code or each Plan sub-step completed.
- Update `Last Updated` field in TASK.md.

**When stopping (token limit / session ends)**:
- **MANDATORY** write `## Next step` **explicit and executable** in checkpoint.
- Good next step format: `"Edit X.ts line N, add function Y with signature ..., then run pnpm test ..."`.
- Commit code already written (even if incomplete) with message `wip(T-XXXX): <brief>`.
- **Push to GitHub**: always immediately push your commits to GitHub so that the work is backed up.

**When new AI resumes**:
- Read `TASK.md` → find 🟨 with most recent `Last Updated`.
- Read full checkpoint. Continue from `Next step`.
- **Do not guess**. If `Next step` is unclear → ask user.
- Update Owner in TASK.md to new AI.

**When done**:
- Update `TASK.md`: move to Done, fill in Commit.
- Update checkpoint: status 🟩 DONE.
- After 7 days → archive checkpoint to `docs/checkpoints/archive/`.

---

## 6. MCP Server (Differentiation Feature)

This ERP **must** expose a **Model Context Protocol** interface so local AIs (Gemini CLI, Claude Code, Google Antigravity, etc.) can:

- **Read**: query products, stock, journals, audit log, employees, payroll.
- **Write**: create purchase order, update inventory adjustment, create employee record, log complaint.
- **Audit**: read audit log + diff before/after.

MCP authentication: per-user token with scope = user's UI scope. Do not give MCP "super-user". MCP tools **must** go through the same permission engine as the UI.

When building a new feature, **always consider** a corresponding MCP tool — so AI can automate it.

---

## 7. Directory Structure (To Be Filled)

> Currently empty. After the initial scaffold, document the layout here. Example outline:
>
> ```
> ERP/
> ├── apps/
> │   ├── web/         # Next.js / SvelteKit / etc — main UI
> │   └── mcp-server/  # MCP server endpoint
> ├── packages/
> │   ├── db/          # ORM schema + migrations
> │   ├── shared/      # types, utils, i18n keys
> │   └── ui/          # shared components
> ├── docs/
> │   └── adr/         # Architecture Decision Records
> ├── SOURCE-OF-TRUTH.md
> └── CLAUDE.md
> ```

---

## 8. Development Workflow

1. **Before starting**: read issues / WhatsApp discussions + relevant section of SOURCE-OF-TRUTH.md.
2. **Branch**: `feat/...`, `fix/...`, `refactor/...`, `docs/...`.
3. **Commit small & often**, clear messages (see §5.1). **Always push your commits directly to GitHub.**
4. **Test**: write tests for accounting & tax logic (do not compromise). For light UI, minimal is acceptable.
5. **Self-review**: run lint + typecheck + test before commit.
6. **Update documents** if changes touch business requirements.
7. **Push**, deploy to staging, verify manually at the store (before push to prod).

---

## 9. Operational Reminders

- **PB1/PBJT inclusive** — *do not* add tax on top of the displayed selling price.
- **Delivery commission 20%** — net revenue GoFood/GrabFood/ShopeeFood = 80% × price.
- **Stock opname**: monthly global, weekly for tea + lemon.
- **Payroll date**: **8th** of every month.
- **Store hours**: 10:00–22:00 WIB.
- **Default UI language** for operational staff: **Bahasa Indonesia**. Directors: can switch to **Mandarin** or **English**.
- **Backup**: daily, weekly retention, off-site.

---

## 10. Open Questions

Open technical questions are in **`SYSTEM-DESIGN.md` §30** (Open Decisions / ADR Pointers).

Open business questions:
- [ ] 1/3/5 year vision → does it affect multi-tenant / franchise decisions from the start or not?
- [ ] Differentiation vs Chagee / Molly Tea (for system branding strategy).
- [ ] Detailed role descriptions (specific read/write data) — currently only a rough outline.
- [ ] Complete supplier list + payment terms (will be entered by user into the system later).
- [ ] Complete fixed asset list with acquisition value, date, useful life (in separate Excel file, needs import).
- [ ] Complete recipe / BOM list (will be entered by user after module is ready).
- [ ] Tax consultant confirmation: are retail F&B sales subject to PPN in addition to PB1 or not?

---

## 11. AI Memory (for Claude Code Sessions)

This repository already has user memory at `~/.claude/projects/D--KERJA-Aroadri-Tea-ERP/memory/`. Some key facts already stored:

- User is developer + sole project PIC; works solo.
- Working language: Bahasa Indonesia, WhatsApp coordination.
- Server constraint: **1 vCPU / 2 GB RAM / 60 GB disk** (upgraded from 1 GB on 2026-05-05).
- Module priority: Accounting → Reporting → Tax → POS → Inventory → Purchasing → Kitchen → HR → CRM.
- Raw source documents at `D:/KERJA/Aroadri Tea/`.
- Naixer KDS integration via QR-only (Format B dash default; Format A pipe as fallback). Vendor code list does not wait — user input via UI.
- POS required offline + demo mode client-side.
- Managed DB: **Neon** (Supabase fallback). Auth: **better-auth**.
- PPN engine **opt-in** — PB1 default for retail F&B; output PPN ready to be activated later for B2B via `tax_rules` table (see ADR-0010).

If any of this information changes (e.g., budget increases, team grows, server upgraded again), **update the memory** and this document simultaneously.

---

## 12. Pre-Flight Checklist (Before AI Writes Code)

Before AI writes the first code:

- [ ] Read relevant section of `SOURCE-OF-TRUTH.md`?
- [ ] Read relevant section of `SYSTEM-DESIGN.md`?
- [ ] Read all relevant ADRs (see §3.1)?
- [ ] Checked `TASK.md` for Active Tasks?
- [ ] If IN_PROGRESS with owner idle > 1 hour → ready to take over?
- [ ] If new task → already moved from Backlog to Active + checkpoint created?
- [ ] Know which module is touched, which files will be changed?
- [ ] No decisions to be made that are not yet in Open Decisions (SD §30)?
- [ ] **Are all UI strings extracted to i18n keys?** (DO NOT write hardcoded strings)
- [ ] **Are all state-changing actions logged in the audit trail?** (DO NOT skip audit)

If anything is unclear — **stop and ask the user**.

---

*This document was prepared 2026-05-05. Version 1.3 (2 GB RAM, ADR 0006-0010, TASK.md workflow, decisions resolved).*
