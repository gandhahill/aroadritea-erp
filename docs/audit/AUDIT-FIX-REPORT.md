# Audit Fix Report — T-0170 (Audit 26-Dimensi)

- **Auditor**: Claude Opus 4.7
- **Tanggal**: 2026-05-24
- **Scope commit range**: dari `d6b463a` (baseline) ke head
- **Ledger detil**: [docs/audit/AUDIT-FIX-LEDGER.md](AUDIT-FIX-LEDGER.md)
- **Checkpoint**: [docs/checkpoints/T-0170-audit-26-dimensions.checkpoint.md](../checkpoints/T-0170-audit-26-dimensions.checkpoint.md)

## Executive Summary

| Verifikasi akhir | Status | Catatan |
|---|---|---|
| `pnpm typecheck` | ✅ PASS | 10/10 workspaces. |
| `pnpm test` | ✅ PASS | 559 services + 74 shared = 633 tests (baseline 615, +18). |
| `pnpm lint` (Biome) | ❌ FAIL (baseline) | Dokumentasikan sebagai BACKLOG-LINT — tidak diperburuk. |

| Severity | Found | Fixed | Backlog | Catatan |
|---|---:|---:|---:|---|
| Critical | 1 | 1 | 0 | Anonimitas whistleblower bocor lewat audit_log + upload metadata. |
| High | 4 | 4 | 2 | Custom-fields IDOR, POS void/refund broken, magic-byte upload, Turnstile default-allow; backlog: AI Phase 2/3 (read & write tools). |
| Medium | 3 | 3 | 2 | Baseline tests (3) + backlog: T-0169 carry-over, MCP write tools decision. |
| Low | 0 | 0 | 3 | Backlog: lint cleanup, CSP nonce-based, PII log sweep, A11y formal pass. |
| Feature (User Req) | 4 | 4 (3 selesai + 1 partial-Phase1) | 0 | NIK opsional, SOP, payslip PDF, AI Assistant. |

## Ringkasan per 26 Dimensi

> Legenda: ✅ tuntas pass ini · ⚠️ sebagian (bagian tuntas, sisanya backlog) · ❌ backlog · 🔁 sudah ada audit sebelumnya (T-0168/T-0169) dan tidak diperburuk.

### A. Kebenaran & Logika Bisnis

| # | Status | Tindakan / Sisa Risiko |
|---|---|---|
| A1 — Bug fungsional | ✅ | Diperbaiki: POS void/refund yang gagal di schema sejak T-0168 (tidak ada `idempotencyKey` di action) — sekarang dihasilkan server-side. Baseline tests yang gagal (7) di-stabilkan. |
| A3 — Logika bisnis cacat | 🔁 ⚠️ | Invariant accounting/PPN/PPh21/refund-qty masih ditegakkan oleh test-suite T-0168. Tidak ada pelanggaran baru. Backlog: smoke test PPh21 TER end-to-end periode 2026. |
| A16 — Kelengkapan CRUD | ⚠️ | Custom-fields penuh; SOP penuh; payslip read-only; AI session: create/list/get/rename/archive. Backlog: AI session bulk-archive admin tool. |
| A17 — Filter/pagination server-side | ⚠️ | SOP list pakai filter+pagination konsisten (`FilterBar`+`Pagination`). Backlog: AI admin viewer belum punya filter berbasis user/tanggal. |
| A20 — Sorting | 🔁 | Tidak dimodifikasi pada pass ini. |
| A-DB — Integritas DB | ✅ | Migrasi 0029–0031 (nik DROP NOT NULL, sop_documents, ai_chat_*) konsisten dengan pola existing; unique index NIK tetap dengan semantik NULL-allowed Postgres. |
| A-SYNC — POS offline | 🔁 | Tidak disentuh; rekomendasi T-0168 (REC-001 atomic write path) tetap berlaku. |
| A-TZ — Timezone WIB | 🔁 | Hourly sales & shift sudah pakai util `packages/shared/src/date`. Tidak diperburuk. |

### B. Keamanan ("level militer")

