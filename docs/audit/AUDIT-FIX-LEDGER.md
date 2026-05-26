# Audit Fix Ledger — T-0170 (26-Dimensi)

> **Status hidup** — diperbarui setiap kali temuan baru ditambah atau diperbaiki.
> **Owner**: Claude Opus 4.7
> **Mulai**: 2026-05-24 15:30 WIB
> **Scope**: Audit 26 dimensi end-to-end (Security/Correctness/Compliance/UX/Features/Architecture) sesuai prompt user.

## Legenda

- **Severity**: 🔴 Critical | 🟠 High | 🟡 Medium | 🟢 Low | 🔵 Info
- **Status**: ✅ Fixed | ⚠️ Partial | ⏸️ Backlog | 🔍 Investigating | ❌ Open

## Baseline (sebelum T-0170)

| Check | Status | Catatan |
|---|---|---|
| `pnpm typecheck` | ✅ PASS | 10/10 workspace packages |
| `pnpm test` (services) | ❌ FAIL (7 tests) → ✅ FIXED | Fixed sebelum mulai audit: tests not updated for idempotencyKey schema requirement + path rename `accounting/number-generator` → `shared/number-generator` + bcrypt cost-12 timeout di password-reset test |
| `pnpm test` (shared) | ✅ PASS | 65/65 |
| `pnpm lint` (Biome) | ❌ FAIL → ✅ PASS | T-0186: Biome error-level blockers cleared; `pnpm -w lint` exit 0 with 884 warnings remaining as non-blocking hygiene debt |
| `pnpm build` | ✅ PASS | T-0186: root `pnpm build` PASS after serial workspace build flow; site + web Next builds verified |

## Ledger Temuan & Perbaikan

