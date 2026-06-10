# Checkpoint: T-0290 - SAK EP + tax compliance audit

- **Owner**: Codex
- **Started**: 2026-06-10 20:09 WIB
- **Last updated**: 2026-06-10 21:00 WIB
- **Status**: DONE
- **Phase**: 1
- **Branch**: `master`

## Goal

Pastikan modul akuntansi, pajak, dan laporan selaras dengan SAK Indonesia untuk Entitas Privat (SAK EP) dan regulasi perpajakan Indonesia yang relevan untuk Aroadri Tea, memakai referensi lokal `D:\KERJA\Aroadri Tea\SAK EP.md` dan `D:\KERJA\Aroadri Tea\DDTC Tax Manual.md`.

## Definition of Done

- [x] Matriks gap SAK EP dan pajak diturunkan dari referensi lokal.
- [x] SOURCE-OF-TRUTH dan SYSTEM-DESIGN diperbarui jika standar/aturan lama tidak sesuai.
- [x] Modul accounting mempertahankan double-entry, period lock, audit trail, dan klasifikasi SAK EP.
- [x] Modul tax memakai tarif/aturan efektif yang sesuai, tanpa hardcode tarif di service.
- [x] Modul reporting menghasilkan laporan minimum SAK EP: posisi keuangan, laba rugi/penghasilan komprehensif, perubahan ekuitas, arus kas, buku besar, neraca saldo, dan catatan/metadata compliance yang diperlukan.
- [x] MCP surface tetap setara untuk operasi/reporting yang relevan.
- [x] Test dan typecheck yang relevan dijalankan atau blocker dicatat eksplisit.

## Done

- Membaca `TASK.md`, `SOURCE-OF-TRUTH.md`, `SYSTEM-DESIGN.md`, ADR-0010, `SAK EP.md`, dan `DDTC Tax Manual.md`.
- Spot-check sumber resmi: IAI SAK EP efektif 2025, DJP/Kemenkeu PPN efektif 11% dari 12% x DPP 11/12, PMK 164/2023 PPh Final UMKM, PER-11/PJ/2025 Coretax/SPT Masa PPN.
- Menyelaraskan SoT/SD dari SAK ETAP ke SAK EP.
- Membuat ADR-0016 sebagai baseline compliance lintas accounting/tax/reporting.
- Membuat matriks audit di `docs/audit/sak-ep-tax-compliance-2026-06-10.md`.
- Mengoreksi treatment PPh Final UMKM vs PPh 25 di dokumentasi baseline.
- Menjelaskan PPN 2025 sebagai tarif efektif 11% untuk non-mewah biasa, bukan mengganti semua transaksi menjadi 12%.
- Memverifikasi service CALK/reporting, e-Faktur CSV cleanup, dan fixture cash-flow yang sudah ada di HEAD saat task ini ditutup.

## Decisions

- Task ini berdiri sendiri sebagai T-0290 karena task aktif T-0289 masih baru dan tidak diambil alih.
- Standar aktif proyek adalah SAK EP; ETAP hanya konteks historis.
- `PPH_FINAL_UMKM` harus dipisah dari `PPH25`; Rp500 juta adalah pengecualian WP orang pribadi, bukan PT/badan.
- `rate_bps=1100` untuk PPN adalah tarif efektif non-mewah biasa; dari 2025 merepresentasikan 12% x DPP nilai lain 11/12.
- Export Coretax/e-Faktur diperlakukan sebagai scaffold yang wajib diverifikasi terhadap template aktif masa pajak sebelum filing final.

## Residual Risks

- Formal sign-off tetap perlu akuntan/tax consultant.
- Renderer laporan formal masih perlu follow-up untuk comparative columns, current/non-current grouping, dan tampilan CALK final.
- Template Coretax final perlu diverifikasi saat periode filing aktual.

## Next Step

Follow-up yang dapat dieksekusi: buat task baru untuk renderer laporan formal SAK EP yang mengambil `reporting.financialStatementNotes()`, menampilkan angka komparatif, grouping current/non-current, dan paket PDF/XLSX lengkap; lalu validasi template Coretax aktif untuk periode filing pertama bersama konsultan pajak.

## Test Status

- **Unit**: PASS `pnpm --filter @erp/services test reporting-financial-statement-notes`
- **Targeted batch**: PASS `pnpm --filter @erp/services test reporting.test.ts cash-flow.test.ts tax-calculate.test.ts tax-resolve.test.ts tax-list-rates.test.ts reporting-financial-statement-notes.test.ts`
- **Typecheck**: PASS `pnpm --filter @erp/services typecheck`; PASS `pnpm --filter @erp/mcp typecheck`
- **Lint/format**: PASS scoped `pnpm exec biome check packages/services/src/tax/efaktur.ts packages/services/src/reporting/financial-statement-notes.ts packages/services/tests/reporting-financial-statement-notes.test.ts packages/services/tests/cash-flow.test.ts`
- **E2E**: N/A, no UI route changed.

## Files Touched

| Path | Action | Note |
|------|--------|------|
| `TASK.md` | Modified | Added then completed T-0290. |
| `docs/checkpoints/T-0290-sak-ep-tax-compliance.checkpoint.md` | Added | Compliance audit checkpoint. |
| `SOURCE-OF-TRUTH.md` | Modified | SAK EP + corrected tax baseline. |
| `SYSTEM-DESIGN.md` | Modified | SAK EP reporting, PPN, PPh Final UMKM/PPh25, Coretax guidance. |
| `docs/adr/0010-ppn-engine-opt-in.md` | Modified | PPN effective rate and `PPH_FINAL_UMKM` clarification. |
| `docs/adr/0016-sak-ep-and-tax-compliance-baseline.md` | Added | Compliance baseline ADR. |
| `docs/audit/sak-ep-tax-compliance-2026-06-10.md` | Added | SAK EP + tax compliance matrix. |
| `docs/adr/README.md` | Modified | ADR-0016 index. |
| `docs/custom-field-engine.md` | Modified | SAK EP terminology. |
| `docs/plans/MASTER-PLAN-S4-CLASS.md` | Modified | SAK EP terminology. |

## Commits So Far

| SHA | Message | Date |
|-----|---------|------|
| `this commit` | `fix: align SAK EP tax compliance baseline` | 2026-06-10 |
