# SAK EP + Tax Compliance Matrix

- **Tanggal**: 2026-06-10
- **Task**: T-0290
- **Scope**: accounting, tax, reporting, MCP surface
- **Referensi lokal**:
  - `D:\KERJA\Aroadri Tea\SAK EP.md`
  - `D:\KERJA\Aroadri Tea\DDTC Tax Manual.md`
- **Referensi resmi spot-check**:
  - IAI: SAK EP efektif 1 Januari 2025 dan menggantikan SAK ETAP.
  - DJP/Kemenkeu: PPN non-mewah biasa 2025 memakai tarif efektif 11% dari 12% x DPP nilai lain 11/12.
  - JDIH Kemenkeu PMK 164/2023: PPh Final UMKM 0,5%, threshold Rp4,8 miliar, pengecualian Rp500 juta hanya WP orang pribadi.
  - DJP PER-11/PJ/2025: SPT Masa PPN/Coretax perlu template aktif masa pajak.

## Executive Status

| Area | Status | Catatan |
|---|---|---|
| Accounting ledger | Lulus baseline | Double-entry enforced, debit=credit check, period lock, reversal, close period, audit trail tersedia. |
| SAK EP reports | Dibetulkan | Standar aktif diganti dari SAK ETAP ke SAK EP; CALK/notes service ditambahkan. |
| Tax seed/rules | Dibetulkan | PPh Final UMKM dipisahkan dari PPh 25; PPN 11% dijelaskan sebagai tarif efektif. |
| PBJT retail F&B | Lulus baseline | PB1/PBJT inclusive tetap default untuk retail F&B, PPN_OUT default off sesuai ADR-0010. |
| Coretax/e-Faktur export | Perlu review final | CSV scaffold dibersihkan dari alamat dummy, tetapi template final tetap wajib diverifikasi terhadap Coretax aktif. |
| MCP parity | Dibetulkan | Tool `reporting.financial_statement_notes` tersedia untuk CALK SAK EP read-only. |

## SAK EP Matrix

| Requirement | Evidence | Status | Follow-up |
|---|---|---|---|
| Framework SAK EP untuk entitas privat | `SOURCE-OF-TRUTH.md` §10, `SYSTEM-DESIGN.md` §21.2, ADR-0016 | OK | Review akuntan sebelum laporan final. |
| Basis akrual kecuali arus kas | Journal engine accrual; `financialStatementNotes.accountingBasis` | OK | Renderer harus menampilkan basis ini di CALK. |
| Laporan lengkap: posisi keuangan, laba rugi/komprehensif, perubahan ekuitas, arus kas, CALK | Services reporting + new CALK service | OK baseline | UI/PDF formal perlu memasukkan CALK dan angka komparatif. |
| Tidak klaim patuh SAK EP tanpa laporan lengkap | `financialStatementNotes.complianceWarnings`, SD §21.2 | OK | Renderer final wajib memakai warning ini. |
| Klasifikasi current/non-current | COA subtype (`current_asset`, `fixed_asset`, `current_liability`, dst.) | Partial | Balance sheet renderer perlu expose current/non-current grouping formal. |
| Inventory policy | COA inventory + reporting notes | Partial | Inventory valuation/NRV disclosure perlu direview saat modul inventory final. |
| Fixed asset depreciation | Fixed asset service supports depreciation; SoT says straight-line | OK baseline | Useful life/residual value import dari daftar aset final. |
| Income tax disclosure | CALK tax section + tax services | Partial | Rekonsiliasi pajak komersial-fiskal belum otomatis. |
| First-time SAK EP transition | CALK input supports first SAK EP flag and previous framework | OK baseline | Reconciliation figures must be prepared manually/with future service. |

## Tax Matrix

| Requirement | Evidence | Status | Follow-up |
|---|---|---|---|
| PBJT/PB1 10% inclusive untuk retail F&B | SoT §6.5/§11, SD §19.2, daily omzet reports | OK | Pastikan Perda lokasi outlet tetap 10%. |
| Tidak kenakan PBJT + PPN ganda retail | ADR-0010, tax_rules default PB1 only, PPN_OUT false | OK | UI guard sudah disyaratkan; review implementasi UI saat settings tax dibuat. |
| PPN_IN supplier PKP aktif | SD §19.3.5, tax seed `PPN_IN` | OK baseline | SPT Masa PPN final perlu template Coretax aktif. |
| PPN 2025 non-mewah biasa efektif 11% | SD §19.1, ADR-0016, tax seed comment | OK | Jika ada objek DPP khusus/luxury, tambahkan metadata rate/DPP. |
| PPh Final UMKM 0,5% tidak tertukar PPh 25 | tax seed `PPH_FINAL_UMKM`, SD §19.6 | OK | Aktifkan rule hanya setelah status eligible dikonfirmasi. |
| Threshold PPh Final UMKM benar | SoT §11.2b, ADR-0016 | OK | Monitor omzet tahunan dan durasi PT. |
| PPh 21 payroll | Existing payroll PPh21 TER engine | OK baseline | Pastikan TER/PTKP update via DB saat regulasi berubah. |
| PPh 23/Bupot | Existing withholding service + Coretax BPU XML | OK baseline | UAT dengan contoh bukti potong nyata. |
| Coretax SPT Masa PPN | SPT Masa service + export scaffold | Partial | Template PER-11/PJ/2025/Coretax aktif harus dimodelkan sebelum filing. |
| Document retention | CALK record retention note | OK baseline | Implement storage retention policy jika dokumen pajak diupload. |

## Code Changes From Audit

- Added `reporting.financialStatementNotes()` and MCP tool `reporting.financial_statement_notes`.
- Added ADR-0016 as compliance baseline.
- Updated SoT/SD from SAK ETAP to SAK EP.
- Clarified PPN 11% as effective rate under 2025 12% x DPP 11/12 treatment.
- Split PPh Final UMKM treatment from PPh 25 in design/seed.
- Removed dummy `"Alamat"` from e-Faktur CSV export; invoice address is now used when present.

## Residual Risks

- This audit is an engineering compliance baseline, not a formal accountant/tax consultant sign-off.
- Coretax layouts can change; export files must be validated for the filing period before submission.
- Formal SAK EP financial statements still need final renderer work for comparative columns, current/non-current grouping, and complete CALK presentation.
