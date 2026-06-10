# Kartu Fase 3 — sapu fungsional + 12 skenario E2E (siap eksekusi)

> Bagian dari `docs/plans/MASTER-PLAN-S4-CLASS.md` §7. Baca §1 (kontrak eksekutor) dulu.
> Dipecah Perencana 2026-06-10 (T-0287) dari inventaris repo. Bila beda dengan ringkasan master plan, kartu ini menang.
> Konteks penting: test yang ada di `packages/services/tests/*.test.ts` (±44 file) mayoritas unit test dengan `vi.mock('@erp/db')`. Aturan repo (CLAUDE.md §5.7) melarang mock DB untuk test integrasi, jadi fase ini dimulai dengan membangun harness DB nyata.

---

### Kartu F3.0 — Harness test integrasi DB nyata
- **Effort**: M · **Dependensi**: gerbang F2 tutup
- **Tujuan**: pola test integrasi yang bisa dipakai 12 kartu skenario: koneksi ke `DATABASE_URL_TEST`, seed minimal (tenant, lokasi, COA dari seed resmi, 1 user per role, produk + BOM contoh), isolasi antar test (schema khusus per run atau truncate berurutan), dan skip otomatis bila `DATABASE_URL_TEST` kosong (supaya dev lokal tanpa DB tetap bisa `pnpm test`).
- **Baca dulu**: `packages/db/seed/` (seed resmi yang sudah ada — pakai ulang, jangan tulis seed tandingan), `packages/services/tests/accounting-close-period.test.ts` (pola lama), `packages/db/client.ts`.
- **File yang boleh disentuh**: `packages/services/tests/integration/helpers/` (baru), `packages/services/package.json` (script `test:integration`), `.github/workflows/ci.yml` (step test integrasi memakai secret `DATABASE_URL_TEST`).
- **Langkah**: 1) helper `setupIntegrationDb()` (migrate + seed sekali per run); 2) helper `createTestContext(role, locationId)`; 3) satu test contoh end-to-end kecil (buat jurnal → post → assert saldo) sebagai bukti pola; 4) wire CI.
- **Larangan khusus**: dilarang `vi.mock('@erp/db')` di folder `tests/integration/`; dilarang menunjuk `DATABASE_URL` produksi (tolak bila host mengandung domain produksi, tulis guard eksplisit di helper).
- **Bukti selesai**: `pnpm --filter @erp/services test:integration` hijau lokal dengan Postgres lokal; CI hijau; `pnpm verify`.

---

## Kartu F3.1 — Matriks lifecycle entitas

- **Effort**: L (boleh 2 sesi: paruh entitas per sesi) · **Dependensi**: gerbang F2
- **Tujuan**: `docs/audit/lifecycle-matrix.md` terisi untuk 18 entitas × 14 kolom dengan bukti file:baris per sel.
- **Entitas → service acuan** (hasil inventaris, jangan cari ulang dari nol):
  journal (`accounting/post-journal.ts`, `create-journal.ts`), invoice AR (`accounting` invoices), purchase invoice (`purchasing/purchase-invoice-service.ts`), PO (`purchasing/create-po.ts`), GRN (`purchasing/grn-service.ts`), purchase return (`purchasing/return-service.ts`), purchase requisition (`purchasing/pr-service.ts`), stock adjustment (`inventory`), transfer (`inventory/transfer-service.ts`), opname (`inventory/opname-service.ts`), sales order (`pos/create-sale.ts`), refund (`pos/refund-sale.ts`), manual sales closing (`pos/manual-sales.ts`), payroll run (`payroll/run-payroll.ts`, `approve-payroll.ts`), leave/overtime/kasbon (`hr`), complaint (`crm`), shipment (`logistics`), helpdesk ticket (`helpdesk`).
- **Kolom**: draft · submit · approve · post/confirm · cancel/reverse · attachment · audit_log · print/export · riwayat status · pencarian/filter · paginasi · i18n 3 bahasa · permission gate · MCP tool.
- **Aturan pengisian**: tiap sel ✅/❌/⚠️ + bukti (path:baris atau "tidak ada"). Dilarang mengisi dari ingatan/dugaan. Sel ❌ pada kolom approve/post/cancel/audit/permission = catat sebagai kandidat P0/P1 di bagian bawah file matriks.
- **Bukti selesai**: file matriks lengkap 18 baris; daftar kandidat bug ber-prioritas; tidak ada perubahan kode di kartu ini.

