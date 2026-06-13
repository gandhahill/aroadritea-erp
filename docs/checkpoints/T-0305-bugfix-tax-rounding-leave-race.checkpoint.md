# Checkpoint: T-0305 — Bugfix: invoice tax rounding + leave approval race condition

- **Owner**: claude-sonnet-4-6
- **Started**: 2026-06-13 (lanjutan sesi yang sama dengan T-0304)
- **Last updated**: 2026-06-13
- **Status**: 🟩 DONE
- **Phase**: 3 (lanjutan T-0299 dual-lens audit, dari sumber eksternal)
- **Branch**: master (commit langsung, sesuai pola task kecil sebelumnya)

## Goal

User (Lintang) membuat dokumentasi audit lengkap terpisah di `E:\erp-benchmark` dan dump 3 dokumen analisis besar di root repo (`COMPREHENSIVE_ANALYSIS_SUMMARY.md`, `FEATURE_GAP_ANALYSIS.md`, `FUNCTIONAL_BUG_AUDIT.md`) yang membandingkan codebase ini terhadap 626+ fitur ERPNext/HRMS/Odoo. `COMPREHENSIVE_ANALYSIS_SUMMARY.md` memberi 3 bug "✓ VERIFIED" dengan confidence tinggi (sudah memisahkan dari "FALSE POSITIVES" dan "NEEDS INVESTIGATION"). Task ini: perbaiki bug-bug yang valid, backlog yang butuh keputusan bisnis.

- Spec teknis: tidak ada perubahan schema/ADR — pure logic fix di service layer existing.
- Sumber: `COMPREHENSIVE_ANALYSIS_SUMMARY.md` Bug #1 (Invoice Tax Precision), Bug #2 (Leave Approval Race Condition), Bug #3 (GRN Missing Cost Validation).

**Kriteria selesai (Definition of Done):**
- [x] Bug #1: `accounting/invoice.ts` line tax pakai `calculateExclusiveTax` (round-half-up), bukan truncating division
- [x] Bug #2: `hr/leave-service.ts` `approveLeave` claim via conditional UPDATE + `.returning()`, return `err` jika sudah diklaim
- [x] Bug #3: keputusan diambil (backlog G16, bukan hard-fail) — alasan didokumentasikan
- [x] Unit test baru untuk money rounding helpers (`packages/shared/tests/money.test.ts`, 39 test)
- [x] `pnpm --filter @erp/services typecheck` PASS
- [x] Biome clean pada 3 file yang diubah
- [x] `docs/benchmark/fnb-erp-gap-analysis.md` Part D/E diupdate (G16 + Part E continuation)
- [x] TASK.md updated (T-0304 commit SHA fix + T-0305 row)

## Plan

1. [x] Baca `COMPREHENSIVE_ANALYSIS_SUMMARY.md` untuk identifikasi bug "✓ VERIFIED"
2. [x] Fix Bug #1 (invoice tax rounding) — pakai existing `calculateExclusiveTax`
3. [x] Fix Bug #2 (leave approval race) — conditional UPDATE pattern
4. [x] Investigasi Bug #3 (GRN zero-cost) — tentukan apakah pure bug atau business policy
5. [x] Tulis `packages/shared/tests/money.test.ts` untuk lock-in rounding behavior
6. [x] Jalankan test, perbaiki assertion `formatRupiah` yang awalnya unverified (jadi `toContain` agar tidak bergantung pada spasi Intl)
7. [x] Run Biome pada 3 file yang diubah
8. [x] Update `docs/benchmark/fnb-erp-gap-analysis.md`: G1 row (sudah di sesi sebelumnya), tambah G16, update Part E
9. [x] Fix T-0304 row di TASK.md (`_pending_` → `e6ba8f3`, belum terupdate dari sesi sebelumnya)
10. [x] Tambah T-0305 row di TASK.md Phase 3 Done table
11. [ ] Commit (single commit, task kecil) + push ke `master`

## Done so far

- `packages/services/src/accounting/invoice.ts`:
  - Tambah import `calculateExclusiveTax` dari `@erp/shared/money`.
  - `createInvoice`: ganti `lineTax = (subtotal * BigInt(line.taxRate)) / 10000n` → `lineTax = calculateExclusiveTax(subtotal, line.taxRate)`.
