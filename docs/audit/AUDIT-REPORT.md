# Aroadritea ERP - Security & Bug Audit Report

**Tanggal:** 2026-05-22
**Auditor:** Codex GPT-5
**Scope commit range:** `5970cfc..7e19c36`

## Executive Summary

| Severity | Found | Fixed | Deferred |
|---|---:|---:|---:|
| Critical | 0 | 0 | 0 |
| High | 3 | 3 | 0 |
| Medium | 2 | 1 | 1 |
| Low | 4 | 0 | 4 |

Audit T-0168 menyelesaikan perbaikan operasional overnight dan security/data-integrity pass awal. Tidak ada temuan Critical yang tersisa. Semua temuan High yang dipromosikan sudah diperbaiki dengan test regresi.

Status verifikasi akhir:

| Check | Status | Evidence |
|---|---|---|
| `pnpm -r typecheck` | PASS | 10/10 workspace packages typecheck. |
| `pnpm -r test` | PASS | 614 tests pass: 65 shared + 549 services. |
| `pnpm build` | PASS | Worker, MCP, site, and web production builds completed. |
| VPS deploy | PASS | `git pull`, install, migrate, seed, build, PM2 reload/save, and health checks completed on production. |
| `pnpm lint` | FAIL baseline | 332 errors / 488 warnings. Mostly legacy formatting/import/a11y debt. Not hidden; tracked as REC-002. |
| Browser-native messages grep | PASS | No production `alert/confirm/prompt`; only replacement-component comments and sanitizer test payloads. |

## Daftar Temuan

### High

#### [SEC-001] Public CMS HTML XSS risk

- **Lokasi:** `apps/site/app/[locale]/[slug]/page.tsx`, `apps/site/app/[locale]/blog/[slug]/page.tsx`
- **Kategori:** OWASP A03 / XSS
- **Dampak:** CMS HTML yang tidak disanitasi dapat mengeksekusi script bila konten berbahaya masuk ke CMS.
- **Root cause:** Public pages merender HTML dari CMS tanpa sanitizer terpusat.
- **Fix:** `6694f87` - `fix(site): sanitize public CMS HTML [SEC-001]`
- **Tes:** `packages/shared/src/security/sanitize-cms-html.test.ts`

#### [SEC-002] Financial reporting scope could trust client context

- **Lokasi:** `apps/web/app/(dash)/reporting/actions.ts`, `packages/services/src/reporting/*.ts`
- **Kategori:** OWASP A01 / IDOR and tenant/location scope
- **Dampak:** Report action berisiko memakai context tenant/lokasi dari client bila dipanggil langsung.
- **Root cause:** Beberapa action/service belum sepenuhnya derive context dari session dan belum pass `locationId` ke permission check.
- **Fix:** `8303341` - `fix(reporting): scope financial report access [SEC-002]`
- **Tes:** `packages/services/tests/reporting.test.ts`

#### [INT-002] POS tracked BOM stock could be oversold silently

- **Lokasi:** `packages/services/src/pos/create-sale.ts`
- **Kategori:** ERP inventory data integrity
- **Dampak:** Bahan tracked dengan satuan cocok dapat habis/kurang tetapi sistem meng-clamp ke nol tanpa menolak sale.
- **Root cause:** Deduct memakai `GREATEST(0, qty - required)` dan deduction failure dianggap non-blocking.
- **Fix:** `0ea52eb` - `fix(pos): reject oversold tracked ingredients [INT-002]`
- **Tes:** `packages/services/tests/pos.test.ts`

### Medium

#### [INT-001] Money math precision hardening

- **Lokasi:** `packages/shared/src/money`
- **Kategori:** Financial precision
- **Dampak:** Jalur uang sensitif dapat kehilangan presisi bila bigint cents melewati `Number`.
- **Root cause:** Utility money lama masih punya konversi yang tidak perlu.
- **Fix:** `c1e29e7` - `fix(shared): keep money math in bigint [INT-001]`
- **Tes:** `packages/shared/src/money/index.test.ts`