---

## Kartu F3.2–F3.13 — 12 skenario E2E

Aturan umum semua skenario: satu kartu = satu file di `packages/services/tests/integration/`; pakai harness F3.0; assert ANGKA persis (debit=kredit, saldo akun spesifik, level stok), bukan sekadar "tidak error"; tiap assert gagal = bug → ikuti loop F3.14, JANGAN melonggarkan assert supaya hijau. Bukti selesai semua kartu: test hijau lokal + CI + `pnpm verify`.

### F3.2 — Penjualan POS tunai end-to-end (Effort M)
- File uji: `scenario-pos-sale.test.ts`. Service: `pos/create-sale.ts`.
- Alur: buka shift → createSale (produk ber-BOM, PB1 inklusif, bayar tunai) → assert: (a) JE seimbang dengan baris Kas, Pendapatan, utang PB1 (tarif dari `tax_rates`, bukan hardcode); (b) JE HPP terposting dengan nilai = Σ(qty BOM × avg cost), (c) stock_levels bahan berkurang sesuai BOM dengan konversi UoM benar (regresi commit `16689a7` + `6193dd3`: UoM resep ≠ UoM stok, beda case/spasi), (d) loyalty earn tercatat bila member.

### F3.3 — Refund & void (Effort S)
- File uji: `scenario-pos-refund-void.test.ts`. Service: `pos/refund-sale.ts`, `voidSale` di `create-sale.ts`.
- Assert: refund membuat JE balik + stok bahan kembali; void atas order `paid` DITOLAK (regresi T-0241); refund dua kali atas order yang sama ditolak; audit_log berisi kedua aksi.

### F3.4 — Sync offline idempoten (Effort M)
- File uji: `scenario-pos-offline-sync.test.ts`. Endpoint: `apps/web/app/api/sync/pos/route.ts` + `shared/idempotency.ts`.
- Assert: kirim payload sama 2× (Idempotency-Key sama) → 1 sales_order, respons kedua = replay tersimpan; `clientOrderUuid` duplikat dengan key berbeda → tetap 1 order; payload korup → error terstruktur tanpa row nyangkut; klaim idempotency yang gagal dilepas (regresi T-0201).

### F3.5 — Procure-to-pay penuh (Effort L, boleh 2 sesi: sampai GRN, lalu invoice–pembayaran)
- File uji: `scenario-procure-to-pay.test.ts`. Service: `pr-service.ts` → `create-po.ts` (+approval threshold) → `grn-service.ts` → `purchase-invoice-service.ts` (3-way match) → pembayaran parsial.
- Assert: PO di atas ambang butuh approve (workflow); GRN menulis stock_movements + JE DR Persediaan / CR GRNI; invoice cocok 3-way (selisih qty/harga → tertahan); pembayaran parsial 2× mengalokasikan benar; setelah lunas saldo GRNI untuk PO itu = 0 dan AP = 0 (regresi T-0216: double-DR persediaan).

### F3.6 — Retur pembelian (Effort S)
- File uji: `scenario-purchase-return.test.ts`. Service: `purchasing/return-service.ts`.
- Assert: retur atas GRN mengurangi stok, JE DR GRNI / CR Persediaan senilai cost, pajak retur benar, tidak bisa retur melebihi qty GRN, optimistic-lock version bekerja.

### F3.7 — Transfer antar lokasi 2 langkah (Effort S)
- File uji: `scenario-stock-transfer.test.ts`. Service: `inventory/transfer-service.ts`.
- Assert: ship → stok sumber turun (status in-transit), receive → stok tujuan naik; avg cost di lokasi tujuan terhitung ulang benar; receive qty ≠ ship qty ditolak/di-variance-kan sesuai aturan service; race ship dobel ditolak (regresi temuan T-0169).

### F3.8 — Stock opname (Effort S)
- File uji: `scenario-stock-opname.test.ts`. Service: `inventory/opname-service.ts`.
- Assert: generate → count → submit → approve menghasilkan JE penyesuaian = (fisik − sistem) × avg cost per item; arah JE benar untuk plus dan minus; opname yang belum approve tidak menyentuh stok.