| # | Status | Tindakan / Sisa Risiko |
|---|---|---|
| B2 — Celah keamanan | ✅ | 4 temuan dipromosikan & diperbaiki: (B2-001) custom-fields IDOR, (B2-002) POS void/refund broken, (B2-005) upload magic-bytes XSS, (B2-006) Turnstile default-allow. |
| B11 — MCP guardrail | 🔁 | Re-review server.ts + helpers.ts: token-per-call, `requireConfirmation`, `assertBulkLimit`, DNS-rebinding guard masih aktif. Tidak ada tool baru yang menyentuh write tanpa permission. Backlog: MCP write tools (lihat BACKLOG-MCP-WRITE). |
| B24 — Auth aman | ⚠️ | better-auth + bcrypt cost-12 dijaga. 2FA tetap **opsional** sesuai req. Sesi multi-perangkat & revoke belum diimplementasi di UI (terdaftar di backlog). |
| B25 — RBAC | ✅ | `requirePermission()` ditegakkan di seluruh service baru (sop, ai). Permissions baru ditambah & dipetakan ke role yang sesuai. |
| B26 — Permission↔Fitur↔UI | ✅ | `hr.sop.read/manage`, `ai.assistant.use/admin` punya tool/route/UI semua. |
| B-EXT — Integrasi eksternal | 🔁 | Naixer/QR tidak diubah; signature/HMAC tetap rekomendasi backlog karena integrasi inbound saat ini tidak mempunyai callback. |
| B-CICD — CI/CD secrets | 🔁 | Workflow GitHub Actions tidak diubah; rekomendasi T-0168 (REC-005 rotasi credential PM2) tetap. |

### C. Arsitektur, Standar & Kualitas

| # | Status | Tindakan / Sisa Risiko |
|---|---|---|
| C5 — Standar (OWASP/COSO/ISO) | ⚠️ | Anonimitas whistleblower + AuditContext server-side memperkuat COSO-style traceability dan OWASP A01 (broken access). |
| C6 — Enterprise-grade | ⚠️ | SOP + AI assistant cocok dengan multi-loc/RBAC/audit observability. AI rate-limit memitigasi cost-overrun. |
| C7 — Production-ready | ⚠️ | `AI_ASSISTANT_ENABLED=false` jadi kill-switch aman; `.env.example` diperbarui dengan kunci AI/DeepSeek. |
| C8 — Kesesuaian arsitektur | ✅ | Semua fitur baru tetap di pola `apps/* → packages/services → packages/db`. Schema baru terdaftar di `packages/db/index.ts` & `package.json` exports. |
| C4 — Best practice | ✅ | Result-typed services, Zod boundary, getSession server-side, no `any` liar di kode baru. |
| C14 — Clean code & scalable | ✅ | Komponen UI re-use (`PageHeader`, `FilterBar`, `Pagination`, `Table*`). Tidak ada duplikasi besar baru. |

### D. Konsistensi Backend ↔ UI & Desain

| # | Status | Tindakan / Sisa Risiko |
|---|---|---|
| D9 — Mismatch BE↔UI | ✅ | SOP + AI assistant: setiap action service punya UI. Payslip route HTML link dari `/hr/my-payslips`. |
| D12 — Componentize | ⚠️ | UI SOP & AI memakai `packages/ui` (Button/Input/Select/Table). Backlog: konsolidasi modal yang masih ad-hoc. |
| D21 — Responsif & a11y | ⚠️ | Chat client + SOP list mobile-friendly via grid responsif. Audit a11y formal masih backlog. |
| D22 — Toast vs native alert | ✅ | Tidak ada `alert/confirm/prompt` baru; semua feedback lewat banner/dialog in-app. |

### E. Fitur, Fleksibilitas & Analitik

| # | Status | Tindakan / Sisa Risiko |
|---|---|---|
| E13 — Fitur F&B kurang | ✅ (User Req) | SOP, payslip, AI assistant ditambahkan sesuai permintaan owner. |
| E15 — Kustomisasi via UI | 🔁 | Custom-field engine tetap; AI config DB-driven via `cms_settings.ai.provider.config` (Phase 2). |
| E23 — Hapus akun member | ❌ | Backlog — belum diimplementasi pada sesi ini. |
| E18 — BI interaktif | 🔁 | Tidak disentuh; daily/hourly/donation/omzet reporting sudah ada. |
| E19 — Export XLSX | 🔁 | Existing `export-workbook.ts` tidak disentuh; backlog ada export SOP/payslip CSV bila diperlukan. |