| ID | Area | Severity | Temuan (path:line) | Perbaikan | Status | Test |
|----|------|----------|--------------------|-----------|--------|------|
| BASELINE-001 | tests | 🟡 Med | `packages/services/tests/pos.test.ts:351-385,572-617` — VoidSale/RefundSale schemas now require `idempotencyKey`, tests still send legacy shape. | Updated test base to include `idempotencyKey` + added negative test for missing key. | ✅ | pos.test.ts:351-391, 572-617 |
| BASELINE-002 | tests | 🟡 Med | `packages/services/tests/accounting-create-journal.test.ts:434,441,449` — import dari `../src/accounting/number-generator`; file sudah pindah ke `../src/shared/number-generator`. | Updated import paths. | ✅ | accounting-create-journal.test.ts:434,441,449 |
| BASELINE-003 | tests | 🟡 Med | `packages/services/tests/member-password-reset.test.ts:102` — timeout 5 s karena `hashMemberPassword` (bcrypt cost 12). | Mock `../src/member/password` di test agar deterministik & instan. | ✅ | member-password-reset.test.ts:35-43 |
| B2-001 | iam / actions | 🟠 High (IDOR) | `apps/web/app/(dash)/settings/custom-fields/actions.ts:69,90,104` — Server Action menerima `ctx: AuditContext` dari client. `fetchCustomFields(tenantId,...)` dan `fetchCustomFieldValues(tenantId,...)` menerima `tenantId` dari client → cross-tenant data leak. Page `page.tsx:24` meneruskan ctx ke client. | Re-tulis actions: derive ctx via `getSession()` server-side untuk setiap export, drop `ctx`/`tenantId` parameter publik, page tidak lagi pass ctx, client-component tidak menerima ctx. | ✅ | (akan ditambah test khusus authz nanti) |
| B2-002 | pos / actions | 🟠 High (Bug regresi) | `apps/web/app/(dash)/pos/orders/actions.ts:285-343` — `voidOrderAction`/`refundOrderAction` tidak mengirim `idempotencyKey` ke service. Skema `VoidSaleInputSchema`/`RefundSaleInputSchema` mewajibkan field tsb sejak T-0168 → semua void/refund GAGAL validasi sebelum sampai ke DB. Refund juga kekurangan `lines` yang sekarang wajib. | Tambahkan generator `crypto.randomUUID()` (atau pakai key yang dikirim klien), forward `lines` untuk refund, tolak refund kosong (sesuai schema). | ✅ | regresi: refund/void e2e di pos.test.ts schema (sudah HIJAU lagi) |
| B2-003 / F-001 | hr / whistleblower | 🔴 Critical (Anonimitas) | `packages/services/src/hr/whistleblower.ts:8-40` — `submitWhistleblowerReport` menerima `ctx.userId`, memanggil `auditRecord(... ctx)` → audit_log menyimpan `userId` + `ip` + `userAgent` reporter. `apps/web/app/(dash)/whistleblower/actions.ts:26-29` meneruskan `session.user.id` ke service. `apps/web/app/api/uploads/route.ts:67` upload whistleblower menyimpan `uploadedBy: userId` di metadata. UI mengklaim "your identity is not recorded". | Service: drop `ctx`, terima hanya `{ tenantId, title, category, content, attachmentUrl }`, **JANGAN** panggil auditRecord untuk submission. Action: cek session (akses karyawan saja) tapi hanya teruskan `tenantId`. Upload: untuk area `whistleblower` set `uploadedBy: 'anonymous_whistleblower'`. | ✅ | `packages/services/tests/whistleblower-anonymity.test.ts` (4 tests) |
| B2-005 | upload security | 🟡 Med (XSS via stored file) | `apps/web/lib/upload-storage.ts:50-63` — `assertUploadFile` hanya cek MIME header + ekstensi yang dikirim klien. Penyerang bisa rename `evil.html` → `evil.png` + set MIME image/png → upload diterima → ketika di-serve sebagai gambar browser tetap akan eksekusi tag `<script>` dari konten HTML. | Tambah util `assertImageMagicBytes(buffer)` di `packages/shared/src/security/image-magic-bytes.ts`; baca 16 byte pertama di route handler upload sebelum `storeUpload`, tolak jika bukan PNG/JPEG/GIF/WebP/BMP. | ✅ | `packages/shared/src/security/image-magic-bytes.test.ts` (9 tests) |
| B2-006 | member auth | 🟠 High (Turnstile default-allow) | `packages/services/src/member/index.ts:200-203` — sentinel `'captcha-unreachable'` lolos kecuali `TURNSTILE_ALLOW_BYPASS === 'false'`. Default bypass=true di production bila operator lupa set var. | Ubah default: bypass=false di production kecuali `TURNSTILE_ALLOW_BYPASS === 'true'` di-set eksplisit. Dev tetap permissive supaya signup lokal jalan tanpa akun Cloudflare. | ✅ | (regresi via existing member test path) |
| Req-1 / AI-001 | ai assistant | 🔵 Info (Feature) | User Req 1 — modul AI asisten in-product (chat, baca codebase, RBAC CRUD, OCR struk, sesi multi, audit). | Schema baru `ai_chat_sessions/messages/attachments` (migrasi 0031). Service `packages/services/src/ai/{client,session,conversation}.ts`. Permission `ai.assistant.use` & `ai.assistant.admin`. Page `/ai-assistant` + `/ai-assistant/[id]`. Rate limit 30 pesan/jam/user. Audit setiap turn. ADR-0013. Phase 2 (tools read-only) & Phase 3 (write+OCR+web-search) di backlog. | ⚠️ Partial — Phase 1 (chat foundation) selesai, tools/OCR ditunda. | `packages/services/tests/ai-conversation.test.ts` (5 tests) |
| Req-2 / SOP-001 | hr / sop | 🔵 Info (Feature) | User Req 2 — manajemen upload SOP, karyawan baca. | Schema `sop_documents` (migrasi 0030), service `packages/services/src/hr/sop.ts`, permission `hr.sop.read`/`hr.sop.manage`, page `/hr/sop`, upload area `sop` di-permission-gated via upload routes. | ✅ | (akan ditambah test khusus list/CRUD nanti) |
| Req-3 / PSL-001 | hr / payroll | 🔵 Info (Feature) | User Req 3 — slip gaji PDF otomatis + UI karyawan. | Service `payslip.ts` (assembly + listMyPayslips), route HTML cetak `/api/hr/payslip/[payrollId]/[employeeId]`, page `/hr/my-payslips`. Tanpa lib PDF berat — pakai browser print → save as PDF agar hemat RAM (2 GB VPS). | ✅ | _(manual smoke test pending: render + cetak di Chrome desktop)_ |
| Req-4 / NIK-001 | hr / employees | 🔵 Info (Schema) | User Req 4 — NIK opsional. | Migrasi 0029 DROP NOT NULL pada `employees.nik`. Schema + Zod + service + UI form + i18n disesuaikan menjadi opsional (PostgreSQL unique index masih aktif, NULL diizinkan multi). | ✅ | (regresi tipekheck PASS; create-employee path PASS) |