### F3.9 — Payroll (Effort M)
- File uji: `scenario-payroll.test.ts`. Service: `payroll/run-payroll.ts`, `payroll-engine.ts`, `approve-payroll.ts`.
- Assert: karyawan dengan kontrak + attendance (1 hari absen tanpa dispensasi, 2 jam lembur) → gross/potongan/netto sesuai rumus (PPh21 TER PMK 168/2023 per golongan PTKP dari data karyawan, BPJS karyawan+pemberi kerja, lembur /173 ×1.5/2); approve → JE beban gaji seimbang; markPaid → status; run pada periode akuntansi closed DITOLAK (regresi T-0248); cancel me-reverse JE.

### F3.10 — Tutup buku bulanan (Effort S)
- File uji: `scenario-period-close.test.ts`. Service: `accounting/close-period.ts`.
- Assert: closePeriod menolak bila masih ada JE draft; setelah closed, createJournal/postJournal ke periode itu ditolak; trial balance per akhir periode seimbang; closing tahunan memindahkan saldo income summary → laba ditahan (T-0223).

### F3.11 — Pajak (Effort M)
- File uji: `scenario-tax.test.ts`. Service: `tax/` (PB1 recap T-0222, `efaktur.ts`, `spt-masa.ts`, `bupot21.ts`, ekspor Coretax).
- Assert: rekap PB1 bulanan per outlet = Σ komponen PB1 dari penjualan POS bulan itu (sumber `journal_lines` taxCode, bukan hitung ulang dari harga); omzet harian PB1-exclusive konsisten dengan gross (SD §25.5b); ekspor Coretax menghasilkan file valid vs contoh resmi (selaras kartu F1.2); NSFP berurutan tanpa lompat.

### F3.12 — Loyalty (Effort S)
- File uji: `scenario-loyalty.test.ts`. Service: `crm/loyalty-service.ts` + earn di `create-sale.ts`.
- Assert: sale member → poin bertambah sesuai aturan tier; redeem voucher mengurangi balance TETAPI lifetime points tidak turun (aturan T-0183); redeem melebihi saldo ditolak; tier naik otomatis saat lifetime melewati ambang.

### F3.13 — Manual sales closing harian (Effort S)
- File uji: `scenario-manual-sales.test.ts`. Service: `pos/manual-sales.ts`.
- Assert: closing multi-metode-bayar (tunai+QRIS+kartu) → JE per metode benar dan seimbang; consumed ingredients → deplesi stok + JE HPP (konversi UoM, regresi `16689a7`); submit dobel dengan idempotency key sama → 1 closing; edit/kompensasi bahan (`compensateIngredientDeductions`) membalik movement lama dengan audit.

---

### Kartu F3.14 — Loop perbaikan temuan (template berulang)
- **Effort**: S–M per temuan · **Dependensi**: F3.1 + skenario terkait
- **Prosedur per bug** (dari matriks F3.1 atau skenario merah):
  1. Mint T-NNNN, judul `fix(<modul>): <gejala>`, salin bukti dari matriks/test.
  2. Tulis test reproduksi DULU (unit bila cukup, integrasi bila lintas modul), jalankan, WAJIB merah. Tempel output merah di checkpoint.
  3. Patch minimal di service (bukan di UI bila akarnya di service). Test jadi hijau.
  4. `pnpm verify`. Update sel matriks ❌→✅ dengan commit hash.
- **Larangan khusus**: dilarang memperbaiki dengan mengubah assert/test; dilarang menumpuk >1 bug per commit; dilarang menyentuh modul lain "sekalian".
- **Urutan**: semua P0 dulu, lalu P1, lalu P2. Perencana memprioritaskan ulang bila temuan > 15.

## Penutupan gerbang F3 (Perencana)
1. 12 skenario hijau di CI dan permanen di `pnpm verify`.
2. Matriks tanpa ❌ kolom kritis (approve/post/cancel/audit/permission) di 18 entitas.
3. Jalankan ulang seluruh suite + sampling matriks; nol P0/P1 baru → tutup, tulis tanggal di master plan §3.