### F. Compliance: i18n & Audit Trail

| # | Status | Tindakan / Sisa Risiko |
|---|---|---|
| F10 — i18n key parity | ⚠️ | Key baru (`nikOptional`, `sop`, `myPayslips`, `aiAssistant`) ditambah paralel di id/en/zh. Backlog: skrip CI yang fail jika ada key drift. |
| F10 — Audit trail mutasi | ✅ | SOP create/update/delete, AI message turn, custom-fields delete — semua menulis ke `audit_log`. Immutability table tetap (trigger 0014). |
| F10 — Whistleblower anonim | ✅ | **Critical fix**: service tidak lagi menulis audit_log untuk submission; metadata upload `uploadedBy='anonymous_whistleblower'` untuk area whistleblower. Test regresi 4/4 PASS. |

## Perbaikan Kode (rekap)

Lihat ledger untuk path:line per item. Highlight:

1. **Custom-fields IDOR (B2-001)** — Server Actions tidak lagi menerima `ctx` dari client.
2. **POS Void/Refund broken (B2-002)** — Action menghasilkan `idempotencyKey` + meneruskan `lines` untuk refund.
3. **Whistleblower anonim (B2-003/F-001)** — service drop ctx.userId, tidak panggil auditRecord, action hanya pass `tenantId`, upload set anonymous uploader.
4. **Magic-byte upload (B2-005)** — `assertImageMagicBytes` di `@erp/shared/image-magic-bytes` dipanggil dari upload route untuk `imageOnly`.
5. **Turnstile bypass (B2-006)** — Default deny di production kecuali `TURNSTILE_ALLOW_BYPASS=true` di-set eksplisit.
6. **Baseline test stabilization (BASELINE-001/002/003)** — Test schema (Void/Refund idempotencyKey), path module (`shared/number-generator`), bcrypt timeout (mock password module).

## Fitur Baru (User Requests)

1. **AI Assistant DeepSeek (User Req 1, ADR-0013)** — Phase 1 (chat foundation): schema + service + UI + RBAC + audit + rate limit. Phase 2/3 (tools, OCR, web-search) di backlog.
2. **SOP Documents (User Req 2)** — Schema, service, route upload `sop`, UI list + upload + publish/archive, permission gated, audit trail.
3. **Payslip PDF (User Req 3)** — Service `getEmployeePayslip` + `listMyPayslips`, route HTML cetak, page `/hr/my-payslips`. Tanpa lib PDF berat — pakai browser print → save as PDF.
4. **NIK opsional (User Req 4)** — Migrasi 0029, schema/service/Zod/UI/i18n diperbarui.

## Rekomendasi Follow-Up

| Prio | Item | Backlog ID |
|---|---|---|
| 🟠 | AI Phase 2: read-only tools (search_codebase, read_file, request_admin_help template) | BACKLOG-AI-TOOLS |
| 🟠 | AI Phase 3: OCR struk + write tools dengan confirm-then-commit | BACKLOG-AI-OCR |
| 🟡 | Selesaikan T-0169 (shift × manual sales integration) | BACKLOG-T-0169 |
| 🟡 | Decision: ekspos MCP write tools? | BACKLOG-MCP-WRITE |
| 🟢 | Lint cleanup (332 err / 488 warn) | BACKLOG-LINT |
| 🟢 | CSP nonce-based replace `unsafe-inline` | BACKLOG-CSP |
| 🟢 | A11y WCAG 2.1 AA formal pass | BACKLOG-A11Y |
| 🟢 | E23 — Hapus akun member (UU PDP) | (akan ditambah ke ledger) |

## Lampiran

- Baseline T-0168: `docs/audit/AUDIT-REPORT.md`
- T-0170 ledger detil: `docs/audit/AUDIT-FIX-LEDGER.md`
- T-0170 checkpoint: `docs/checkpoints/T-0170-audit-26-dimensions.checkpoint.md`
- ADR-0013 AI Assistant: `docs/adr/0013-ai-assistant-deepseek.md`