#### [REC-001] Full POS transaction atomicity needs runtime architecture change

- **Lokasi:** `packages/db/client.ts`, `packages/services/src/pos/create-sale.ts`
- **Kategori:** ERP data integrity / transaction boundary
- **Status:** Deferred with justification
- **Alasan:** Drizzle Neon HTTP driver does not support arbitrary multi-step transactions. Current patch rejects tracked oversell and adds stock compensation on known post-deduction failures, but true sale+payment+journal+stock atomicity needs a transaction-capable service write path or redesigned Neon batch/stored procedure.

### Low

#### [REC-002] Lint baseline remains red

- **Lokasi:** repository-wide
- **Kategori:** ISO 9001 maintainability
- **Status:** Deferred
- **Alasan:** 332 errors / 488 warnings are dominated by formatting/import/a11y mechanical debt. A mass formatter pass would create broad unrelated churn and should be done in a dedicated branch.

#### [REC-003] Quantity decimal utility follow-up

- **Lokasi:** inventory/purchasing/POS quantity service paths
- **Kategori:** ERP quantity precision
- **Status:** Deferred
- **Alasan:** Money paths are fixed. Some quantity code still uses `Number.parseFloat(...).toFixed(3)`. Current business quantities are three-decimal operational values, but a shared decimal quantity utility would reduce future drift.

#### [REC-004] Demo print sessionStorage fallback

- **Lokasi:** demo print receipt/label pages
- **Kategori:** UX resilience
- **Status:** Deferred
- **Alasan:** `JSON.parse` is client-local demo state, not a trust-boundary issue. Add a graceful empty-state later for malformed demo storage.

#### [REC-005] Rotate production secrets exposed by PM2 environment inspection

- **Lokasi:** VPS runtime environment / PM2 process metadata
- **Kategori:** ISO 27001 secret handling
- **Status:** Deferred to operator action
- **Alasan:** `pm2 jlist` prints process environment variables, including production secrets. Values are intentionally not copied into this report, but credentials should be rotated after this audit window and routine status checks should use `pm2 status --no-color` or health endpoints.

## Operational Fixes Included

| ID | Commit | Summary |
|---|---|---|
| BUG-001 | `e52d7e7` | Member forgot-password flow with single-use reset token, session revocation, multilingual email. |
| BUG-002 | `e603514` | AP/AR reminder worker query fixed and tenant-safe. |
| BUG-003 | `f2547f5` | Outlet selectors exclude office locations where operationally required. |
| BUG-004 | `ffa0b8d` | Malioboro manager Excel codes aligned into seed/import matching. |
| BUG-005 | `8a103f7` | Correspondence module added for tracked surat menyurat. |
| BUG-006 | `074f2d6` | Governed one-off manual POS discounts with reason and promotion-owner notification. |
| BUG-007 | `b70f810` | Accounting transaction evidence inbox surfaced via correspondence finance filter. |
| BUG-008 | `0b9e4ea` | POS shortcuts added after old POS photo review. |
| BUG-009 | `1741a4d` | In-app and `/docs` guides updated for POS discounts, accounting evidence, old POS parity. |

## Tes Baru Yang Ditambahkan

| Test file | Skenario | Severity terkait |
|---|---|---|
| `packages/shared/src/security/sanitize-cms-html.test.ts` | Removes scripts, event handlers, unsafe URLs from CMS HTML. | SEC-001 |
| `packages/shared/src/money/index.test.ts` | Bigint-safe money operations. | INT-001 |
| `packages/services/tests/reporting.test.ts` | Financial reporting enforces session-derived tenant/location permission context. | SEC-002 |
| `packages/services/tests/member-password-reset.test.ts` | Password reset token single-use, expiry, session revocation. | BUG-001 |
| `packages/services/tests/notification-channel.test.ts` | Party ledger email notification purpose exists. | BUG-002 |
| `packages/services/tests/inventory-import-code.test.ts` | Manager Excel product codes map safely and unknown variants are rejected. | BUG-004 |
| `packages/services/tests/correspondence.test.ts` | Correspondence CRUD/filter behavior. | BUG-005 / BUG-007 |
| `packages/services/tests/pos.test.ts` | Manual discount reason validation and tracked ingredient stock guard. | BUG-006 / INT-002 |