- `packages/services/src/hr/leave-service.ts`:
  - `approveLeave`: UPDATE sekarang `WHERE id=leaveId AND status='pending' RETURNING id`; jika `claimed.length === 0` → `err(AppError.conflict('hr.leave.not_pending'))`. Reuse i18n key `hr.leave.not_pending` yang sudah dipakai di SELECT-check (pre-existing, belum ada di message JSON — bukan regresi baru, pattern sama di `kasbon-service.ts`/`overtime-service.ts`).
- `packages/shared/tests/money.test.ts` (BARU, 110 baris): 39 test untuk `rupiah`, `formatRupiah`, arithmetic, `multiply`/`divide` rounding, `calculateExclusiveTax`, `extractInclusiveTax`. Semua PASS.
- `docs/benchmark/fnb-erp-gap-analysis.md`:
  - Part D: tambah row **G16** (GRN zero-cost line policy, butuh keputusan Lintang).
  - "Decisions needed from Lintang": tambah G16 bullet.
  - Part E: item 5 (G1 done), item 6 (T-0305 summary), item 7 (audit lanjutan + triage `FUNCTIONAL_BUG_AUDIT.md`/`FEATURE_GAP_ANALYSIS.md`), item 8 (5 keputusan Lintang termasuk G16); next available task ID → T-0306.
- `TASK.md`:
  - Fix T-0304 row commit SHA `_pending_` → `e6ba8f3` (terlewat di sesi sebelumnya).
  - Tambah T-0305 row di Phase 3 Done table (commit `_pending_`, akan diisi setelah commit).

## Decisions

- **Bug #3 (GRN zero-cost) tidak di-hard-fail.** `packages/db/schema/purchasing.ts:103` `unitPrice` NOT NULL tapi `packages/services/src/purchasing/schemas.ts:19` zod regex `^\d+$` secara eksplisit mengizinkan `'0'` — ini constraint yang disengaja untuk barang gratis/sample. Audit report mengusulkan `return err('Goods cannot be received without cost basis')` jika `unitPrice=0` di GRN line maupun PO line — ini akan MEMATAHKAN flow barang gratis yang valid. Diputuskan: backlog sebagai **G16** dengan 3 opsi (leave as-is / warn-only / `isFreeGoods` flag) untuk keputusan Lintang, bukan auto-fix.
- **`hr.leave.not_pending` i18n key**: tetap reuse key existing yang sudah tidak ada di message JSON manapun (pre-existing gap, pattern konsisten dengan `hr.kasbon.not_pending`/`hr.overtime.not_pending` — sepertinya AppError business-rule codes ini di-render sebagai raw code atau ada mapping terpisah yang belum ditemukan). TIDAK menambah key baru karena scope task ini adalah race-condition fix, bukan i18n audit HR errors — tapi catat sebagai potential follow-up jika ditemukan UI yang benar2 menampilkan raw `hr.leave.not_pending` ke user.

## Open issues / Questions

- `FUNCTIONAL_BUG_AUDIT.md` (12-bug list, file:line + repro + fix code) belum diverifikasi terhadap kode current, kecuali overlap dengan 3 bug COMPREHENSIVE. CRITICAL #1 ("Invoice Payment Routes to Wrong Account") dan #2 ("Refund Amount Can Exceed Original Payment") prioritas tinggi untuk sesi berikutnya.
- `FEATURE_GAP_ANALYSIS.md` baru terbaca 100/1020 baris (Manufacturing Orders 0%, Batch/Lot/Expiry Tracking 0% sudah diidentifikasi sebagai gap besar, perlu cross-check terhadap `docs/benchmark/fnb-erp-gap-analysis.md` Part C §5 batch/expiry FEFO).
- 3 dokumen analisis root-level (`COMPREHENSIVE_ANALYSIS_SUMMARY.md`, `FEATURE_GAP_ANALYSIS.md`, `FUNCTIONAL_BUG_AUDIT.md`) masih untracked — belum diputuskan apakah dipindah ke `docs/benchmark/` atau dibiarkan di root sebagai working docs sementara.
- HR error-code i18n gap (`hr.leave.not_pending`, `hr.kasbon.not_pending`, `hr.overtime.not_pending` tidak ada di `messages/*.json`) — pre-existing across HR module, kemungkinan ditangani oleh generic error-code fallback di UI. Belum diverifikasi.

