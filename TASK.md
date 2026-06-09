# TASK.md Ã¢â‚¬â€ Active Implementation Tasks

> **Single source of truth runtime** for all implementation tasks being worked on (or to be worked on) by AI developers.
>
> AI **must** update this file before and after working. If the token limit ends mid-session, the next AI reads this file + relevant checkpoint to continue exactly from the stopping point.
>
> Full rules: `SYSTEM-DESIGN.md Ã‚Â§37`.

---

## Status Legend

- Ã°Å¸Å¸Â¦ **PENDING** Ã¢â‚¬â€ scoped, not yet started
- Ã°Å¸Å¸Â¨ **IN_PROGRESS** Ã¢â‚¬â€ in progress, active checkpoint exists
- Ã°Å¸Å¸Â© **DONE** Ã¢â‚¬â€ completed, commit link available
- Ã°Å¸Å¸Â¥ **BLOCKED** Ã¢â‚¬â€ stalled, blocker notes present
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
| T-0281 | Pentest 2026-06-07 remediation verification | Codex | 2026-06-09 11:30 WIB | 2026-06-09 14:22 WIB | IN_PROGRESS | Patch commit `0ba37cf` pushed and deployed; site/web/MCP origin health checks pass; live site/web security headers verified; DNS SPF/DMARC and public Cloudflare TLS for `mcp.erp.aroadritea.com` remain Cloudflare-side. Checkpoint: `docs/checkpoints/T-0281-pentest-2026-06-07-remediation.checkpoint.md`. |
| T-0279 | Service-level pagination for reporting/finance pages | Claude Opus 4.6 | 2026-06-04 01:00 WIB | 2026-06-04 01:00 WIB | IN_PROGRESS | Add server-side pagination to reimbursement, petty cash, bank recon list, general ledger; client-side pagination for COGS/waste/aging aggregated reports. Checkpoint: `docs/checkpoints/T-0279-service-level-pagination.checkpoint.md`. |
| T-0278 | Mobile table overflow and pagination sweep | Claude Opus 4.6 | 2026-06-03 22:41 WIB | 2026-06-04 00:30 WIB | DONE | Patched shared Table (min-w-max, data-ui-table, touch scroll), global CSS mobile raw table scroll, overflow-hidden→overflow-x-auto across 25+ table wrappers, server-side pagination on assets + invoices. Typecheck + build PASS. Checkpoint: `docs/checkpoints/T-0278-mobile-table-overflow-pagination.checkpoint.md`. |
| T-0277 | Production SOP PDF preview Not Found regression | Codex | 2026-06-03 20:53 WIB | 2026-06-03 21:19 WIB | DONE | Root cause: relative `UPLOAD_STORAGE_DIR=storage/uploads` resolved under volatile `.next/standalone` PM2 cwd, so uploaded SOP file disappeared after rebuild. Upload root now resolves to repo root, prod deployed `9afb5a7`, and missing `SOP-TI.pdf` was restored to persistent storage. Checkpoint: `docs/checkpoints/T-0277-prod-sop-pdf-not-found-regression.checkpoint.md`. |
| T-0276 | Hotfix SOP PDF preview security headers | Codex | 2026-06-03 20:29 WIB | 2026-06-03 20:40 WIB | DONE | Allowed same-origin PDF preview in `/hr/sop` while keeping ERP pages protected from external framing. Verified scoped Biome, web typecheck, and web build. Checkpoint: `docs/checkpoints/T-0276-sop-pdf-preview-security-headers.checkpoint.md`. |
| T-0275 | Hotfix SOP PDF inline preview fallback | Codex | 2026-06-03 20:06 WIB | 2026-06-03 20:15 WIB | DONE | Replaced SOP PDF `<object>` preview with iframe-based browser PDF viewer because download works but inline view fell back to "PDF cannot be displayed". Verified scoped Biome, web typecheck, and web build. Checkpoint: `docs/checkpoints/T-0275-sop-pdf-inline-preview-fallback.checkpoint.md`. |
| T-0274 | Hotfix SOP file links and consumed ingredient history table | Codex | 2026-06-03 18:11 WIB | 2026-06-03 18:39 WIB | DONE | Fixed `/hr/sop` PDF/view download link normalization, tolerated duplicated upload prefixes, merged consumed ingredient editor into the created-by column, and showed qty/UOM details. Verified web typecheck and web build. Checkpoint: `docs/checkpoints/T-0274-sop-links-consumed-history-hotfix.checkpoint.md`. |
| T-0273 | SOP page inline PDF viewer | Codex | 2026-06-03 17:04 WIB | 2026-06-03 17:20 WIB | DONE | Added in-page PDF preview on `/hr/sop`, `?download=1` forced download, and i18n cleanup for SOP upload/viewer labels. Verified web typecheck and web build. Checkpoint: `docs/checkpoints/T-0273-sop-inline-pdf-viewer.checkpoint.md`. |
| T-0272 | POS history tables show location and edit user metadata | Codex | 2026-06-03 16:57 WIB | 2026-06-03 17:20 WIB | DONE | Manual closing history now shows location; consumed ingredient history shows location plus edited-by user. Verified web typecheck and web build. Checkpoint: `docs/checkpoints/T-0272-pos-history-location-editor-columns.checkpoint.md`. |
| T-0271 | Financial close control center for monthly accounting readiness | Codex | 2026-06-03 13:20 WIB | 2026-06-03 16:02 WIB | DONE | Added docs + read-only close readiness dashboard across period status, journals, POS closing, bank recon, inventory, AP/AR, tax, and payroll. Verified services/web typecheck, permission lint, and web build. Checkpoint: `docs/checkpoints/T-0271-financial-close-control-center.checkpoint.md`. |
| T-0265 | Production hotfix: Next instrumentation runtime import resolves workspace TS source (`@erp/services/notification` -> `@erp/db/client`) | Codex | 2026-06-02 11:00 WIB | 2026-06-02 11:16 WIB | DONE | Build PASS + standalone startup PASS. Typecheck still blocked by unrelated existing service errors in fixed-assets/pos. Checkpoint: `docs/checkpoints/T-0265-production-instrumentation-import.checkpoint.md`. |
| T-0264 | Live-testing remediation: schema-drift `drizzle-kit push`, IAM #2 wildcard grant + #3b logistics perms, shipments #3a creator-scope, remove /settings/users #5, pb1 location dropdown #4, stock-ledger filters #1, MCP token CRUD (apiTokens + SHA-256) | Codex | 2026-05-30 | 2026-06-08 21:45 WIB | 🟨 IN_PROGRESS | Settings consolidation patch verified and pushed in the current turn; remaining work: Coretax XML #9 and old mcp-token-service cleanup. Checkpoint: `docs/checkpoints/remediation-2026-05-30.checkpoint.md`. |
| T-0211 | Payroll: field gaji pokok + pembuatan `employmentContracts` | Antigravity | 2026-05-29 09:54 WIB | 2026-05-29 09:58 WIB | ðŸŸ© DONE | Added baseSalary field, insert to employmentContracts, added payroll guard. |
| T-0213 | Wire `postJournal`/`reverseJournal` ke server action + tombol UI | Antigravity | 2026-05-29 10:02 WIB | 2026-05-29 10:11 WIB | ðŸŸ© DONE | Added server actions, deleted service, and JournalActionsUI to the UI. |
| T-0212 | Inventory: valuasi weighted-average + jurnal HPP saat penjualan | Antigravity | 2026-05-29 09:58 WIB | 2026-05-29 10:01 WIB | ðŸŸ© DONE | Calculated avgUnitCost during GRN/transfer, and posted COGS journal on sale using the product and ingredient accounts. |
| T-0209 | Fix UI Object Rendering, Timezone, and CSP bugs | Antigravity | 2026-05-28 18:14 WIB | 2026-05-28 18:22 WIB | ðŸŸ© DONE | Fixed React object rendering bugs, updated CSP, corrected timezone and UA parser in sessions. Build passed, pushed. |
| T-0208 | Change Password (Self Service & Admin) | Antigravity | 2026-05-28 | 2026-05-28 | ðŸŸ© DONE | Add profile setting and HR reset password |
| T-0207 | HR My Schedule Employee View | Antigravity | 2026-05-28 | 2026-05-28 | ðŸŸ© DONE | Added /hr/my-schedule and listMySchedule action |
| T-0206 | POS Manual Sales UI Refactor | Antigravity | 2026-05-28 20:30 WIB | 2026-05-28 20:41 WIB | ðŸŸ© DONE | Refactored manual sales UI to support multiple payment methods, moved consumed ingredients to a sub-page, and added createdByName to the history table. Replaced Debit/Credit with Card. |
| T-0205 | Invoice & Kuitansi Best Practice Fixes | Antigravity | 2026-05-28 18:22 WIB | 2026-05-28 18:30 WIB | ðŸŸ© DONE | Added sequential numbering, tax amount calculation, terbilang utility, partner address & NPWP, full i18n support, and migrated database to support new columns. Typecheck passed. |
| T-0204 | Accounting Settings UI (Global AP Mapping) | Antigravity | 2026-05-28 18:13 WIB | 2026-05-28 18:17 WIB | ðŸŸ© DONE | Added Settings > Accounting UI for `cms_settings` `accounting.payables.accountIds`. Typecheck passed. |
| T-0203 | Outgoing Shipments Module (BinderByte) & Invoice Sidebar | Antigravity | 2026-05-28 17:21 WIB | 2026-05-28 17:48 WIB | ðŸŸ© DONE | Add Logistics module for outgoing shipments, Invoice menu, and fix print types. IDE errors resolved, pnpm typecheck successful. |
| T-0202 | Automated PDF Invoice Generation (Print View) | Antigravity | 2026-05-28 17:08 WIB | 2026-05-28 17:15 WIB | ðŸŸ© DONE | Added Print View for Journal Entries to support invoices and receipts. |
| T-0200 | Add AI Assistant and OCR limitations to documentation | Antigravity | 2026-05-27 18:06 WIB | 2026-05-27 18:07 WIB | ðŸŸ© DONE | Added a new "ai-assistant" section to `docs-content.ts` in all languages (ID, EN, ZH) instructing users to leverage external ChatGPT/Gemini vision capabilities as a workaround for the current local OCR limitations. |
| T-0201 | Fix AI draft manual sales validation & idempotency save errors | Antigravity | 2026-05-27 18:15 WIB | 2026-05-27 18:42 WIB | ðŸŸ© DONE | Fixed `pos.manualSales.validationFailed` by updating `CreateManualSalesClosingInputSchema` to use `.nullish()`. Fixed subsequent `pos.manualSales.duplicateRequest` by adding `id: generateId()` in `saveIdempotency` to satisfy Postgres `NOT NULL` constraint during `INSERT ... ON CONFLICT DO UPDATE` evaluation. |
| T-0199 | Improve OCR prompt for Tesseract fallback wrapping issues | Antigravity | 2026-05-27 18:03 WIB | 2026-05-27 18:04 WIB | ðŸŸ© DONE | Added specific instructions to DeepSeek `systemPrompt` to extract quantities that get scrambled into the middle of item names (e.g., `S 2 tandard` -> Qty 2) due to receipt line wrapping when processed by Tesseract. |
| T-0198 | Fix read_file tool invalidArguments due to regex and path | Antigravity | 2026-05-27 17:44 WIB | 2026-05-27 17:46 WIB | ðŸŸ© DONE | Allowed parentheses in `path` validation schema to support Next.js route groups `(dash)`, and fixed `repoRoot()` to use `__dirname` instead of `process.cwd()` to prevent relative path failures inside `apps/web`. |
| T-0197 | Fix truncated OCR notes in manual sale draft | Antigravity | 2026-05-27 17:39 WIB | 2026-05-27 17:41 WIB | ðŸŸ© DONE | Removed `.slice(0, 120)` from `create-manual-sale-draft.ts` so OCR notes / unresolved items are not truncated in the UI confirmation card. |
| T-0196 | Fix search_codebase path resolution bug | Antigravity | 2026-05-27 17:21 WIB | 2026-05-27 17:23 WIB | ðŸŸ© DONE | Replaced `process.cwd()` with `__dirname` relative resolution so `searchCodebaseTool` correctly scans the repo root instead of 0 files. |
| T-0195 | Upgrade OCR fallback to route local text through LLM | Antigravity | 2026-05-27 17:15 WIB | 2026-05-27 17:16 WIB | ðŸŸ© DONE | Refactor `ocr-receipt.ts` to feed Tesseract output into DeepSeek for JSON parsing when `supportsVision` is false. Verified unit tests. |
| T-0194 | Fix AI OCR receipt parsing for lines without brackets | Antigravity | 2026-05-27 17:07 WIB | 2026-05-27 17:15 WIB | ðŸŸ© DONE | Fixed regex in `ocr-receipt.ts` to capture line items without closing brackets. Verified tests pass. |
| T-0193 | Patch ERP bug batch: petty cash, variants, HR edit, POS orders, AI OCR/chat attachments | Codex | 2026-05-27 10:32 WIB | 2026-05-27 11:23 WIB | ðŸŸ© DONE | Commit `54b81ed` pushed/deployed. Verified local: services/web typecheck, services tests 611/611, web build, receipt parser. Verified VPS: pull/build, PM2 web/MCP/worker reload, health OK, Tesseract OCR parsed real receipt image as 2026-05-26 / 230000 / 5 tx. |
| T-0192 | Add AI product/location option listing fallback | Codex | 2026-05-27 09:22 WIB | 2026-05-27 09:27 WIB | ðŸŸ© DONE | AI lookup dikonfirmasi generic dan ditambah tool `list_products`/`list_locations` + prompt fallback "Mungkin maksud Anda..." untuk kandidat DB. Verified: targeted AI lookup test 4/4, services typecheck, scoped biome, web build PASS. |
| T-0191 | Patch VPS pentest infra + AI lookup/OCR + UI cleanup | Codex | 2026-05-27 05:49 WIB | 2026-05-27 06:18 WIB | ðŸŸ© DONE | VPS hardening + AI lookup/OCR + UI cleanup selesai di commit `06949f8`, dideploy ke VPS branch `codex/t-0191-vps-ai-ui-fixes`. Verified: services test 609/609, typecheck web/services, web build lokal+VPS, OCR gambar asli parsed tanggal `2026-05-26`, gross `230000`, transaksi `5`, health ERP/MCP OK, Host-header 421, FTP/DNS/3000 public blocked. |
| T-0189 | Patch seluruh temuan pentest 2026-05-26 | Codex | 2026-05-26 18:21 WIB | 2026-05-26 19:31 WIB | ðŸŸ© DONE | Semua patch repo untuk temuan pentest selesai. Verified: `pnpm -w typecheck`, `pnpm -w test`, `pnpm -w lint`, `pnpm --filter @erp/mcp build`, `pnpm --filter @erp/site build`, `pnpm --filter @erp/web build` PASS. Aksi INF VPS/HestiaCP manual ada di `docs/runbook/hestiacp-security-hardening.md`. |
| T-0190 | Validasi AI tools DeepSeek + deploy VPS pentest patch | Codex | 2026-05-26 23:43 WIB | 2026-05-27 00:34 WIB | ðŸŸ© DONE | Patch AI/OCR + copy Whistleblowing System selesai dan dideploy ke VPS commit `f6d0193`. Verified lokal: lint/typecheck/test/build PASS. Verified VPS: pull/build/reload PM2 PASS, health 3000/3001/3002 OK, Exa `web_search` OK 3 hits, OCR foto struk asli parsed tanggal `2026-05-26`, gross `230000`, transaksi `5`. |
| T-0188 | Production hotfix: AI image upload, helpdesk draft UX, natural ERP lookup, AI settings UI | Codex | 2026-05-26 15:05 WIB | 2026-05-26 10:05 WIB | DONE | Fixed: DeepSeek image uploads no longer send unsupported `image_url`; helpdesk draft cards stream/refresh correctly; Neon raw `ANY($1)` crash replaced with Drizzle `inArray`; non-secret AI config moved to UI/DB; AI tools resolve product/location names before follow-up. Verified: typecheck, lint, test, web build PASS. |
| T-0187 | Lengkapi panduan user ERP + mekanisme refresh konten docs DB per bahasa | Codex | 2026-05-25 22:53 WIB | 2026-05-26 10:05 WIB | DONE | Suplemen panduan ID/EN/ZH, refresh default per bahasa di `/cms/docs`, helper CMS audit-aware, MCP `docs.update_locale`, dan CLI `pnpm docs:refresh` selesai. Optional DB apply tetap manual per environment agar tidak menimpa edit admin tanpa aksi eksplisit. Verified bersama T-0188: typecheck, lint, test, web build PASS. |
| T-0186 | Finalize first 26-dimension audit DoD (lint/build/native dialogs/final ledger) | Codex | 2026-05-25 22:43 WIB | 2026-05-25 23:48 WIB | DONE | Prompt audit pertama ditutup operasional: `pnpm -w typecheck` PASS, `pnpm -w test` 685/685 PASS, `pnpm -w lint` PASS (884 warnings non-blocking), `pnpm build` PASS. Native `alert/confirm/prompt` produksi sudah diganti dialog/banner in-app. Audit ledger/report/checkpoint final diperbarui. |
| T-0185 | Internal courier shipment tracking â€” centralised /purchasing/shipments page (BinderByte) | Claude Opus 4.7 | 2026-05-25 20:50 WIB | 2026-05-25 21:10 WIB | DONE | Tests 600/600 PASS (no new tests). Schema/service `trackPurchaseOrderShipment` sudah ada; commit ini menambah surface terpusat: `/purchasing/shipments` (4 KPI tiles + filter status: in_transit/delivered/errored/no_shipping + inline sync form per-row) + `/purchasing/shipments/[id]` (BinderByte summary + history timeline + re-sync form). PO detail page dapat compact shipment card. Sidebar entry baru `purchasing.shipments`. i18n parity id/en/zh `purchasing.shipments.*`. Tidak ada DB call ke BinderByte saat load page (pakai cached PO columns) â€” sinkron hanya saat user klik tombol. |
| T-0184 | Helpdesk/ticketing system + AI integration (file ticket otomatis vs "kontak admin") | Claude Opus 4.7 | 2026-05-25 20:15 WIB | 2026-05-25 20:50 WIB | DONE | Tests 600/600 PASS (3 executeTool tests bumped to 15s timeout â€” registry cold-import slower setelah +1 tool). Schema `helpdesk_tickets` + `helpdesk_ticket_replies` (migrasi 0035). Permissions `helpdesk.{create,view,handle}` seeded. Service createTicket/listTickets/getTicket/replyTicket/transitionStatus/assignTicket dengan notif fan-out ke handlers (in-app + email) + reporter on reply/close; internal note hanya handlers. AI tool `log_helpdesk_ticket_draft` registered + draftâ†’confirmâ†’commit via ai_action_drafts (helpdesk_ticket kind). System prompt updated â€” AI WAJIB file ticket via tool ketika user report real bug; `request_admin_help` direservasi untuk ambiguous "saya stuck". UI /helpdesk (list + new + detail dgn reply thread). Sidebar entry. i18n parity id/en/zh `helpdesk.*`. |
| T-0183 | CRM member-database page untuk manajemen + adjust poin (audit trail) | Claude Opus 4.7 | 2026-05-25 19:55 WIB | 2026-05-25 20:15 WIB | DONE | Typecheck PASS, tests 685/685 (no new tests). Service `listMembers / getMemberDetail / adjustMemberPoints` di `@erp/services/crm`. Permissions baru `crm.member.view` + `crm.member.adjustPoints` (seeded). UI `/crm/members` (list + search by name/city + tier filter + pagination), `/crm/members/[id]` (detail card, recent 30 points tx, adjust-points form gated by permission). Lifetime points hanya naik (tidak menurun saat redeem). i18n parity id/en/zh `crm.members.*` + sidebar group baru "CRM â†’ Members". |
| T-0182 | Shift adjustment per tanggal â€” swap karyawan + notif kedua sisi + `schedule_overrides` audit table | Claude Opus 4.7 | 2026-05-25 19:35 WIB | 2026-05-25 19:55 WIB | DONE | Typecheck PASS, tests 685/685 (no new tests). Schema baru `schedule_overrides` (migrasi 0034) untuk track riwayat swap (originalâ†’substitute + reason + new_assignment_id). Server Action `swapShiftAssignmentAction` re-point existing shift_assignment ke karyawan baru + insert override row + audit `schedule_override` + fan-out notifikasi (deleted ke yg asli, created ke pengganti) via `notifyShiftChange`. Konflik (substitute sudah punya shift di slot itu) ditolak. UI grid: tombol â‡„ atau Alt+klik di sel berisi shift â†’ dialog in-app (pilih substitute + alasan minimal 3 char), tanpa browser-native prompt. i18n parity id/en/zh utk `hr.schedule.swap.*`. |
| T-0181 | HR self-service: halaman Riwayat Presensi karyawan (`/hr/my-attendance`) | Claude Opus 4.7 | 2026-05-25 19:25 WIB | 2026-05-25 19:35 WIB | DONE | Typecheck PASS, tests 685/685 (no new tests). Service `listMyAttendance(input, ctx)` resolve userâ†’employee via encrypted-email match (sama pattern dgn `listMyPayslips`); cap 365 rows. UI `/hr/my-attendance` ada filter from/to (default bulan ini), 3 summary cards (total hari/hari terlambat/total jam kerja), table dgn badge on-time/late/forgiven. Sidebar entry baru `myAttendance` (id/en/zh). |
| T-0180 | Purchase return module (schema + service + UI) â€” closes gap user reported (modul retur pembelian sebelumnya tidak ada) | Claude Opus 4.7 | 2026-05-25 19:00 WIB | 2026-05-25 19:25 WIB | DONE | Tests 685/685 PASS (+8 purchase-return-schemas). Schema baru `purchase_returns` + `purchase_return_lines` (migrasi 0033), permissions `purchasing.return.{create,approve,post}` (seeded ke management/director/vice_director). Service `createPurchaseReturn / submit / approve / post / cancel / list / get` dengan JE balik (DR GRNI / CR Inventory) + stock movement (reason='purchase_return') + optimistic locking via version. UI `/purchasing/returns` (list + status filter), `/purchasing/returns/new` (load GRN â†’ pick lines â†’ submit), `/purchasing/returns/[id]` (detail + action buttons). i18n parity id/en/zh untuk seluruh namespace `purchasing.returns.*` + sidebar `purchaseReturns`. |
| T-0179 | AI web_search switch Brave â†’ Exa (per user request, doc https://exa.ai/docs/reference/search-api-guide-for-coding-agents) | Claude Opus 4.7 | 2026-05-25 18:50 WIB | 2026-05-25 19:00 WIB | DONE | Tests 677/677 PASS (+3 web-search). `web-search.ts` rewrite ke POST https://api.exa.ai/search dengan `x-api-key` header + JSON body (`query`, `type:auto`, `numResults`, `contents.{highlights,summary}`). Snippet pakai prefer `summary` â†’ first `highlight` â†’ first 600 chars `text`. Env var ganti `EXA_SEARCH_API_KEY` (`.env.example` updated). Registry deskripsi disesuaikan. Structured `not_configured/rate_limited/upstream_error` masih sama. |
| T-0178 | Wire periodCompare ke 2 reporting pages + XLSX coverage sweep (aging/cogs/waste CSVâ†’XLSX) | Claude Opus 4.7 | 2026-05-25 12:20 WIB | 2026-05-25 12:45 WIB | DONE | Tests 674/674 PASS. Daily-summary + business-intelligence dapat delta badges "vs periode sebelumnya" (8 metric cards di daily-summary, 7 KPI di BI). `invertDelta` flag untuk metric cost-like (diskon/komisi/refund) supaya turun = hijau. Aging/COGS/Waste upgrade CSVâ†’XLSX real (exceljs, multi-sheet, numeric cells). i18n parity id/en/zh untuk `vsPrevious/noBaseline/exportSummarySheet/exportLinesSheet/exportSheet`. |
| T-0177 | AI web-search opt-in (Brave) + reporting period-compare helper | Claude Opus 4.7 | 2026-05-25 12:00 WIB | 2026-05-25 12:15 WIB | DONE | Tests 676/676 PASS (+6). Tool `web_search` (Brave API) terdaftar dengan gating `includeWebSearch` di registry; `setSessionWebSearch` service + checkbox UI "Izinkan pencarian web" optimistik. `periodCompare(current, fetcher)` + `previousPeriod()` di `@erp/services/reporting` â€” pure UTC date math (fix WIB-shift bug), 4 unit tests. |
| T-0176 | Auth hardening â€” sesi multi-device + revoke UI + PII log scrub + Naixer HMAC inbound | Claude Opus 4.7 | 2026-05-25 11:45 WIB | 2026-05-25 12:00 WIB | DONE | Tests 670/670 PASS (+11 shared). `/account` dapat section Sesi Aktif dengan revoke per-row + "logout everywhere"; password change otomatis invalidate sesi lain. `@erp/shared/log-scrub` (email/phone/NIK/NPWP/secret JSON keys) + `@erp/shared/hmac` (Stripe-style signed timestamp + timing-safe compare + 300s replay window). 11 tests baru. i18n `account.sessions.*` id/en/zh. |
| T-0175 | Shift change notification â€” in-app + email ke karyawan terkait | Claude Opus 4.7 | 2026-05-25 11:33 WIB | 2026-05-25 11:45 WIB | DONE | Tests 659/659 PASS (+5 notify-user). Email transport diekstrak dari `member/index.ts` ke `notification/email-transport.ts`. Helper baru `notifyUser/notifyUserByEmail` (resolve user by email â†’ in-app row + best-effort email). Hook ke schedule actions (`upsertAssignment` create+update, `deleteAssignment` snapshot-before-delete) â†’ fan-out notif title+body Bahasa Indonesia, subject `[Aroadri Tea] â€¦`. Best-effort: tidak rollback shift kalau email gagal. |
| T-0174 | F&B BI gaps â€” AR/AP aging + cash flow UI + COGS recipe costing + waste/spoilage | Claude Opus 4.7 | 2026-05-25 08:10 WIB | 2026-05-25 11:33 WIB | DONE | Tests 654/654 PASS (+4 reporting-aging). Service `aging` (AR/AP buckets 0-30/31-60/61-90/>90 dari journal_lines + due date), `cogsReport` (BOM Ã— cost dengan flag margin negatif), `wasteReport` (stock_adjustments reason match waste/susut/spoil/basi/expired). UI pages `/reporting/{aging-receivables,aging-payables,cash-flow,cogs,waste}` semuanya i18n bersih (id/en/zh paritas, namespace `reporting.aging`/`reporting.cashFlowPage`/`reporting.cogs`/`reporting.waste` + sidebar keys baru). CSV export + drill-down detail. Permission gate accounting.view/reports + inventory.view. |
| T-0173 | Compliance + AI wrap-up â€” E23 member delete (UU PDP) + log_complaint_draft + admin AI log + sweeper job | Claude Opus 4.7 | 2026-05-25 07:50 WIB | 2026-05-25 08:05 WIB | DONE | Tests 650/650 PASS (+3 member-delete). Member delete anonimisasi (name/email/phone/address â†’ `__deleted__`), revoke credentials+sessions, audit `delete` tanpa raw PII; UI `<DeleteAccountCard>` 2-step di /member/akun. Tool `log_complaint_draft` register dgn permission `crm.logComplaint`. Admin page `/settings/ai-assistant/log` dgn filter+pagination+summary. Sweeper job `ai-action-drafts-sweeper` (cron 04:30 WIB harian) mark draft pending kedaluwarsa jadi expired+audit. |
| T-0172 | AI Assistant Phase 3 â€” draft/confirm/commit pattern + 4 read tools + OCR struk + ConfirmActionCard | Claude Opus 4.7 | 2026-05-25 01:30 WIB | 2026-05-25 07:30 WIB | DONE | Tests 647/647 PASS (+4 ai-drafts). Schema `ai_action_drafts` (migrasi 0032) + service drafts (createDraft/getDraftForUser/cancelDraft/commitDraft) dengan re-cek permission target di server. Tools: `read_file`, `get_product`, `get_stock`, `get_today_sales_summary` (read-only) + `create_manual_sale_draft` (stage) + `ocr_receipt_struk` (vision â†’ JSON â†’ draft). UI `<ConfirmActionCard>` baru + Server Actions `confirmDraftAction/cancelDraftAction/fetchDraftAction`. Audit `ai_action_draft` ditambah. Web search & complaint draft di backlog. |
| T-0171 | AI Assistant Phase 2 â€” DeepSeek v4 client, tool registry, 3 read-only tools, vision content type | Claude Opus 4.7 | 2026-05-24 21:00 WIB | 2026-05-25 01:25 WIB | DONE | Tests 643/643 PASS (+10 ai-tools). Default model dinaikkan ke `deepseek-v4-flash` / `deepseek-v4-pro` (legacy alias deprecate 2026-07-24). Tool registry RBAC+audit + 3 tools (`request_admin_help`, `search_codebase` allow-listed, `get_recent_orders`). Tool-call loop dengan cap 4 round + replay `reasoning_content` (wajib per DeepSeek docs). UI chat dukung upload foto struk â†’ forward sebagai `image_url`. Audit `KNOWN_ENTITY_TYPES` diperluas. Phase 3 (OCR struk + write tools draftâ†’confirmâ†’commit + web search) tetap di backlog. |
| T-0170 | Audit 26-Dimensi & Direct Fix (Security/Correctness/Compliance/UX/Features/Architecture) + User Req 1-4 | Claude Opus 4.7 | 2026-05-24 15:30 WIB | 2026-05-25 23:48 WIB | DONE | Finalized by T-0186. Critical/High findings fixed, AI Phase 2/3/OCR/web-search completed by T-0171..T-0179, E23 member deletion completed, BI/export gaps closed, user requests through T-0185 shipped. Final report di `docs/audit/AUDIT-FIX-REPORT.md`; ledger di `docs/audit/AUDIT-FIX-LEDGER.md`. |
| T-0167 | Production readiness audit and critical fixes | Codex | 2026-05-15 13:03 | 2026-05-26 10:05 WIB (Codex) | DONE | Maintenance aging-payables server-action fix is already committed (`090addc`) and first prompt DoD was closed by T-0186. Current verification after follow-up work: typecheck, lint, test, and web build PASS. |

---

## Done This Sprint (Ã¢â€°Â¤ 7 days)

> After 7 days, move to `docs/checkpoints/archive/` and delete from here.

### Phase 1 Ã¢â‚¬â€ Foundation + Accounting + Reporting + Tax + MCP + Infra
### Phase 1 â€” Foundation + Accounting + Reporting + Tax + MCP + Infra

| ID | Title | Owner | Completed | Commit | Note |
|----|-------|-------|-----------|--------|------|
| T-0280 | UX/HCI audit and Dependabot warning remediation | Codex | 2026-06-09 | `5db1dea` + `301df93` + `this commit` | Resolved current npm audit/Dependabot advisories by bumping `better-auth` and `hono`; swept Settings UX/HCI for hardcoded UI text, i18n parity, aria labels, placeholders, and brand-token compliance; removed remaining generic color tokens from production `apps/web` source. Verified GitHub Dependabot API `open_dependabot_alerts=0`, audit, web/services/MCP typecheck, web build, i18n parity, and diff check. |
| T-0270 | Production backup cron repair for local PostgreSQL + rclone | Codex | 2026-06-03 | `this commit` | Cron fired as `aroadritea` but could not write root-owned logs/backups and had no rclone config. Moved job to root crontab, removed failing user cron, verified manual backup upload, and updated restore runbook. |
| T-0269 | Dependabot security updates for Vitest and tmp advisories | Codex | 2026-06-03 | `41c8102` | Resolved current dependency advisories by upgrading Vitest to 4.1.x and overriding transitive `tmp` to patched 0.2.x. Verified audit, typecheck, shared tests, and targeted services tests. |
| T-0268 | Production incident: switch PM2 back to local PostgreSQL after PG18 upgrade | Codex | 2026-06-03 | `57e11c4` | Found local PG18 data intact, PM2 dump still used old non-local DB env. Backed up local DB, reloaded PM2 from `.env`, saved dump, granted `pgboss` privileges, verified health/worker and PM2 reboot persistence. |
| T-0267 | Attendance face verification camera permission hotfix | Codex | 2026-06-03 | `HEAD` | Allows camera via `Permissions-Policy: camera=(self)` and auto-requests camera on `/hr/checkin` when face capture is required. Verified web typecheck. |
| T-0266 | Typecheck remediation + functional bug hunt sweep across ERP modules | Codex | 2026-06-03 | `cf198fe` | Inline attendance face verification/enrollment, functional bug patches from sweep, stock valuation (`stok x harga modal`), outgoing shipment CRUD/courier labels, consumed ingredient history, stock integer display, office stock locations. Verified `pnpm typecheck`, targeted Biome, targeted services tests. |
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
| T-0017 | UI `apps/web/(dash)/accounting/coa/` Ã¢â‚¬â€ COA browser tree + sidebar nav | Antigravity | 2026-05-08 | verified | typecheck clean, 152 tests pass |
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
| T-0031 | UI Settings Ã¢â€ â€™ Scheduled Jobs (list, toggle, edit cron) | Antigravity | 2026-05-09 | verified | typecheck clean |

### Phase 2 Ã¢â‚¬â€ POS + Inventory + BOM + Purchasing

| ID | Title | Owner | Completed | Commit | Note |
|----|-------|-------|-----------|--------|------|
| T-0050 | Schema products, product_variants, product_modifiers, categories | Antigravity | 2026-05-09 | verified | typecheck clean |
| T-0051 | Schema stock_locations, stock_movements, stock_levels | Antigravity | 2026-05-09 | included in T-0050 | |
| T-0052 | Schema BOM + bom_lines + bom_substitutes | Antigravity | 2026-05-09 | included in T-0050 | |
| T-0053 | Service inventory CRUD products + variants + categories | Antigravity | 2026-05-09 | verified | typecheck clean |
| T-0054 | Service inventory.adjust (workflow approval) | Claude Opus 4.6 | 2026-05-09 | wip(T-0054) | createDraft Ã¢â€ â€™ submit Ã¢â€ â€™ approve Ã¢â€ â€™ reject |
| T-0055 | Service inventory.transfer (2-step) | Claude Opus 4.6 | 2026-05-09 | included in T-0054 | Ship Ã¢â€ â€™ receive workflow |
| T-0056 | Schema sales_orders + lines + payments + refunds + shifts | Antigravity | 2026-05-09 | verified | typecheck clean |
| T-0057 | Service pos.createSale + shift services | Claude Opus 4.6 | 2026-05-09 | 5226328 | 263 tests pass |
| T-0058 | Service pos.refund | Claude Opus 4.6 | 2026-05-09 | 2ac4c2e | 282 tests pass |
| T-0059+60 | POS UI: shift open/close + order entry + payment modal | Claude Opus 4.6 | 2026-05-10 | verified | typecheck clean; payment flow logic fixed |
| T-0061 | PWA setup (Serwist) + service worker + IndexedDB outbox | Claude Opus 4.6 | 2026-05-10 | 1d70ba0 | typecheck clean |
| T-0062 | POS offline sync endpoint `/api/sync/pos` (idempotency) | Claude Opus 4.6 | 2026-05-10 | included in T-0061 | |
| T-0064 | Service purchasing.createPO + workflow approval | Claude Opus 4.6 | 2026-05-11 | ac09649 | 351 tests pass, typecheck clean |
| T-0065 | Service purchasing.createGRN + confirmGRN + JE generator | Claude Opus 4.6 | 2026-05-11 | 2a585d8 | 385 tests pass, typecheck clean |

### Phase 2.5 Ã¢â‚¬â€ Stock Opname + Petty Cash + Reimbursement

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
| T-0075 | Service stock opname session flow (generate Ã¢â€ â€™ count Ã¢â€ â€™ variance Ã¢â€ â€™ approve) | Claude Opus 4.6 | 2026-05-10 | fe2f2c8 | |
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
| T-0085h | Donation report Ã¢â‚¬â€ service + UI + MCP tool | Claude Opus 4.6 | 2026-05-10 | c3a40d1 | |
| T-0085j | Omzet Harian PB1-exclusive export (SD Ã‚Â§25.5b, SoT Ã‚Â§21.3b) | Claude Opus 4.6 | 2026-05-13 | e07bc00 | Schema, service, UI, XLSX, MCP tool |

### Phase 3 Ã¢â‚¬â€ Kitchen + KDS + Customer Display

| ID | Title | Owner | Completed | Commit | Note |
|----|-------|-------|-----------|--------|------|
| T-0081 | Service kitchen.generateQrPayload (strategy pattern dash/pipe) | Claude Opus 4.6 | 2026-05-11 | 90996f4 | 31 tests, strategy pattern |
| T-0082 | UI Settings Ã¢â€ â€™ Integrations Ã¢â€ â€™ Naixer KDS | Claude Opus 4.6 | 2026-05-11 | 88b8456 | CRUD + format config |
| T-0083 | Script seed-naixer-codes.ts (CSV import) | Claude Opus 4.6 | 2026-05-11 | 6fe303c | 22 tests, dry-run support |
| T-0084 | KDS Aroadri (production status: queued/making/ready) | Claude Opus 4.6 | 2026-05-11 | dadf8b4 | 26 tests, schema + service |
| T-0085i | Customer-facing display service (SSE) | Claude Opus 4.6 | 2026-05-11 | deb48bc | 11 tests, SSE + grouping |
| T-0086 | Schema naixer_product_codes + naixer_modifier_codes + naixer_qr_format_config | Claude Opus 4.6 | 2026-05-11 | 85654de | 3 tables + seed |
| T-0087 | POS Demo mode UI + IndexedDB sandbox | Claude Opus 4.6 | 2026-05-11 | 36d028a | 19 files, typecheck clean |

### Phase 4 Ã¢â‚¬â€ HR + Payroll + Attendance

| ID | Title | Owner | Completed | Commit | Note |
|----|-------|-------|-----------|--------|------|
| T-0100 | Schema employees + contracts + attendance + leaves | Claude Opus 4.6 | 2026-05-11 | e0f6a35 | |
| T-0101 | Service attendance check-in (mobile, GPS) | Claude Opus 4.6 | 2026-05-11 | e9eebc1 | |
| T-0102 | Payroll engine (PPh 21 progressive TER + runPayroll) | Claude Opus 4.6 | 2026-05-11 | ec839a7 | |
| T-0103 | Payroll approval + mark-paid + MCP tools + UI | Claude Opus 4.6 | 2026-05-11 | 959e9fe | Digital payslip UI is shipped; PDF export is optional enhancement |
| T-0104 | Warning letter SP1/SP2/SP3 (service + MCP + UI) | Claude Opus 4.6 | 2026-05-11 | f8150d3 | |

### Phase 5 Ã¢â‚¬â€ Public Website + CMS + Member + CRM + Loyalty

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

### Phase 6 Ã¢â‚¬â€ MCP Expansion + Custom Field + Workflow Engine

| ID | Title | Owner | Completed | Commit | Note |
|----|-------|-------|-----------|--------|------|
| T-0150 | Schema custom_field_definitions + custom_field_values | Claude Opus 4.6 | 2026-05-12 | 9e22eb9 | |
| T-0151 | Service customfield CRUD + value validation | Claude Opus 4.6 | 2026-05-12 | 9e22eb9 | |
| T-0152 | UI Settings Ã¢â€ â€™ Custom Fields | Claude Opus 4.6 | 2026-05-13 | b912783 | Entity tabs, CRUD modal, optimistic updates |
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

> **Audit kelengkapan fitur 2026-05-29** â€” 8 subagen memindai 137 halaman ERP + situs publik vs best-practice ERP F&B Indonesia. Detail implementasi tiap task (file:baris, backend yang sudah ada, scope, kewajiban i18n/audit) ada di section **"Backlog Detail â€” Audit 2026-05-29"** di bawah.
>
> Prioritas: `P0` = modul tampak jadi tapi alurnya putus / tidak berfungsi end-to-end; `P1` = kepatuhan pajak/ketenagakerjaan atau financial correctness; `P2` = kelengkapan fitur.

### Tier 1 â€” P0 Critical (alur putus / modul tidak berfungsi)

| ID | Title | Effort | Priority | Status |
|----|-------|--------|----------|--------|

| T-0213 | Wire `postJournal`/`reverseJournal` ke server action + tombol UI | S | P0 | ðŸŸ© DONE |
| T-0214 | POS: panggil promo engine otomatis saat checkout | M | P0 | ðŸŸ© DONE |
| T-0215 | POS: konsumsi voucher redemption + UI redeem di kasir | M | P0 | ðŸŸ© DONE |
| T-0216 | Purchasing: perbaiki double-DR persediaan + timing pengakuan AP | L | P0 | ðŸŸ© DONE |
| T-0217 | Logistik: outgoing shipment harus tulis `stockMovements` | M | P0 | ðŸŸ© DONE |
| T-0218 | HR: perbaiki `listMySchedule` + resolusi karyawan di check-in | S | P0 | ðŸŸ© DONE |

### Tier 2 â€” Pajak (kepatuhan DJP/Pemda)

| ID | Title | Effort | Priority | Status |
|----|-------|--------|----------|--------|
| T-0219 | e-Faktur / Faktur Pajak keluaran (NSFP + ekspor DJP) | L | P1 | ðŸŸ© DONE |
| T-0220 | SPT Masa PPN + ledger pajak masukan vs keluaran | L | P1 | ðŸŸ© DONE |
| T-0221 | PPh 23 / final + bukti potong (bupot) | M | P1 | ðŸŸ© DONE |
| T-0222 | Rekap PB1 bulanan per outlet (SPTPD/e-PBJT Pemda) | M | P1 | ðŸŸ© DONE |

### Tier 2 â€” Akuntansi

| ID | Title | Effort | Priority | Status |
|----|-------|--------|----------|--------|
| T-0223 | Jurnal penutup akhir tahun (Income Summary â†’ Laba Ditahan) | M | P1 | ðŸŸ© DONE |
| T-0224 | Disposal aset tetap (workflow + jurnal) | S | P2 | ðŸŸ© DONE |
| T-0225 | Pembayaran invoice parsial/cicilan + payment allocation | M | P1 | ðŸŸ© DONE |
| T-0226 | Laporan Perubahan Ekuitas (SAK ETAP) | S | P2 | ðŸŸ© DONE |
| T-0227 | Buku Besar drill-down per akun + comparative period | M | P2 | ðŸŸ© DONE |

### Tier 2 â€” Purchasing

| ID | Title | Effort | Priority | Status |
|----|-------|--------|----------|--------|
| T-0228 | Purchase invoice service + 3-way matching (POâ†”GRNâ†”Invoice) | L | P1 | ðŸŸ© DONE |
| T-0229 | Purchase Requisition (PR) + RFQ/quotation | M | P2 | ðŸŸ© DONE |
| T-0230 | Approval PO berjenjang (threshold nilai/multi-approver) | S | P2 | ðŸŸ© DONE |
| T-0231 | Master supplier (price list, lead time, rating) + landed cost | M | P2 | ðŸŸ© DONE |
| T-0232 | Perbaiki JE GRN/PO per inventory account + pajak retur | S | P1 | ðŸŸ© DONE |

### Tier 2 â€” Inventory / Kitchen

| ID | Title | Effort | Priority | Status |
|----|-------|--------|----------|--------|
| T-0233 | Reorder point min/max + alert low-stock per lokasi | M | P2 | ðŸŸ© DONE |
| T-0234 | Engine konversi UOM (kgâ†”gram, boxâ†”pcs) | M | P1 | ðŸŸ© DONE |
| T-0235 | Halaman kartu stok (stock ledger) per item/lokasi | S | P2 | ðŸŸ© DONE |
| T-0236 | FEFO depletion + alert kadaluarsa (perishable) | M | P1 | ðŸŸ© DONE |
| T-0237 | BOM: sub-recipe, yield/porsi, versi efektif, substitusi | M | P2 | ðŸŸ© DONE |

### Tier 2 â€” POS / CRM

| ID | Title | Effort | Priority | Status |
|----|-------|--------|----------|--------|
| T-0238 | POS: hold/recall (park) order | S | P2 | ðŸŸ© DONE |
| T-0239 | POS: open cash drawer (ESC/POS) + scan barcode/SKU | M | P2 | ðŸŸ© DONE |
| T-0240 | POS: tempel payload QR Naixer KDS ke sale lines | M | P1 | ðŸŸ© DONE |
| T-0241 | POS: perbaiki guard `voidSale` (status `paid` tak bisa void) | S | P1 | ðŸŸ© DONE |
| T-0242 | CRM: riwayat pembelian + benefit tier otomatis + segmentasi | M | P2 | ðŸŸ© DONE |

### Tier 2 â€” HR / Payroll

| ID | Title | Effort | Priority | Status |
|----|-------|--------|----------|--------|
| T-0243 | Payroll: beban BPJS pemberi kerja (engine + jurnal) | M | P1 | ðŸŸ© DONE |
| T-0244 | Payroll: engine THR (pro-rata) + lembur (/173 Ã—1.5/2) | M | P1 | ðŸŸ© DONE |
| T-0245 | Payroll: deteksi absen otomatis (ganti `absentDays:0`) | M | P1 | ðŸŸ© DONE |
| T-0246 | Payroll: file transfer bank + field rekening karyawan | S | P2 | ðŸŸ© DONE |
| T-0247 | Payroll: PPh21 TER bulanan (PMK 168/2023) + PTKP dari data | M | P1 | ðŸŸ© DONE |
| T-0248 | Payroll: lock periode vs periode akuntansi + reverse JE saat cancel | S | P1 | ðŸŸ© DONE |
| T-0249 | Whistleblower: schema `locationId` + kategori + severity | S | P2 | ðŸŸ© DONE |

### Tier 2 â€” IAM / Platform

| ID | Title | Effort | Priority | Status |
|----|-------|--------|----------|--------|
| T-0250 | UI User Management (CRUD user, assign role per lokasi, reset, suspend) | M | P1 | ðŸŸ© DONE |
| T-0251 | UI API Token MCP (mint/scope/revoke) | S | P2 | ðŸŸ© DONE |
| T-0252 | Tegakkan approver-role di workflow (separation of duties) | S | P1 | ðŸŸ© DONE |
| T-0253 | Scheduled-jobs: audit log + retry/history + `requirePermission` | S | P1 | ðŸŸ© DONE |
| T-0254 | Export audit log + password policy/lockout dari `loginAttempts` | M | P2 | ðŸŸ© DONE |
| T-0255 | Notifikasi: preferensi per-user + event bisnis per pengguna | M | P2 | ðŸŸ© DONE |
| T-0256 | Ekspansi MCP: roles/permissions, users, workflow, custom-fields | S | P2 | ðŸŸ© DONE |

### Tier 2 â€” CMS / Situs Publik / Support

| ID | Title | Effort | Priority | Status |
|----|-------|--------|----------|--------|
| T-0257 | CMS: editor rich-text/markdown + media library | M | P2 | ðŸŸ© DONE |
| T-0258 | CMS: wire revisi + scheduling + SEO meta di Post + filter tag blog | M | P2 | ðŸŸ© DONE |
| T-0259 | Situs publik: CTA link delivery + peta embed + jam buka per-outlet | S | P1 | ðŸŸ© DONE |
| T-0260 | Member: UI redeem poin + riwayat order dari `sales_orders` | S | P2 | ðŸŸ© DONE |
| T-0261 | Korespondensi: auto-nomor agenda + disposisi + multi-lampiran | M | P2 | ðŸŸ© DONE |
| T-0262 | Helpdesk: SLA per prioritas + indikator breach/eskalasi | S | P2 | ðŸŸ© DONE |

### Tier 3 â€” Kepatuhan aturan repo (CLAUDE.md)

| ID | Title | Effort | Priority | Status |
|----|-------|--------|----------|--------|
| T-0263 | i18n sweep: ekstrak string hardcode ke key (6 halaman) | S | P1 | ðŸŸ© DONE |

---

## Backlog Detail â€” Audit 2026-05-29

> Detail implementasi per task backlog hasil audit. Tiap entri: **Masalah** (gap), **Bukti** (file:baris), **Sudah ada** (backend yang bisa dipakai ulang, jangan dibangun ulang), **Scope** (acceptance), **Wajib** (i18n id/en/zh + audit trail per CLAUDE.md Â§5.7). Sebelum memperbaiki temuan P0 #T-0211/#T-0212/#T-0216, **verifikasi langsung** karena ini klaim paling berdampak.

### Tier 1 â€” P0 Critical

#### T-0211 â€” Payroll: field gaji pokok + pembuatan `employmentContracts` Â· `P0` Â· `M` ðŸŸ© DONE
- **Masalah**: `employmentContracts` tidak pernah di-insert; form karyawan tak punya input `baseSalary`. `run-payroll.ts` fallback gaji pokok `?? 0n` â†’ seluruh gaji, PPh21, dan BPJS dihitung dari basis Rp 0. Payroll tidak fungsional end-to-end.
- **Bukti**: `packages/db/schema/hr.ts:104` (tabel `employmentContracts` ada), `packages/services/src/hr/create-employee.ts:114`, `packages/services/src/payroll/run-payroll.ts:333`.
- **Sudah ada**: tabel kontrak, engine payroll, seed komponen gaji (`salary-components-seed.ts:29,40`).
- **Scope**: tambah field `baseSalary` + komponen kontrak di form `hr/employees/new` dan `[id]/edit`; insert/aktifkan `employmentContracts` saat create/update karyawan; guard validasi tolak run payroll jika baseSalary = 0.
- **Wajib**: i18n; audit saat tulis kontrak.

#### T-0212 â€” Inventory: valuasi weighted-average + jurnal HPP saat penjualan Â· `P0` Â· `L` ðŸŸ© DONE
- **Masalah**: `avgUnitCost` selalu ditulis `null` di GRN/transfer/opname; tidak ada perhitungan weighted-average/FIFO; tidak ada jurnal HPP (DR HPP / CR Persediaan) saat penjualan. Varians opname sering Rp 0; HPP hanya laporan teoretis.
- **Bukti**: `packages/services/src/purchasing/grn-service.ts:552`, `packages/services/src/inventory/transfer-service.ts:550`, `packages/services/src/pos/create-sale.ts:444-680`, `packages/services/src/reporting/cogs.ts:178`.
- **Sudah ada**: kolom `avgUnitCost` di schema, `stock_movements` append-only, depletion BOM di `create-sale.ts:444-475`.
- **Scope**: hitung & simpan weighted-average `avgUnitCost` saat GRN/transfer; posting jurnal HPP saat `createSale` pakai cost aktual; pastikan `varianceValue` opname terisi.
- **Wajib**: audit; jurnal lewat period guard yang sudah ada.

#### T-0213 â€” Wire `postJournal`/`reverseJournal` ke server action + tombol UI Â· `P0` Â· `S` ðŸŸ© DONE
- **Masalah**: fungsi `postJournal`/`reverseJournal` ada di service & MCP tapi tidak diekspos sebagai server action web â†’ jurnal manual dari web mandek di status `draft` selamanya. Tombol Buka Periode juga tak pernah dirender.
- **Bukti**: `apps/mcp/src/tools/accounting.ts:129,152` (fungsi ada), `apps/web/app/(dash)/accounting/journals/actions.ts` (belum ada action), `apps/web/app/(dash)/accounting/periods/page.tsx:7` (import) vs `:212-219` (tak dirender).
- **Sudah ada**: backend post/reverse aman (cek balance, periode, audit). Tinggal wiring.
- **Scope**: tambah `postJournalAction` + `reverseJournalAction` di `journals/actions.ts`; tombol di `journals/[id]/page.tsx`; render `OpenPeriodButton` di `periods/page.tsx`. Sertakan edit/hapus draft.
- **Wajib**: i18n; audit sudah ditangani service.

#### T-0214 â€” POS: panggil promo engine otomatis saat checkout Â· `P0` Â· `M`
- **Masalah**: engine `listActivePromotionsForSale` ada tapi tidak pernah dipanggil di `create-sale.ts` maupun web. Diskon hanya manual per-line. Happy hour, buy-X-get-Y, promo member tidak otomatis.
- **Bukti**: `packages/services/src/promotion/index.ts` (engine), `packages/services/src/pos/create-sale.ts` (tak ada panggilan), `apps/web/app/(dash)/pos/pos-cart-context.tsx` (diskon manual).
- **Sudah ada**: engine promosi, tabel `promotionApplications`, settings promosi (`settings/promotions`).
- **Scope**: panggil `listActivePromotionsForSale` di `createSale`; tampilkan preview promo di cart; simpan hasil ke `promotionApplications`.
- **Wajib**: i18n; audit pada aplikasi promo; jaga idempotency sync POS.

#### T-0215 â€” POS: konsumsi voucher redemption + UI redeem di kasir Â· `P0` Â· `M`
- **Masalah**: `redeemLoyaltyPoints` membuat `memberVouchers` (`PTS-*`) tapi `usedAt`/`usedInOrderId` tak pernah di-set; `payment-modal.tsx` tak punya field voucher â†’ poin bisa ditukar tapi tak bisa dibelanjakan; risiko double-spend.
- **Bukti**: `packages/services/src/member/index.ts:1535` (`redeemPoints`), `apps/web/app/(dash)/pos/payment-modal.tsx` (tak ada field voucher).
- **Sudah ada**: service redeem, schema `memberVouchers`, member lookup di POS.
- **Scope**: field input voucher di `payment-modal`; set `usedAt`/`usedInOrderId` dalam transaksi `createSale` (cegah double-spend, jaga idempotency).
- **Wajib**: i18n; audit penggunaan voucher.

#### T-0216 â€” Purchasing: perbaiki double-DR persediaan + timing pengakuan AP Â· `P0` Â· `L`
- **Masalah**: PO-approve posting `DR Persediaan / CR Utang`, lalu GRN-confirm posting lagi `DR Persediaan / CR GRNI` â†’ inventory ter-debit 2Ã—, AP diakui saat approve (sebelum barang datang). Pola standar: GRNâ†’GRNI, Invoiceâ†’balik GRNI ke AP.
- **Bukti**: `packages/services/src/purchasing/workflow.ts:310-339`, `packages/services/src/purchasing/grn-service.ts:429-456`.
- **Sudah ada**: GRNI account, optimistic locking, audit. **Verifikasi dengan akuntan sebelum ubah.**
- **Scope**: pindahkan pengakuan AP dari PO-approve ke purchase invoice (lihat T-0228); PO-approve hanya komitmen (tanpa JE persediaan); GRNâ†’GRNI; hindari double-DR.
- **Wajib**: audit; review SAK ETAP.

#### T-0217 â€” Logistik: outgoing shipment harus tulis `stockMovements` Â· `P0` Â· `M`
- **Masalah**: `outgoing-shipment.ts` tidak membuat `stockMovements` sama sekali â†’ barang keluar tidak mengurangi stok. Tidak ada penerimaan antar-lokasi.
- **Bukti**: `packages/services/src/logistics/outgoing-shipment.ts`, `packages/db/schema/logistics.ts:18-24` (alamat free-text, tanpa line item).
- **Sudah ada**: modul transfer antar-lokasi (`inventory/transfer-service.ts`) sebagai pola referensi.
- **Scope**: tambah line item + qty pada outgoing shipment; tulis `stockMovements` (out) saat kirim; jika antar-lokasi, pasangkan dengan movement (in) saat diterima.
- **Wajib**: audit; period guard.

#### T-0218 â€” HR: perbaiki `listMySchedule` + resolusi karyawan di check-in Â· `P0` Â· `S`
- **Masalah**: `list-my-schedule.ts:43` asumsi `user.id === employee.id` (padahal `createEmployee` membuat `users.id` terpisah) â†’ my-schedule kosong. `checkin/page.tsx:38` banding email plaintext vs kolom terenkripsi-lookup â†’ bisa gagal match.
- **Bukti**: `packages/services/src/hr/list-my-schedule.ts:43`, `packages/services/src/hr/create-employee.ts:114`, `apps/web/app/(dash)/hr/checkin/page.tsx:38`.
- **Sudah ada**: pola `encryptPiiForLookup` + resolusi userâ†’employee via email terenkripsi di service lain (mis. `listMyPayslips`, `listMyAttendance`).
- **Scope**: resolve employee via email terenkripsi konsisten di kedua tempat.
- **Wajib**: jangan log PII plaintext.

### Tier 2 â€” Pajak

#### T-0219 â€” e-Faktur / Faktur Pajak keluaran (NSFP + ekspor DJP) Â· `P1` Â· `L`
- **Masalah**: tidak ada penomoran NSFP, tabel faktur, atau output XML/CSV e-Faktur DJP. Kritis untuk B2B PKP.
- **Bukti**: schema pajak hanya `taxRates`+`taxRules` di `packages/db/schema/accounting.ts:183-227`; ekspor yang ada (`apps/mcp/src/tools/tax.ts:151-247`) hanya CSV ringkasan, bukan layout DJP.
- **Scope**: schema faktur pajak + NSFP; service create/post faktur dari invoice penjualan B2B; ekspor XML/CSV layout e-Faktur/Coretax terbaru; UI daftar faktur.
- **Wajib**: i18n; audit; jangan hardcode tarif (pakai `taxRates`).

#### T-0220 â€” SPT Masa PPN + ledger pajak masukan vs keluaran Â· `P1` Â· `L`
- **Masalah**: tidak ada rekap PPN keluaran vs masukan per masa; kode `PPN_IN` ada tapi tak ada ledger pengkreditan/rekonsiliasi.
- **Bukti**: `packages/db/schema/accounting.ts:183-227`; tak ada service rekap masa.
- **Scope**: ledger pajak masukan/keluaran per masa; rekap SPT Masa PPN (induk + lampiran); rekonsiliasi terhadap journal lines berkode pajak.
- **Wajib**: i18n; audit; ekspor.

#### T-0221 â€” PPh 23 / final + bukti potong (bupot) Â· `P1` Â· `M`
- **Masalah**: hanya PPh 21 yang dihitung (payroll). Tidak ada PPh 23 (jasa/sewa supplier), PPh final, atau dokumen bupot.
- **Bukti**: `packages/services/src/payroll/payroll-engine.ts:133-209` (hanya PPh21); tak ada modul PPh 23.
- **Scope**: hook pemotongan PPh 23 di pembayaran supplier (purchasing/AP); generate & ekspor bukti potong untuk DJP/penerima.
- **Wajib**: i18n; audit; tarif dari `taxRates`.

#### T-0222 â€” Rekap PB1 bulanan per outlet (SPTPD/e-PBJT Pemda) Â· `P1` Â· `M`
- **Masalah**: omzet PB1 ada di omzet-harian/BI tapi tidak ada form rekap bulanan per outlet untuk lapor Pemda.
- **Bukti**: `packages/services/src/reporting/daily-omzet.ts` (sumber data ada), tak ada rekap masa per lokasi.
- **Scope**: rekap PB1 bulanan per `location_id` (DPP, tarif, PB1 terutang); ekspor format SPTPD/e-PBJT; filter periode + outlet.
- **Wajib**: i18n; ekspor; multi-lokasi.

### Tier 2 â€” Akuntansi

#### T-0223 â€” Jurnal penutup akhir tahun (Income Summary â†’ Laba Ditahan) Â· `P1` Â· `M`
- **Masalah**: `close-period.ts:15-19` hanya komentar; tidak ada jurnal penutup pendapatan/beban â†’ Income Summary â†’ Laba Ditahan.
- **Bukti**: `packages/services/src/accounting/close-period.ts:15-19`.
- **Scope**: generate closing entries saat tutup tahun fiskal; saldo nominal di-nol-kan; neraca saldo setelah penutupan benar.
- **Wajib**: audit; tolak jika periode sudah tertutup.

#### T-0224 â€” Disposal aset tetap (workflow + jurnal) Â· `P2` Â· `S`
- **Masalah**: schema punya `disposalDate`/`disposalJournalEntryId` tapi tidak ada fungsi `disposeFixedAsset`; "disposed" hanya opsi filter.
- **Bukti**: `packages/db/schema/accounting.ts:374-376`, `apps/web/app/(dash)/accounting/assets/assets-client.tsx:125`.
- **Scope**: service `disposeFixedAsset` (hitung nilai buku, untung/rugi pelepasan, jurnal); tombol disposal di UI aset.
- **Wajib**: i18n; audit.

#### T-0225 â€” Pembayaran invoice parsial/cicilan + payment allocation Â· `P1` Â· `M`
- **Masalah**: `payInvoice` selalu melunasi `invoice.total` penuh; tidak ada cicilan/alokasi pembayaran. Tidak ada edit/void invoice posted.
- **Bukti**: `packages/services/src/accounting/invoice.ts:206`.
- **Scope**: dukung pembayaran parsial + alokasi ke beberapa invoice; status partially_paid; jejak sisa tagihan; mekanisme void/koreksi invoice posted (jurnal pembalik).
- **Wajib**: audit; period guard.

#### T-0226 â€” Laporan Perubahan Ekuitas (SAK ETAP) Â· `P2` Â· `S`
- **Masalah**: tidak ada halaman/service Laporan Perubahan Ekuitas (wajib SAK ETAP).
- **Bukti**: `apps/web/app/(dash)/reporting/` (tidak ada page); service reporting tak punya fungsi ini.
- **Scope**: service + UI Laporan Perubahan Ekuitas (modal awal, laba bersih, prive/dividen, modal akhir) + export.
- **Wajib**: i18n; export XLSX (ikuti pola reporting lain).

#### T-0227 â€” Buku Besar drill-down per akun + comparative period Â· `P2` Â· `M`
- **Masalah**: tidak ada halaman Buku Besar per akun; trial-balance tak punya drill-down ke jurnal; P&L/Neraca single-period (idealnya komparatif 2 periode).
- **Bukti**: `apps/web/app/(dash)/reporting/trial-balance/page.tsx` (tanpa drill-down).
- **Sudah ada**: helper `periodCompare`/`previousPeriod` di `@erp/services/reporting`.
- **Scope**: halaman Buku Besar (mutasi per akun + saldo berjalan, filter akun/periode/lokasi); drill-down dari trial-balance; comparative period di P&L/Neraca formal.
- **Wajib**: i18n; export.

### Tier 2 â€” Purchasing

#### T-0228 â€” Purchase invoice service + 3-way matching (POâ†”GRNâ†”Invoice) Â· `P1` Â· `L`
- **Masalah**: tabel `purchaseInvoices`/`purchaseInvoiceLines` ada tapi tidak ada service/UI â†’ invoice supplier tak bisa diinput/dicocokkan. (Terkait T-0216.)
- **Bukti**: `packages/db/schema/purchasing.ts:179-246` (tabel ada, nol service).
- **Scope**: service create/post purchase invoice; 3-way matching (qty & harga PO vs GRN vs invoice + toleransi); pengakuan AP di tahap invoice (balik GRNIâ†’AP); UI input & match.
- **Wajib**: i18n; audit; period guard.

#### T-0229 â€” Purchase Requisition (PR) + RFQ/quotation Â· `P2` Â· `M`
- **Masalah**: alur mulai langsung dari PO; tidak ada permintaan internal cabangâ†’pusat maupun perbandingan penawaran supplier.
- **Bukti**: `apps/web/app/(dash)/purchasing/` (tidak ada PR/RFQ).
- **Scope**: schema + service + UI PR (requestâ†’approveâ†’jadi PO); RFQ (kirim ke beberapa supplier, banding harga, pilih â†’ PO).
- **Wajib**: i18n; audit; gunakan workflow engine.

#### T-0230 â€” Approval PO berjenjang (threshold nilai/multi-approver) Â· `P2` Â· `S`
- **Masalah**: approval PO hanya 1 tingkat (`purchasing.po.approve`); tak ada threshold nilai/multi-approver.
- **Bukti**: `packages/services/src/purchasing/workflow.ts:200`.
- **Sudah ada**: workflow engine (`packages/services/src/workflow/`).
- **Scope**: aturan approval berjenjang berbasis nilai PO via workflow definitions; UI status multi-step.
- **Wajib**: audit; lihat T-0252 (enforce approver role).

#### T-0231 â€” Master supplier (price list, lead time, rating) + landed cost Â· `P2` Â· `M`
- **Masalah**: form supplier hanya nama/email/telp/termin/PKP. Tidak ada price list/harga kontrak, lead time, rating. Landed cost (ongkir/bea/PPN impor) tak masuk HPP.
- **Bukti**: `apps/web/app/(dash)/purchasing/supplier-form.tsx`, `packages/db/schema/accounting.ts:168` (`partners.paymentTermsDays` saja).
- **Scope**: perluas master supplier (price list per item, lead time, rating); alokasikan landed cost ke nilai persediaan saat GRN.
- **Wajib**: i18n; audit.

#### T-0232 â€” Perbaiki JE GRN/PO per inventory account + pajak retur Â· `P1` Â· `S`
- **Masalah**: JE GRN/PO memakai akun produk `lines[0]` untuk seluruh nilai (salah bila multi-kategori akun). `taxTotal` retur pembelian di-hardcode `0n` (salah untuk supplier PKP).
- **Bukti**: `packages/services/src/purchasing/grn-service.ts:424`, `workflow.ts:263-268`, `packages/services/src/purchasing/return-service.ts:219`.
- **Scope**: group JE per `inventoryAccountId` (bukan `lines[0]`); hitung pajak retur sesuai tarif.
- **Wajib**: audit.

### Tier 2 â€” Inventory / Kitchen

#### T-0233 â€” Reorder point min/max + alert low-stock per lokasi Â· `P2` Â· `M`
- **Masalah**: `stock_levels.minStock/maxStock` ada di schema tapi tak dipakai; halaman stock pakai threshold hardcode `< 5`.
- **Bukti**: `apps/web/app/(dash)/inventory/stock/page.tsx:219`.
- **Scope**: input min/max di form produk; halaman/notifikasi low-stock per lokasi memakai nilai nyata; integrasi ke purchasing (saran PO).
- **Wajib**: i18n; pakai sistem notifikasi.

#### T-0234 â€” Engine konversi UOM (kgâ†”gram, boxâ†”pcs) Â· `P1` Â· `M`
- **Masalah**: tidak ada logika konversi satuan; depletion BOM hanya cocok jika `uom` identik â€” beda UOM di-skip diam-diam (stok tak terkurang).
- **Bukti**: `packages/services/src/pos/create-sale.ts:520`.
- **Scope**: tabel base UOM + faktor konversi; terapkan di depletion BOM, GRN, transfer, opname; tolak/alert bila konversi tak tersedia (jangan skip diam-diam).
- **Wajib**: audit; uji unit konversi.

#### T-0235 â€” Halaman kartu stok (stock ledger) per item/lokasi Â· `P2` Â· `S`
- **Masalah**: `stock_movements` append-only ada tapi tidak ada UI riwayat pergerakan per item/lokasi.
- **Bukti**: `packages/db/schema/inventory.ts` (`stock_movements`), tak ada page.
- **Scope**: halaman kartu stok (mutasi masuk/keluar + saldo berjalan, filter item/lokasi/tanggal) + export.
- **Wajib**: i18n; export.

#### T-0236 â€” FEFO depletion + alert kadaluarsa (perishable) Â· `P1` Â· `M`
- **Masalah**: batch/expiry ditangkap di GRN tapi depletion abaikan `expiryDate`/`batchNo` (tak FEFO) dan tak ada alert kadaluarsa â€” kritis untuk teh/susu/lemon.
- **Bukti**: `packages/services/src/pos/create-sale.ts` (`deductIngredients` abaikan expiry), `shelfLifeDays` di schema produk.
- **Scope**: urutkan depletion & opname per `expiryDate` (FEFO); laporan/alert mendekati kadaluarsa (manfaatkan `shelfLifeDays`).
- **Wajib**: audit.

#### T-0237 â€” BOM: sub-recipe, yield/porsi, versi efektif, substitusi Â· `P2` Â· `M`
- **Masalah**: BOM tak bisa pakai finished_good lain (sub-recipe berjenjang); hanya qty per 1 unit (tanpa yield/porsi); `bomVersion` tanpa workflow aktivasi; `bom_substitutes` ada di schema tapi tanpa UI/logika; tak ada laporan theoretical-vs-actual.
- **Bukti**: `packages/db/schema/kitchen.ts` (`bomVersion`, `bom_substitutes`), `apps/web/app/(dash)/inventory/recipes/`.
- **Sudah ada**: auto-consume BOM (`create-sale.ts:444-475`).
- **Scope**: sub-recipe berjenjang; yield/porsi; aktivasi versi BOM efektif; logika substitusi; laporan pemakaian teoretis vs opname; tampilkan food cost di editor resep.
- **Wajib**: i18n; audit.

### Tier 2 â€” POS / CRM

#### T-0238 â€” POS: hold/recall (park) order Â· `P2` Â· `S`
- **Masalah**: tidak ada hold/recall/park order â€” kasir tak bisa parkir order saat antrean ramai.
- **Bukti**: `apps/web/app/(dash)/pos/` (0 match hold/recall).
- **Scope**: simpan order sementara (lokal/IndexedDB) + recall; jaga kompatibel offline.
- **Wajib**: i18n.

#### T-0239 â€” POS: open cash drawer (ESC/POS) + scan barcode/SKU Â· `P2` Â· `M`
- **Masalah**: tidak ada perintah buka laci kas; `product-search.tsx` tanpa scan barcode/SKU (input manual saja).
- **Bukti**: `apps/web/app/(dash)/pos/product-search.tsx`.
- **Scope**: kick laci ESC/POS saat pembayaran tunai; input scan barcode â†’ tambah item; cari produk via SKU/barcode.
- **Wajib**: i18n.

#### T-0240 â€” POS: tempel payload QR Naixer KDS ke sale lines Â· `P1` Â· `M`
- **Masalah**: `generateQrPayload` tidak dipanggil saat sale; `kdsQrToken`/`kdsQrPayload` tak diisi; label cetak pakai nomor pickup, bukan payload KDS Naixer â†’ integrasi dapur tak tersambung dari penjualan.
- **Bukti**: `packages/services/src/kitchen/generate-qr.ts`, `packages/services/src/pos/create-sale.ts`, `apps/web/app/(print)/pos/print/label/[orderId]/page.tsx:106`.
- **Sudah ada**: strategy QR dash/pipe (ADR-0007), mapping kode Naixer.
- **Scope**: panggil `generateQrPayload` saat `createSale`, isi `kdsQrToken`/`kdsQrPayload` per line; label cetak QR Naixer (pisah dari QR pickup).
- **Wajib**: audit.

#### T-0241 â€” POS: perbaiki guard `voidSale` (status `paid` tak bisa void) Â· `P1` Â· `S`
- **Masalah**: `voidSale` syaratkan `status !== 'open'` lalu tolak, padahal `createSale` selalu tulis `status: 'paid'` â†’ order POS normal tak pernah bisa di-void.
- **Bukti**: `packages/services/src/pos/create-sale.ts:1344` (guard) vs `:1021,:1264` (selalu `paid`).
- **Scope**: izinkan void status `paid` dalam window/shift sama (atau hapus jalur mati agar tidak menyesatkan); konsistenkan dengan jalur refund.
- **Wajib**: audit; period guard.

#### T-0242 â€” CRM: riwayat pembelian + benefit tier otomatis + segmentasi Â· `P2` Â· `M`
- **Masalah**: tidak ada tampilan riwayat pembelian pelanggan (hanya transaksi poin, limit 30); tier (bronze/silver/gold) ada tapi tak beri benefit otomatis; tak ada segmentasi/campaign; tak ada bundle/combo.
- **Bukti**: `packages/services/src/crm/member-service.ts` (limit 30 poin), `packages/services/src/member/index.ts`.
- **Scope**: riwayat order pelanggan dari `sales_orders`; benefit tier otomatis di harga/promo; segmentasi + broadcast campaign; tipe benefit bundle/combo.
- **Wajib**: i18n; audit.

### Tier 2 â€” HR / Payroll

#### T-0243 â€” Payroll: beban BPJS pemberi kerja (engine + jurnal) Â· `P1` Â· `M`
- **Masalah**: engine & jurnal hanya potong porsi karyawan (1% Kes + 2% TK); tidak ada beban pemberi kerja (Kes 4%, JKK/JKM/JHT, JP 2%) â†’ beban gaji & utang BPJS understated.
- **Bukti**: `packages/services/src/payroll/approve-payroll.ts:120-176`, `payroll-engine.ts`.
- **Scope**: tambah komponen beban pemberi kerja ke engine; jurnal beban + utang BPJS lengkap.
- **Wajib**: audit; tarif dari konfigurasi (jangan hardcode).

#### T-0244 â€” Payroll: engine THR (pro-rata) + lembur (/173 Ã—1.5/2) Â· `P1` Â· `M`
- **Masalah**: komponen THR/lembur ada di seed tapi tanpa perhitungan; hanya bisa input manual via `additionalEarnings`.
- **Bukti**: `packages/services/src/payroll/salary-components-seed.ts:29,40`.
- **Scope**: engine THR pro-rata masa kerja (gross-up Des); lembur rumus /173 Ã—1.5/2 dari jam lembur attendance.
- **Wajib**: audit; uji unit perhitungan.

#### T-0245 â€” Payroll: deteksi absen otomatis (ganti `absentDays:0`) Â· `P1` Â· `M`
- **Masalah**: `run-payroll.ts:289` `absentDays: sql\`0\`` di-hardcode â†’ `POTONGAN_ABSEN` tak pernah jalan otomatis.
- **Bukti**: `packages/services/src/payroll/run-payroll.ts:289`.
- **Sudah ada**: `shift_assignments` + attendance.
- **Scope**: hitung absen riil (shift terjadwal tanpa attendance) per periode payroll â†’ potongan absen otomatis.
- **Wajib**: audit.

#### T-0246 â€” Payroll: file transfer bank + field rekening karyawan Â· `P2` Â· `S`
- **Masalah**: tidak ada generator file transfer bank; karyawan tak punya kolom rekening.
- **Bukti**: form karyawan (`packages/services/src/hr/schemas.ts:30`).
- **Scope**: kolom rekening (bank, no rek, nama) di master karyawan; generator file/CSV transfer payroll per bank.
- **Wajib**: enkripsi PII rekening; audit.

#### T-0247 â€” Payroll: PPh21 TER bulanan (PMK 168/2023) + PTKP dari data Â· `P1` Â· `M`
- **Masalah**: engine annualisasiÃ—12 (bukan TER bulanan kategori A/B/C); PTKP/status pajak di-hardcode (`dependentsCount:0`, `isTaxable:true`, `isBpjsBase:true`) â€” NPWP/PTKP disimpan tapi tak dipakai.
- **Bukti**: `packages/services/src/payroll/run-payroll.ts:339-341`, `payroll-engine.ts:133-209`.
- **Scope**: terapkan skema TER bulanan PMK 168/2023; baca PTKP/`isTaxable`/`isBpjsBase` dari data karyawan; gross-up THR/bonus Des.
- **Wajib**: audit; uji terhadap contoh resmi.

#### T-0248 â€” Payroll: lock periode vs periode akuntansi + reverse JE saat cancel Â· `P1` Â· `S`
- **Masalah**: tidak ada lock payroll terhadap periode akuntansi tertutup; status `cancelled` ada tapi tanpa reverse JE.
- **Bukti**: `packages/services/src/payroll/approve-payroll.ts`.
- **Scope**: tolak posting payroll ke periode tertutup; reverse JE otomatis saat payroll dibatalkan.
- **Wajib**: audit.

#### T-0249 â€” Whistleblower: schema `locationId` + kategori + severity Â· `P2` Â· `S`
- **Masalah**: schema tanpa `locationId`, kategori disisipkan ke `description` string, tanpa severity; reporter tanpa audit (by design anonim).
- **Bukti**: `packages/db/schema/whistleblower.ts:53`.
- **Scope**: kolom `locationId`, `category`, `severity` terstruktur; pertahankan anonimitas reporter.
- **Wajib**: i18n; jangan log identitas reporter.

### Tier 2 â€” IAM / Platform

#### T-0250 â€” UI User Management (CRUD user, assign role per lokasi, reset, suspend) Â· `P1` Â· `M`
- **Masalah**: tidak ada UI user management terpusat; provisioning hanya lewat HR > Employees > edit-login atau seed.
- **Bukti**: tak ada `apps/web/app/(dash)/settings/users`; `packages/services/src/hr/update-employee-login.ts`.
- **Sudah ada**: permission engine location-scoped (`permission-engine.ts`), better-auth.
- **Scope**: halaman `settings/users` (daftar, buat user, assign/cabut role per `location_id`, reset password, suspend/enable).
- **Wajib**: i18n; audit; gate `iam`/`settings.manage`.

#### T-0251 â€” UI API Token MCP (mint/scope/revoke) Â· `P2` Â· `S`
- **Masalah**: schema `apiTokens`+scope ada, MCP verifikasi, `generateRawToken()` ada, tapi tak ada layar mint/revoke/scope.
- **Bukti**: `packages/db/schema/auth.ts:248`, `apps/mcp/src/auth.ts`.
- **Scope**: UI buat token (tampil sekali), set scope = scope user, daftar + revoke.
- **Wajib**: i18n; audit; jangan simpan token plaintext.

#### T-0252 â€” Tegakkan approver-role di workflow (separation of duties) Â· `P1` Â· `S`
- **Masalah**: pengecekan approver role tidak ditegakkan â€” siapa pun dengan `workflow.approve` bisa approve step milik role lain.
- **Bukti**: `packages/services/src/workflow/index.ts:264-266` (komentar "simplified").
- **Scope**: di `resolveStep`, verifikasi role user cocok dengan `approverRole` step sebelum izinkan approve.
- **Wajib**: audit; uji SoD.

#### T-0253 â€” Scheduled-jobs: audit log + retry/history + `requirePermission` Â· `P1` Â· `S`
- **Masalah**: `createScheduledJob`/`updateScheduledJob` tidak panggil `auditRecord` (langgar CLAUDE.md Â§5.7); tak ada retry/riwayat eksekusi (hanya `lastRunStatus/Error` 1 baris); page hanya cek session.
- **Bukti**: `packages/services/src/scheduled-jobs/index.ts`, `apps/web/app/(dash)/settings/scheduled-jobs/page.tsx`.
- **Scope**: tambah `auditRecord` pada create/update; riwayat eksekusi + retry; `requirePermission('settings.manage')` di page (defense-in-depth).
- **Wajib**: audit (wajib).

#### T-0254 â€” Export audit log + password policy/lockout Â· `P2` Â· `M`
- **Masalah**: audit punya filter+diff tapi tanpa export; password policy hanya `min(12)` hardcode; `loginAttempts` ada tapi rate-limit hanya bawaan better-auth (tak ada lockout terkonfigurasi).
- **Bukti**: `apps/web/app/(dash)/audit/page.tsx`, `apps/web/app/(dash)/account/actions.ts:24`, `packages/services/src/auth/auth.server.ts:110`.
- **Scope**: export audit (CSV/XLSX dengan filter); password policy terkonfigurasi (complexity/history) + lockout berbasis `loginAttempts`.
- **Wajib**: i18n.

#### T-0255 â€” Notifikasi: preferensi per-user + event bisnis per pengguna Â· `P2` Â· `M`
- **Masalah**: kanal hanya untuk outage/stock; tidak ada preferensi opt-in/out per user per kanal; bukan event bisnis per pengguna.
- **Bukti**: `apps/web/app/(dash)/settings/notifications/page.tsx`.
- **Scope**: tabel preferensi notifikasi per user/kanal; perluas trigger ke event bisnis (approval, due date, dll).
- **Wajib**: i18n; audit perubahan preferensi.

#### T-0256 â€” Ekspansi MCP: roles/permissions, users, workflow, custom-fields Â· `P2` Â· `S`
- **Masalah**: MCP belum expose manajemen roles/permissions, users/employee-login, workflow approve/list, custom-fields (`iam.ts` hanya `whoami` + locations).
- **Bukti**: `apps/mcp/src/tools/iam.ts`.
- **Scope**: tambah MCP tools untuk modul tersebut, lewat permission engine yang sama (tanpa super-user) per CLAUDE.md Â§6.
- **Wajib**: audit; scope per user.

### Tier 2 â€” CMS / Situs Publik / Support

#### T-0257 â€” CMS: editor rich-text/markdown + media library Â· `P2` Â· `M`
- **Masalah**: editor konten masih `<textarea>` polos (plain text di kolom jsonb); tidak ada media library.
- **Bukti**: `apps/web/app/(dash)/cms/cms-post-form.tsx:210`, `cms-page-form.tsx:204`.
- **Scope**: editor rich-text/markdown (atau block); media library bersama (reuse pipeline upload `api/uploads`).
- **Wajib**: i18n; sanitasi HTML (cegah XSS).

#### T-0258 â€” CMS: wire revisi + scheduling + SEO meta Post + filter tag blog Â· `P2` Â· `M`
- **Masalah**: tabel `cmsRevisions` ada tapi tak pernah ditulis; `scheduledAt` ada di schema tapi tak di Zod/form; publish tak set `publishedAt`; SEO meta hanya di Page (tak ada di Post); blog publik tanpa filter kategori/tag.
- **Bukti**: `packages/db/schema/cms.ts:30,121`, `packages/services/src/cms/index.ts` (publishPage 326-363, publishPost 576-613), `cms-page-form.tsx:217-247`, `apps/site/app/[locale]/blog/page.tsx`.
- **Scope**: tulis `cmsRevisions` saat update; tambah `scheduledAt` ke schema+form + worker cron publish; set `publishedAt` saat publish; SEO meta di Post form; filter kategori/tag di `/blog`.
- **Wajib**: i18n; audit.

#### T-0259 â€” Situs publik: CTA link delivery + peta embed + jam buka per-outlet Â· `P1` Â· `S`
- **Masalah**: tidak ada link delivery/pemesanan (GoFood/Grab/Shopee/WA) â€” padahal komisi delivery 20% aturan bisnis inti; lokasi hanya link "search" Google Maps + jam statis (`t('defaultHours')`), tidak baca jam dari DB.
- **Bukti**: `apps/site/app/[locale]/lokasi/page.tsx:184`; home/menu tanpa CTA delivery.
- **Scope**: CTA link delivery + WA di home & menu; peta embed per outlet; jam buka per-outlet dari DB; halaman/form kontak.
- **Wajib**: i18n (id/en/zh); situs publik hanya tampilkan outlet (bukan kantor).

#### T-0260 â€” Member: UI redeem poin + riwayat order dari `sales_orders` Â· `P2` Â· `S`
- **Masalah**: `redeemPoints` ada di service tapi tak ada UI redeem di halaman akun (voucher hanya ditampilkan); riwayat hanya poin, bukan order.
- **Bukti**: `packages/services/src/member/index.ts:1535`, `apps/site/app/[locale]/member/akun/page.tsx`.
- **Scope**: UI redeem poinâ†’voucher; riwayat order ditarik dari `sales_orders`.
- **Wajib**: i18n (perbaiki judul hardcode `member/akun/page.tsx:19,147`).

#### T-0261 â€” Korespondensi: auto-nomor agenda + disposisi + multi-lampiran Â· `P2` Â· `M`
- **Masalah**: nomor surat (`documentNo`) manual (tanpa generator/agenda); tanpa disposisi/routing (hanya `ownerUserId`); lampiran tunggal (`storageUrl`).
- **Bukti**: `packages/db/schema/correspondence.ts:22`.
- **Scope**: auto-generator nomor agenda (surat masuk/keluar); disposisi multi-step (workflow); multi-lampiran.
- **Wajib**: i18n; audit (sudah ada di jalur edit).

#### T-0262 â€” Helpdesk: SLA per prioritas + indikator breach/eskalasi Â· `P2` Â· `S`
- **Masalah**: `firstResponseAt` direkam tapi tanpa target SLA/deadline/breach/eskalasi.
- **Bukti**: `packages/db/schema/helpdesk.ts:51`.
- **Scope**: definisi SLA per prioritas (target first-response & resolution); indikator breach + eskalasi (notifikasi/auto-assign).
- **Wajib**: i18n; audit.

### Tier 3 â€” Kepatuhan aturan repo

#### T-0263 â€” i18n sweep: ekstrak string hardcode ke key (6 halaman) Â· `P1` Â· `S`
- **Masalah**: string Bahasa Indonesia/Inggris di-hardcode (langgar CLAUDE.md Â§5.7 prohibition absolut).
- **Bukti**: `apps/web/app/display/page.tsx` (baris 69,80,91,113,150,181); `accounting/journals/[id]/page.tsx` (108,113-130); `accounting/periods/page.tsx` (13-107,184); `hr/payroll/[id]/page.tsx` (38-47); `settings/attendance/page.tsx:28`; `apps/site/app/[locale]/member/akun/page.tsx` (19,147).
- **Scope**: pindahkan semua string ke key `next-intl`; tambah ke `en.json`, `id.json`, `zh.json` (paritas penuh).
- **Wajib**: jangan tinggalkan string hardcode baru.

---

## Effort Estimate

- **S** (Small): Ã¢â€°Â¤ 1 AI session work day
- **M** (Medium): 1Ã¢â‚¬â€œ2 days
- **L** (Large): 3Ã¢â‚¬â€œ5 days
- **XL** (Extra Large): > 5 days, must be split before starting

- `T-NNNN` (4 digits, zero-padded), global increment. Avoid skipping.

## AI Handoff

- AI starting a new session: check Active Ã¢â€ â€™ if there is IN_PROGRESS with `Last Updated` > 1 hour idle, may take over by updating `Owner`. If < 1 hour, **do not take over** (assume another session is still active).