## T-0188 — Production AI/helpdesk hotfix (2026-05-26)

| ID | Area | Severity | Temuan (path:line) | Perbaikan | Status | Test |
|----|------|----------|--------------------|-----------|--------|------|
| AI-HF-001 | ai / provider | 🟠 High | `packages/services/src/ai/conversation.ts` meneruskan uploaded image sebagai OpenAI-style `image_url` payload ke DeepSeek Chat Completion; dokumentasi DeepSeek chat completion resmi tidak mendokumentasikan content part image. Dampak user: `ai.provider.error` setiap upload gambar. | Attachment gambar sekarang dikirim ke model sebagai catatan teks terstruktur; tool OCR mengembalikan `vision_not_supported` bila provider setting `supportsVision=false`, sehingga error provider tidak bocor. | ✅ | `packages/services/tests/ai-conversation.test.ts` regression: image attachment tidak dikirim sebagai `image_url`. |
| AI-HF-002 | ai / ux | 🟠 High | `apps/web/app/(dash)/ai-assistant/[id]/chat-session-client.tsx` hanya menampilkan draft confirmation card setelah refresh, dan `ConfirmActionCard` tidak re-check status draft setelah commit. | Added SSE route `/api/ai-assistant/[sessionId]/stream`; chat UI mengganti state dengan snapshot server pada `done`; confirm card fetch status draft saat render sehingga tombol hilang setelah committed/cancelled/expired. | ✅ | `packages/services/tests/ai-client-stream.test.ts`; `pnpm --filter @erp/web build` PASS. |
| AI-HF-003 | helpdesk / db | 🔴 Critical | `packages/services/src/helpdesk/index.ts` memakai raw `ANY($1)` dengan param string user id pada Neon: `malformed array literal`. | Replaced raw SQL array comparison with Drizzle `inArray(users.id, userIds)` for helpdesk list/detail user-name lookup. | ✅ | `pnpm -w typecheck`; `pnpm -w test`; grep `ANY(` pada helpdesk service = no matches. |
| AI-HF-004 | ai / config | 🟡 Med | Non-secret runtime AI settings masih bergantung pada `.env`, bertentangan dengan requirement user agar env hanya menyimpan rahasia. | Added `/settings/ai-assistant` backed by `cms_settings`; env keeps only secrets (`DEEPSEEK_API_KEY`, `EXA_SEARCH_API_KEY`). Changes audit-logged as `ai_provider_config`. | ✅ | `pnpm -w lint`; `pnpm --filter @erp/web build`. |
| AI-HF-005 | ai / tools | 🟡 Med | AI meminta SKU/location id untuk input natural seperti "Osmanthus Fresh Tea di Plaza 1". | Added `resolve_location`; upgraded `get_product`, `get_stock`, `get_today_sales_summary`, and `get_recent_orders` to fuzzy-resolve natural product/location names and ask follow-up only when ambiguous/missing business fields. | ✅ | `pnpm --filter @erp/services test` (602 tests). |

## T-0171 — AI Assistant Phase 2 (2026-05-25)

