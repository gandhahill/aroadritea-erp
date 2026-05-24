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
| `pnpm lint` (Biome) | ❌ FAIL (baseline debt) | 332 errors / 488 warnings dokumentasikan sebagai REC-002 di T-0168 |
| `pnpm build` | (belum dijalankan) | Akan dijalankan setelah edit besar |

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

## Backlog (carry-over)

| ID | Item | Severity | Catatan |
|----|------|----------|---------|
| BACKLOG-AI-TOOLS | AI Phase 2: tools read-only (search_codebase, read_file, get_recent_orders, get_stock, request_admin_help template) | 🟠 High | Spec sudah di ADR-0013. Setiap tool wajib lewat `requirePermission()` + audit. Rate limit per-tool tetap. |
| BACKLOG-AI-OCR | AI Phase 3: vision OCR + write tools (manual_sales draft → confirm → commit) + web-search opt-in | 🟠 High | Wajib pattern draft → konfirmasi → commit, dengan permission re-check di commit. |
| BACKLOG-T-0169 | Shift × Manual Sales integration (variance jurnal) | 🟡 Med | T-0169 belum selesai oleh owner sebelumnya; next step ada di checkpoint T-0169. |
| BACKLOG-LINT | Lint cleanup branch (332 err / 488 warn) | 🟢 Low | Format/import/a11y mechanical debt. Pisah PR. |
| BACKLOG-CSP | CSP `unsafe-inline` di `script-src` (apps/web + apps/site) | 🟢 Low | Next.js memerlukan inline untuk hidrasi; ganti ke nonce-based bila waktu memungkinkan. |
| BACKLOG-MCP-WRITE | MCP write tools (create_sale, create_product, cancel_po, dst) | 🟡 Med | Sesuai catatan T-0169 — menunggu keputusan pemilik untuk mengekspos write ke AI. |
| BACKLOG-PII-LOGS | Sweep error logs & toast messages untuk PII leakage | 🟢 Low | Audit ringan; gunakan `pii.ts` redactor di logger umum. |
| BACKLOG-A11Y | Aksesibilitas WCAG 2.1 AA pass formal (kontras, ARIA, kbd) | 🟢 Low | Phase D belum lengkap pada audit ini. |

<!-- Tambah temuan baru di bawah ini. Format kolom: ID | Area | Severity | Temuan (path:line) | Perbaikan | Status | Test -->

## Catatan Metodologi

1. **Discover → Fix → Verify** untuk tiap domain.
2. Setiap perbaikan disertai test regresi (bila perubahan logika).
3. Setiap perubahan permission/route/action wajib lulus `pnpm typecheck` + `pnpm test`.
4. i18n key paritas dijaga: tambah/ubah key di `en`/`id`/`zh` sekaligus.
5. 2FA tetap opsional — tidak ada perubahan yang memaksanya wajib.
6. Migrasi DB selalu file baru (jangan edit `0000_*`..`0028_*`).
