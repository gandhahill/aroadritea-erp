# Checkpoint — Remediation Batch 2026-05-30 (user live-testing feedback)

**Owner:** Claude Opus 4.8
**Status:** 🟨 IN_PROGRESS
**Started:** 2026-05-30
**Context:** User tested the deployed ERP and reported a series of runtime errors, UX gaps, and design questions across multiple messages. This checkpoint tracks the remediation.

---

## DONE (this session)

### 1. CRITICAL — Database schema drift reconciled (live Neon DB) 🟩
- **Symptom:** flood of `NeonDbError: column/relation does not exist` (employees.marital_status, invoices.amount_paid, sales_orders.parked_at/park_note, whistleblower_reports.location_id, helpdesk_tickets.sla_due_date, nsfp_blocks, mcp_tokens, correspondence_records.agenda_no, +many latent: production_batches, purchase_requisitions, rfqs, supplier_products, reservations, notifications, tax_invoices, withholding_taxes, cms_media_library, cash_advances …).
- **Root cause:** migration history corrupted by concurrent agents (duplicate 0033–0035 tags, journal drift). Schema (code) was ~15 migrations ahead of the live DB; migrations were never applied.
- **Fix:** `pnpm --filter @erp/db exec drizzle-kit push --force`. Reviewed dry-run first — **additive only** (CREATE TABLE IF NOT EXISTS, ADD COLUMN with defaults, SET DEFAULT, CREATE INDEX). NO DROP TABLE/COLUMN (only one unused index dropped). Verified 8 previously-missing tables/columns now exist.
- **⚠️ TECH DEBT:** push does NOT update the drizzle migration journal/`__drizzle_migrations`. Migration history is still inconsistent. **Until rebaselined, keep using `drizzle-kit push` for schema changes** (NOT `migrate`). A proper rebaseline (squash to a single baseline matching current schema, reset journal) is a separate task. DO NOT run `drizzle-kit migrate` against prod blindly.

### 2. IAM / permissions 🟩
- **#3b** Added `logistics.shipments.view` + `logistics.shipments.create` to `packages/db/seed/iam.ts` PERMISSIONS_SEED + granted to `management` and `store_manager` (director/vice_director get all). Re-seeded live DB — VERIFIED present + granted (114 perms, 417 mappings). This is why non-director managers couldn't create outgoing shipments before (perm didn't exist; only `*.*` director passed).
- **#2** `apps/web/app/(dash)/settings/permissions/actions.ts` `setRolePermission`: was hard-blocking the `*.*` wildcard grant for everyone. Now a holder of `*.*` (Director) CAN grant full access to a role. Error messages converted to i18n (`settings.permissions.errors.*`).
- **#6/#10** `permissions-matrix.tsx`: hardcoded "Role"/"Permission" → i18n (`roleSectionTitle`, `permissionColumn`); added a clarity hint banner (`settings.permissions.hint.*`) explaining per-page perms, module wildcard, `*.*`. Logistics perm descriptions include page paths (e.g. "Logistics › Outgoing Shipments") to address "which permission unlocks page X".

### 3. Outgoing shipments visibility — #3a 🟩 (decision: "Pembuat + manajer")
- `apps/web/app/(dash)/logistics/outgoing-shipments/actions.ts` `fetchOutgoingShipments`: non-global users now see only shipments they created (`createdBy = userId`) within their authorized locations; global-scope users (managers/director) see all.

### 4. /settings/users removed — #5 🟩 (decision: "Hapus, gabung ke HR")
- Removed nav entry + PATH_TO_MODULE in `sidebar.tsx`; deleted route folder `apps/web/app/(dash)/settings/users/`. Account + role management lives in HR (create-employee / update-employee-login).

### 5. pb1-monthly location UUID → dropdown — #4 🟩
- `tax/pb1-monthly/page.tsx` fetches all active locations; `client.tsx` renders a name `<select>` (was a raw text input showing the UUID).

### 6. Stock-ledger selector UI — #1 🟩
- `inventory/stock-ledger/page.tsx` rewritten: added `stock-ledger-filter.tsx` (product + location dropdowns → navigates with params). Also fixed a latent bug: tenantId defaulted to `'TENANT-001'` (always-empty) → now uses session tenant. Added `inventory.view` permission gate.