## Rekomendasi Follow-up

1. **[REC-001] POS atomic write path:** introduce a transaction-capable Postgres write client or a stored procedure for POS sale+payment+journal+stock.
2. **[REC-002] Lint cleanup branch:** run Biome format/import/a11y fixes in a dedicated mechanical PR and keep financial changes separate.
3. **[REC-003] Decimal quantity utility:** move inventory quantity math to a shared Decimal/string helper.
4. **Physical verification:** printer auto-detection/dropdown, cash drawer, and outlet label/receipt hardware require on-device smoke testing.
5. **Gift card decision:** old POS had purchase-gift/gift-card affordance; enable POS sale only after finance defines liability/revenue recognition accounts.
6. **Credential rotation:** rotate production secrets exposed by PM2 environment inspection during deployment verification.

## Lampiran

- Baseline status: `docs/audit/00-baseline.md`
- Attack surface map: `docs/audit/01-attack-surface.md`
- Static findings: `docs/audit/02-static-findings.md`
- Guide coverage: `docs/audit/guide-coverage.md`
- Deployment verification: `docs/audit/03-deployment-verification.md`
- Runtime inventory: `docs/audit/security-runtime-inventory.md`
- Coverage ledger: `docs/audit/repository-coverage-ledger.md`

## Audit Fase Lanjutan (Dimensi 9 - 12)
Audit terhadap Dimensi 9, 10, 11, dan 12 telah dilakukan pada tanggal 2026-05-23.

### Dimensi 9 (Paritas Backend ↔ UI)
- Ditemukan beberapa *orphan backend* (seperti modul CRM) dan UI buntu yang merujuk ke action placeholder. 

### Dimensi 10 (i18n & Audit Trail)
- **i18n:** Telah dilakukan perbaikan pada ketidaksesuaian paritas terjemahan.
- **Audit Trail & Whistleblower:** Seluruh mutasi material telah menulis ke `auditLog`. Skema anonimitas Whistleblower terverifikasi patuh (identitas pelapor dan metadata jaringan tidak dicatat/dibocorkan pada tabel `auditLog`).

### Dimensi 11 (Kelengkapan Tool MCP)
- Tool MCP divalidasi dengan Zod dan dibatasi via otorisasi terpusat.
- **Gap:** Ditemukan ketiadaan tool mutasi kritis seperti `create_sale` (POS), `create_product` (Inventory), `cancel_po` (Purchasing), dan `whistleblower`. 
- **Tindakan (NEED-DECISION):** Menunggu persetujuan pemilik sistem sebelum mengekspos fitur *write* sensitif ini kepada AI.

### Dimensi 12 (Konsistensi UI)
- Tidak ada pelanggaran penggunaan kelas generik Tailwind berkat linter ADR-0006.
- **Kelemahan (Visual & Layout):** Konsistensi dicapai melalui duplikasi *string class* yang masif alih-alih menggunakan komponen terpusat di `packages/ui`.
- **Kelemahan (Aksesibilitas & Meta):** Direktori publik `apps/site` sebelumnya tidak memiliki file `robots.ts`, `sitemap.ts`, dan tag meta Open Graph.
- **Tindakan (AUTO-FIX):** Tag meta SEO telah ditambahkan. Sedang dalam proses eksekusi abstraksi *UI Components* ke dalam `packages/ui/src` untuk menghapus repetisi.
