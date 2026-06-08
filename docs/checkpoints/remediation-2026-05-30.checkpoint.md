# Checkpoint — Remediation Batch 2026-05-30 (user live-testing feedback)

**Owner:** Codex
**Status:** 🟨 IN_PROGRESS
**Started:** 2026-05-30
**Last updated:** 2026-06-08 21:45 WIB
**Context:** User tested the deployed ERP and reported a series of runtime errors, UX gaps, and design questions across multiple messages. This checkpoint tracks the remediation.

---

## CURRENT SESSION — Settings consolidation (2026-06-08)

Goal: reduce Settings navigation overload by turning `/settings` into a grouped hub and trimming the Settings sidebar children to a few consolidated entry points. Keep existing individual routes reachable from the hub so mutation actions and audit trails continue through the existing server actions.

Plan:
1. [x] Replace `/settings` redirect with grouped Settings hub cards.
2. [x] Reduce Settings sidebar children to consolidated hub entries plus account/audit.
3. [x] Add i18n keys for all hub/sidebar labels in `en/id/zh`.
4. [x] Fix touched hardcoded settings forbidden copy where encountered.
5. [x] Run web typecheck/build.

Done:
- `apps/web/app/(dash)/settings/settings-hub.tsx` added permission-aware grouped Settings hub.
- New group routes added: `/settings/organization`, `/settings/sales-pos`, `/settings/automation`, `/settings/access-security`, `/settings/integrations`.
- `apps/web/app/(dash)/settings/page.tsx` now renders the hub instead of redirecting to locations.
- `apps/web/app/(dash)/sidebar.tsx` now shows six Settings children instead of the old flat list of individual settings pages.
- `apps/web/messages/{en,id,zh}.json` gained parity keys for hub cards and grouped sidebar labels.
- `apps/web/app/(dash)/settings/loyalty/page.tsx` no longer hardcodes the forbidden Bahasa Indonesia copy.

Verification:
- i18n parity script: PASS (`en/id/zh` all 4604 leaf keys; missing/extra 0).
- `pnpm --filter @erp/web typecheck`: PASS.
- `pnpm --filter @erp/web build`: PASS. Existing warning remains from `@vladmandic/face-api` import in HR check-in.

Open note:
- In-app Browser tool was not exposed by tool discovery in this turn, and no safe default admin credential exists. Visual inspection was therefore limited to build route output and static class/i18n checks.

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

### B. Settings consolidation (user: "halaman settings terlalu banyak, gabungkan") — DONE locally 2026-06-08
- `/settings` now renders a grouped, permission-aware Settings hub instead of redirecting to `/settings/locations`.
- Sidebar Settings children reduced from the old flat individual-page list to: overview, organization, sales/POS, automation, access/security, integrations/AI.
- Existing detail routes remain reachable from hub cards to avoid disrupting server actions, permission gates, or audit-aware mutation paths.
- i18n parity + web typecheck + web build passed.

### C. Cleanup — old `mcp-token-service.ts`
- `packages/services/src/iam/mcp-token-service.ts` (mintMcpToken/revokeMcpToken) is now UNUSED by the settings page, stores tokens in PLAINTEXT, and uses invalid `iam.token.write as any`. Confirm no other caller (grep) then delete it + drop the `mcp_tokens` table from schema (or repurpose). Keep `apiTokens` as the single token system.

### D. Enrich permission descriptions with page paths (#10)
- Only logistics perms currently name their page. Extend `PERMISSIONS_SEED` descriptions to reference the page each unlocks, then re-seed.

---

## NEXT STEP (explicit)
1. Deploy the web app so the new Settings hub/sidebar reaches the live instance.
2. Continue remaining T-0264 work: Coretax XML/template export, old plaintext `mcp-token-service.ts` cleanup, and permission description enrichment.

## Verification done
- `packages/services` typecheck PASS (new api-token-service clean).
- Live DB: schema-sync verified (8 checks), logistics perms verified (4 roles granted).
- Settings consolidation: i18n parity en=id=zh=4604; `pnpm --filter @erp/web typecheck` PASS; `pnpm --filter @erp/web build` PASS (existing HR face-api warning).