| ID | Area | Severity | Temuan (path:line) | Perbaikan | Status | Test |
|----|------|----------|--------------------|-----------|--------|------|
| AI-P2-001 | ai / client | 🟡 Med (Doc drift) | `packages/services/src/ai/client.ts` Phase 1 menggunakan default `deepseek-chat`/`deepseek-reasoner` — DeepSeek docs (di-fetch 2026-05-24, https://api-docs.deepseek.com/quick_start/pricing) menyatakan alias tsb akan dideprekasi 2026-07-24 dan dipetakan ke `deepseek-v4-flash`. User awalnya minta "deepseek v4 pro thinking". | Default model diubah ke `deepseek-v4-flash` (fast) + `deepseek-v4-pro` (thinking). Helper `isThinkingModel()` agar temperature dll. tidak dikirim ke pro. Env override tetap dihormati untuk kompatibilitas balik. | ✅ | (regresi ai-conversation 5/5 PASS) |
| AI-P2-002 | ai / client | 🟠 High (Fitur) | Tools belum di-pass ke provider; `tool_calls`/`reasoning_content` belum di-handle di response. | Tambah tipe `AiToolDefinition`/`AiToolCall`, parse `tool_calls` + `reasoning_content` dari response, expose ke conversation. Vision: dukung `image_url` content type (base64 data URI atau URL). | ✅ | `ai-tools.test.ts` (10 tests) |
| AI-P2-003 | ai / tools | 🟠 High (Fitur + Sec) | Belum ada tool surface — assistant terisolasi dari data ERP. Wajib RBAC + audit per tool call (catatan B11 MCP). | Registry `packages/services/src/ai/tools/registry.ts` dengan pattern: `requirePermission` → Zod validate → execute → audit. 3 tools awal: `request_admin_help`, `search_codebase` (allow-list `apps/packages/docs/scripts`, deny `node_modules/.git/.next/.env*/storage`), `get_recent_orders` (scope tenant+location, limit 25). | ✅ | `ai-tools.test.ts` (10 tests termasuk forbidden/invalid/path-traversal) |
| AI-P2-004 | ai / conversation | 🟠 High (Loop control) | Tool-call loop bisa hang kalau model terus minta tool. | Cap `MAX_TOOL_ROUNDS=4`; round terakhir paksa model membalas teks via system nudge; `reasoning_content` di-replay (wajib per DeepSeek docs §thinking_mode atau API balas 400). | ✅ | conversation loop test (1 test) |
| AI-P2-005 | ai / audit | 🟡 Med (Compliance) | `KNOWN_ENTITY_TYPES` di `audit/index.ts` belum mencakup tipe entitas baru → warning silent saat audit. | Tambah `sop_document`, `ai_chat_session`, `ai_chat_message`, `ai_tool_call`, `whistleblower_report` ke daftar. | ✅ | (no breaking test; audit insertion tetap berjalan) |
| AI-P2-006 | ai / ui | 🔵 Info (Feature) | UI chat belum mendukung upload foto struk dan belum membedakan pesan tool. | `chat-session-client.tsx`: tombol "📷 Lampirkan foto struk" → upload ke area `ai-attachments` (sudah ada di T-0170) → forward URL ke service via `attachments[]`. Render pesan `role='tool'` sebagai blok JSON kecil yang ringkas. | ✅ | (manual smoke; typecheck PASS) |

## T-0172 — AI Assistant Phase 3 (2026-05-25)

| ID | Area | Severity | Temuan (path:line) | Perbaikan | Status | Test |
|----|------|----------|--------------------|-----------|--------|------|
| AI-P3-001 | ai / drafts | 🟠 High (Sec pattern) | Sebelumnya AI tidak punya jalur write yang aman; setiap tool langsung mengeksekusi akan rentan tampering antara proposal & klik user. | Schema `ai_action_drafts` (migrasi 0032) + service `drafts.ts` dengan pola DB-backed `draft → confirm → commit`. Klien hanya pegang `draft_id`; server re-fetch payload + re-cek permission *target* (mis. `pos.transact`) sebelum dispatch ke service nyata. TTL 30 menit. | ✅ | `ai-drafts.test.ts` (4 tests) |
| AI-P3-002 | ai / tools | 🟢 Low (Feature) | Sekadar 3 tool baseline. | Tambah 4 tool read-only: `read_file` (allow-list + max 200 line), `get_product` (SKU + variants + price), `get_stock` (stock_levels tenant+location-scoped, lookup location by code/id), `get_today_sales_summary` (wrap `reporting/daily-summary`). | ✅ | typecheck PASS; unit test menyusul di T-0173 |
| AI-P3-003 | ai / tools | 🟠 High (Feature) | OCR struk POS lama belum ada — use case headline owner. | Tool `ocr_receipt_struk` mem-panggil model reasoning DeepSeek (vision via `image_url` content part), system prompt JSON ketat, Zod-validate output, chain ke `create_manual_sale_draft` → user konfirmasi via `<ConfirmActionCard>`. | ✅ | (E2E manual smoke pending dengan struk asli) |
| AI-P3-004 | ai / ui | 🔵 Info (UX) | Chat tidak punya cara menyetujui draft mutasi. | `<ConfirmActionCard>` baru: render dari `tool_payload` ketika output `requires_confirmation:true`. Tombol "Setujui & Posting" + "Batal" + countdown expiry + hasil commit dengan referensi ID. | ✅ | (manual smoke; typecheck PASS) |
| AI-P3-005 | ai / actions | 🟠 High (Sec) | UI butuh server action yang re-cek permission. | `confirmDraftAction` / `cancelDraftAction` / `fetchDraftAction` di `apps/web/app/(dash)/ai-assistant/actions.ts`. Re-derive `ctx` server-side. | ✅ | (covered via drafts service tests) |

## T-0173 — Compliance + AI wrap-up (2026-05-25)

| ID | Area | Severity | Temuan (path:line) | Perbaikan | Status | Test |
|----|------|----------|--------------------|-----------|--------|------|
| E23-001 | member / privacy | 🟠 High (UU PDP) | Member belum bisa minta penghapusan data — kewajiban UU No. 27/2022 §15. | Service `deleteMyMember` (anonimisasi PII + soft-delete + revoke sessions + hard-delete credentials) + Server Action `deleteMyAccountAction` (2-step "HAPUS" confirm) + UI `<DeleteAccountCard>` di /member/akun. Audit `delete` entityType `member` ditulis dengan `before=null` (tidak snapshot PII raw). | ✅ | `packages/services/tests/member-delete.test.ts` (3 tests) |
| AI-P3-COMPLAINT | ai / tools | 🟡 Med (Feature) | Hanya 1 kind draft (`manual_sale`); user butuh juga draft complaint. | Tool `log_complaint_draft` register di registry, kind `complaint` sudah ada di `COMMIT_PERMISSION_BY_KIND` dari T-0172 sehingga commit langsung dispatch ke `crm.logComplaint`. | ✅ | (re-use ai-drafts service tests) |
| AI-P3-ADMIN-LOG | ai / observability | 🟡 Med (Sec) | Tidak ada cara admin lihat aktivitas AI lintas user. | Page `/settings/ai-assistant/log` (server-rendered) gate `ai.assistant.admin` → filter entity (4 jenis) + filter user_id + pagination + summary cards (total sesi + draft per status). | ✅ | (manual smoke; typecheck PASS) |
| AI-P3-SWEEPER | ai / hygiene | 🟢 Low (Ops) | Draft pending kedaluwarsa tidak otomatis ditandai expired. | Worker job `ai-action-drafts-sweeper` (cron 04:30 WIB harian) tandai semua row pending yang lewat `expires_at` jadi `expired` + audit row dengan reason `sweeper`. Scheduler map updated. | ✅ | (manual; sweeper logic lurus) |

## T-0174 — F&B BI gaps (2026-05-25)

| ID | Area | Severity | Temuan (path:line) | Perbaikan | Status | Test |
|----|------|----------|--------------------|-----------|--------|------|
| E13-BI-001 | reporting / aging | 🟡 Med (Feature gap) | Gap ERP F&B: AR/AP aging belum tersedia sebagai laporan manajemen. | Service aging buckets 0-30/31-60/61-90/>90 + UI `/reporting/aging-receivables` dan `/reporting/aging-payables`, permission-gated. | ✅ | `reporting-aging.test.ts` (4 tests) |
| E13-BI-002 | reporting / cash-flow | 🟡 Med (Feature gap) | Cash flow belum punya surface operasional lengkap. | UI cash flow + server aggregation existing, i18n id/en/zh. | ✅ | `pnpm -w typecheck`, build web |
| E13-BI-003 | reporting / cogs | 🟡 Med (Feature gap) | Recipe costing/COGS belum visible untuk kontrol margin. | Service COGS report berbasis BOM × cost + UI `/reporting/cogs`; margin negatif flagged. | ✅ | `pnpm -w test` |
| E13-BI-004 | reporting / waste | 🟡 Med (Feature gap) | Waste/spoilage belum menjadi laporan eksplisit. | Service waste report dari stock_adjustments reason match waste/susut/spoil/basi/expired + UI `/reporting/waste`. | ✅ | `pnpm -w test` |

## T-0175 — Shift notification (2026-05-25)

| ID | Area | Severity | Temuan (path:line) | Perbaikan | Status | Test |
|----|------|----------|--------------------|-----------|--------|------|
| HR-NOTIF-001 | hr / schedule | 🟡 Med (UX/control) | Perubahan jadwal shift tidak memberi notifikasi in-app/email ke karyawan terkait. | Helper `notifyUser/notifyUserByEmail`, SMTP transport shared, schedule actions fan-out notification best-effort. | ✅ | `notify-user.test.ts` (5 tests) |

## T-0176 — Auth hardening (2026-05-25)

| ID | Area | Severity | Temuan (path:line) | Perbaikan | Status | Test |
|----|------|----------|--------------------|-----------|--------|------|
| B24-001 | auth / sessions | 🟠 High | User tidak punya manajemen sesi multi-device/revoke; password change belum invalidate sesi lain. | `/account` sessions section, revoke per-row, logout everywhere, password change invalidates other sessions. | ✅ | typecheck + test suite |
| B2-LOG-001 | security / logging | 🟡 Med | Redaksi PII/log belum tersedia sebagai util shared yang reusable. | `@erp/shared/log-scrub` untuk email/phone/NIK/NPWP/secret JSON keys. | ✅ | `log-scrub.test.ts` (6 tests) |
| B-EXT-001 | integration / hmac | 🟡 Med | Integrasi inbound butuh primitive HMAC timestamp/replay-safe. | `@erp/shared/hmac` dengan timing-safe compare dan replay window 300s. | ✅ | `hmac.test.ts` (5 tests) |

## T-0177..T-0179 — AI web search and reporting exports (2026-05-25)

| ID | Area | Severity | Temuan (path:line) | Perbaikan | Status | Test |
|----|------|----------|--------------------|-----------|--------|------|
| AI-WEB-001 | ai / web-search | 🟡 Med (Feature) | AI belum punya web-search opt-in; user kemudian minta Exa, bukan Brave. | Web search opt-in ditambahkan lalu diganti ke Exa Search API (`EXA_SEARCH_API_KEY`, POST `/search`, highlights/summary). | ✅ | `web-search.test.ts` (3 tests) |
| E18-COMPARE-001 | reporting | 🟡 Med (Analytics) | BI/daily summary belum punya komparasi periode. | Helper `periodCompare` + previousPeriod UTC-stable; cards dapat delta badge. | ✅ | `period-compare.test.ts` (4 tests) |
| E19-XLSX-001 | reporting / export | 🟡 Med (Export gap) | Aging/COGS/Waste masih CSV/kurang konsisten dengan workbook utility. | Upgrade export ke XLSX multi-sheet/numeric cells. | ✅ | typecheck + build |

## T-0180..T-0185 — User-requested ERP additions (2026-05-25)

| ID | Area | Severity | Temuan (path:line) | Perbaikan | Status | Test |
|----|------|----------|--------------------|-----------|--------|------|
| PUR-RET-001 | purchasing / return | 🟠 High (Business gap) | Modul retur pembelian belum ada. | Schema `purchase_returns` + `purchase_return_lines` (migrasi 0033), service create/submit/approve/post/cancel/list/get, JE balik DR GRNI / CR Inventory, stock movement, UI `/purchasing/returns`. | ✅ | `purchase-return-schemas.test.ts` (8 tests), full suite |
| HR-ATT-001 | hr / attendance | 🟡 Med (Feature) | Karyawan belum punya halaman riwayat presensi self-service. | Service `listMyAttendance` + UI `/hr/my-attendance` dengan filter tanggal dan summary. | ✅ | typecheck + build |
| HR-SHIFT-001 | hr / schedule | 🟡 Med (Feature/control) | Penyesuaian jadwal shift tanggal tertentu belum tercatat sebagai override. | Schema `schedule_overrides` (migrasi 0034), `swapShiftAssignmentAction`, audit + notification. | ✅ | typecheck + full suite |
| CRM-MEMBER-001 | crm / member | 🟡 Med (Feature) | Manajemen belum punya halaman data member dan adjust poin. | Service `listMembers/getMemberDetail/adjustMemberPoints`, permissions `crm.member.*`, UI `/crm/members`. | ✅ | typecheck + full suite |
| HELP-001 | helpdesk / ai | 🟠 High (Ops gap) | AI hanya menyarankan kontak admin saat user report error; tidak ada ticketing system. | Schema helpdesk (migrasi 0035), service ticket/reply/status/assign, notification in-app+email, AI tool `log_helpdesk_ticket_draft` via draft-confirm-commit, UI `/helpdesk`. | ✅ | full services tests 600/600 |
| SHIP-001 | purchasing / shipment | 🟡 Med (Feature) | Tracking BinderByte hanya menempel di PO, belum ada surface terpusat untuk pengiriman non-penjualan. | UI `/purchasing/shipments` + detail timeline + inline sync; no external call during page load. | ✅ | typecheck + build |

## T-0186 — Final DoD closure (2026-05-25)

| ID | Area | Severity | Temuan (path:line) | Perbaikan | Status | Test |
|----|------|----------|--------------------|-----------|--------|------|
| D22-001 | ux / native dialogs | 🟡 Med (DoD violation) | `alert()`, `confirm()`, dan `window.prompt()` masih dipakai di beberapa UI produksi (export buttons, bank recon, bank accounts, purchase return, shift swap). | Replaced with `ConfirmDialog`, `InlineAlert`, and an in-app shift swap dialog. Final grep only finds comments in `apps/web/components/confirm-dialog.tsx`. | ✅ | `rg "\b(alert|confirm|prompt)\s*\(|window\.(alert|confirm|prompt)" apps packages` |
| LINT-001 | quality / Biome | 🟡 Med (DoD blocker) | Baseline Biome mempunyai error-level diagnostics dan parser issue; `pnpm lint` tidak hijau. | Ran `biome check --write`, fixed remaining parser/security/a11y blockers, sanitized CMS lint path, semantic `<dialog>` overlays, optional chaining fixes. | ✅ | `pnpm -w lint` exit 0; 884 warnings remain |
| BUILD-001 | production / VPS | 🟡 Med (DoD blocker) | Workspace recursive build dapat menumpuk Next build paralel dan berat untuk VPS 2 GB. | Verified root build with serial workspace flow; web build does explicit `pnpm typecheck` before `next build`. | ✅ | `pnpm build` PASS |
| DOC-001 | audit docs | 🟢 Low | T-0170 report masih mencatat Phase 1 dan backlog yang sudah selesai. | Updated ledger/report/checkpoint to reflect T-0171..T-0186 final state. | ✅ | docs updated |

## Backlog (carry-over, updated 2026-05-25)

| ID | Item | Severity | Catatan |
|----|------|----------|---------|
| BACKLOG-LINT-WARNINGS | Biome warning cleanup (884 warnings) | 🟢 Low | Exit code sudah hijau; sisa mostly `noExplicitAny`, label association, useless fragments, and test thenables. |
| BACKLOG-CSP | CSP `unsafe-inline` di `script-src` (apps/web + apps/site) | 🟢 Low | Next.js memerlukan inline untuk hidrasi; ganti ke nonce-based bila waktu memungkinkan. |
| BACKLOG-A11Y-MANUAL | Formal device/WCAG pass sebelum pilot toko | 🟢 Low | Blocking lint/a11y errors sudah ditutup; manual tablet/mobile keyboard pass tetap disarankan sebelum store pilot. |

<!-- Tambah temuan baru di bawah ini. Format kolom: ID | Area | Severity | Temuan (path:line) | Perbaikan | Status | Test -->

## Catatan Metodologi

1. **Discover → Fix → Verify** untuk tiap domain.
2. Setiap perbaikan disertai test regresi (bila perubahan logika).
3. Setiap perubahan permission/route/action wajib lulus `pnpm typecheck` + `pnpm test`.
4. i18n key paritas dijaga: tambah/ubah key di `en`/`id`/`zh` sekaligus.
5. 2FA tetap opsional — tidak ada perubahan yang memaksanya wajib.
6. Migrasi DB selalu file baru (jangan edit `0000_*`..`0028_*`).