### 7. MCP token CRUD — 🟩 (user: "token MCP belum ada crud")
- **Discovery:** two token systems existed — `mcp_tokens` (settings page used it; stored token in PLAINTEXT — security bug; invalid `iam.token.write` perm) vs `apiTokens` (what `apps/mcp/src/auth.ts` actually verifies via SHA-256).
- **Fix:** new `packages/services/src/iam/api-token-service.ts` (mint/list/revoke against `apiTokens`, SHA-256 hash matching apps/mcp, raw token shown once, audit logged via `create`/`deactivate`). Rewrote `settings/mcp-tokens/actions.ts` + `mcp-tokens-client.tsx` (create form, show-once reveal+copy, revoke via ConfirmDialog, status badges). i18n added.

### i18n
- All new keys added to en/id/zh with parity maintained (**3908 keys each**). Scripts used a deep-merge (no clobber) and were deleted after use.

---

## REMAINING / TODO (next session)

### A. Coretax / DJP tax templates — #9 (user: "cek template resmi DJP/coretax")
- **Finding (researched 2026-05):** Since **1 Jan 2025** Coretax uses **XML import** (official **Excel template → DJP Converter → XML**), replacing the old e-Faktur desktop **CSV (FK/OF)** format. Current **XML template v1.6**, converter v1.5. Covers Faktur (keluaran/masukan), Bupot (PPh), SPT.
  - Official: pajak.go.id/reformdjp/coretax/template-xml-dan-converter-excel-ke-xml
- **Problem in code:** `packages/services/src/tax/efaktur.ts` `exportEFakturCsv` produces the OBSOLETE FK/OF CSV. `spt-masa.ts` / `withholding.ts` likely similar.
- **Recommended fix:** change exports to emit the **official DJP Excel template column layout** (more stable than chasing XML schema versions — user runs DJP's Excel→XML converter), for: Faktur Keluaran, Bupot PPh 23/26, SPT Masa PPN. DO NOT guess columns — download the official v1.6 Excel templates first and map exactly. Update `SYSTEM-DESIGN.md §19–20` + an ADR.

### B. Settings consolidation (user: "halaman settings terlalu banyak, gabungkan")
- 18 settings pages remain after removing Users. Sidebar is a flat list in `sidebar.tsx`.
- **Plan:** group into labelled sub-sections (no route changes = low risk), e.g.:
  - **Organisasi:** company, locations, bank-accounts, accounting
  - **Akses & Keamanan:** permissions, mcp-tokens
  - **Operasional:** pos, attendance, scheduled-jobs, notifications, custom-fields, workflow-editor
  - **Integrasi & AI:** integrations/naixer, ai-assistant (+log nested), mcp-tokens
  - **Penjualan:** promotions, loyalty
  - Consider merging `loyalty`↔`promotions`, and nesting `ai-assistant/log` under the ai-assistant page (drop its top-level sidebar item).
- Requires inspecting the sidebar render to support section headers. Defer route merges (risky).

### C. Cleanup — old `mcp-token-service.ts`
- `packages/services/src/iam/mcp-token-service.ts` (mintMcpToken/revokeMcpToken) is now UNUSED by the settings page, stores tokens in PLAINTEXT, and uses invalid `iam.token.write as any`. Confirm no other caller (grep) then delete it + drop the `mcp_tokens` table from schema (or repurpose). Keep `apiTokens` as the single token system.

### D. Enrich permission descriptions with page paths (#10)
- Only logistics perms currently name their page. Extend `PERMISSIONS_SEED` descriptions to reference the page each unlocks, then re-seed.

---

## NEXT STEP (explicit)
1. Read `$TEMP/tc2.log` result — confirm `apps/web` + `apps/mcp` typecheck PASS (services/site/db/etc already PASS). Fix any errors.
2. The CODE changes need **commit + push + deploy** to reach the live instance (DB changes are already live). Ask user before committing (git-safety).
3. Then pick up REMAINING A–D above.

## Verification done
- `packages/services` typecheck PASS (new api-token-service clean).
- Live DB: schema-sync verified (8 checks), logistics perms verified (4 roles granted).
- i18n parity en=id=zh=3908.