## Next step

Lanjutkan triage `FUNCTIONAL_BUG_AUDIT.md` CRITICAL #1 dan #2:
1. Baca ulang `FUNCTIONAL_BUG_AUDIT.md` bagian CRITICAL #1 "Invoice Payment Routes to Wrong Account" dan #2 "Refund Amount Can Exceed Original Payment" (sudah dibaca penuh sebelumnya tapi belum cross-verify ke kode).
2. Untuk #1: baca `packages/services/src/accounting/invoice.ts` `payInvoice` (baris 226-334, partnerLine matching by amount) dan bandingkan klaim audit dengan logic actual.
3. Untuk #2: cari refund service (`pos/refund-service.ts` atau sejenis via grep `refund`), cek apakah ada validasi `refundAmount <= originalPayment`.
4. Jika valid bug → fix + test seperti T-0305. Jika false positive → catat di checkpoint baru dan lanjut ke `FEATURE_GAP_ANALYSIS.md` baris 100-1020.
5. Setelah triase, assign T-0306, buat checkpoint baru, commit+push.

## Test status

- **Unit**: `pnpm --filter @erp/shared test -- money` → 39/39 PASS (2 test files termasuk file lain di package).
- **Typecheck**: `pnpm --filter @erp/services typecheck` → PASS (no errors).
- **Lint**: `pnpm biome check` pada 3 file berubah → "No issues found".
- **Integration/E2E**: belum — DB lokal `ETIMEDOUT 103.93.162.50:5432` (infra eksternal, sudah diketahui dari sesi-sesi sebelumnya).

## Files Touched

| Path | Action | Note |
|------|--------|------|
| `packages/services/src/accounting/invoice.ts` | edit | import `calculateExclusiveTax`, fix line tax rounding |
| `packages/services/src/hr/leave-service.ts` | edit | `approveLeave` conditional UPDATE claim |
| `packages/shared/tests/money.test.ts` | new | 39 unit tests for money/rounding helpers |
| `docs/benchmark/fnb-erp-gap-analysis.md` | edit | G16 backlog row, Part E continuation update |
| `TASK.md` | edit | T-0304 SHA fix + T-0305 row |
| `docs/checkpoints/T-0305-bugfix-tax-rounding-leave-race.checkpoint.md` | new | this file |

## Commits So Far

| SHA | Message | Date |
|-----|---------|------|
| _pending_ | `fix(T-0305): correct invoice tax rounding + leave approval race condition` | 2026-06-13 |

## Handoff Notes

- 3 root-level analysis docs (`COMPREHENSIVE_ANALYSIS_SUMMARY.md`, `FEATURE_GAP_ANALYSIS.md`, `FUNCTIONAL_BUG_AUDIT.md`) are untracked (`??` in git status) — left as-is, not committed, not yet cross-referenced into `docs/benchmark/fnb-erp-gap-analysis.md` beyond this task's 2 fixes + G16. Next session should decide their final home.
- Standing authorization remains: "ini adalah tugas panjang, tolong kerjakan sampai selesai, tidak perlu terburu-buru" — continue working through `FUNCTIONAL_BUG_AUDIT.md`/`FEATURE_GAP_ANALYSIS.md` without waiting for further prompts, following the same fix-or-backlog discipline as this task.

---

## Aturan File Ini

- **Update**: setiap 100+ baris code atau sub-step Plan diselesaikan.
- **Last updated**: WAJIB diperbarui setiap edit checkpoint.
- **Next step**: WAJIB konkret sebelum exit sesi.
- **Commits**: WAJIB tercatat (minimal SHA + tanggal) untuk bisa di-rebuild kontekstual.
- **Saat selesai**: ubah Status ke 🟩 DONE, lengkapi Commits, lalu update `TASK.md`.
- **Saat archive**: setelah 7 hari dari Done, pindahkan file ke `archive/`.
