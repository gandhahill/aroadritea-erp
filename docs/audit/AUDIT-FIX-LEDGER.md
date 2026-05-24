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

<!-- Tambah temuan baru di bawah ini. Format kolom: ID | Area | Severity | Temuan (path:line) | Perbaikan | Status | Test -->

## Catatan Metodologi

1. **Discover → Fix → Verify** untuk tiap domain.
2. Setiap perbaikan disertai test regresi (bila perubahan logika).
3. Setiap perubahan permission/route/action wajib lulus `pnpm typecheck` + `pnpm test`.
4. i18n key paritas dijaga: tambah/ubah key di `en`/`id`/`zh` sekaligus.
5. 2FA tetap opsional — tidak ada perubahan yang memaksanya wajib.
6. Migrasi DB selalu file baru (jangan edit `0000_*`..`0028_*`).
