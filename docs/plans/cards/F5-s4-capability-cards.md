# Kartu Fase 5 — kapabilitas enterprise untuk Odoo-like FnB ERP (siap eksekusi)

> Bagian dari `docs/plans/MASTER-PLAN-S4-CLASS.md` §9. Baca §1 (kontrak) dulu. Dipecah Perencana 2026-06-10 (T-0287); kartu ini menang atas ringkasan master plan.
> Fakta dasar: `journal_lines` saat ini berkolom id, journalEntryId, lineNo, accountId, locationId, description, debit, credit, taxCode, partnerId, dueDate, reminderDaysBefore, reminderSentAt, expectedLossRateBps. BELUM ada dimensi cost center. Migrasi drizzle terakhir: `0042`. Sidebar: `apps/web/app/(dash)/sidebar.tsx` + `apps/web/lib/nav-access.ts` (NAV_ACCESS = sumber kebenaran route→permission).
> Fase ini melengkapi target ADR-0018: breadth/flexibility ala Odoo tetap harus dibarengi kontrol finansial, governance, drilldown, MDG, config versioning, dan role workspace.

---

### Kartu F5.1 — Dimensi CO di ledger (cost center + profit center)
- **Effort**: L (pecah: 1 sesi schema+service; 1 sesi laporan) · **Dependensi**: gerbang F4 · **ADR wajib**
- **Tujuan**: (a) schema baru `packages/db/schema/controlling.ts`: tabel `cost_centers` (kode, nama trilingual, locationId nullable, aktif, audit kolom); (b) kolom `costCenterId` (nullable, FK) di `journal_lines` via migrasi; profit center DITETAPKAN = `locationId` yang sudah ada (tulis keputusan ini di ADR, jangan bikin tabel profit center terpisah); (c) `createJournal` menerima costCenterId per baris; jalur posting otomatis mengisi default per sumber (POS → cost center outlet; payroll → cost center dari penugasan karyawan; beban kantor → pilihan user); (d) laporan P&L per cost center + per lokasi di `reporting/` (turunan dari profitLoss yang ada, tambah filter dimensi).
- **Baca dulu**: `packages/db/schema/accounting.ts` (pola kolom), `packages/services/src/accounting/create-journal.ts`, `reporting/` profitLoss.
- **Langkah wajib urut**: ADR dulu → schema + `pnpm db:generate` (migrasi 0043+) → service createJournal → pengisi default per jalur posting → seed cost center awal (per outlet + kantor YK + kantor JKT) → laporan → UI dropdown di form jurnal manual → i18n.
- **Larangan khusus**: kolom nullable, TIDAK ada backfill paksa (baris lama biarkan null, laporan menampilkan "(tanpa cost center)"); jangan menambah validasi yang menolak jurnal lama; dilarang `drizzle-kit push`.
- **Bukti selesai**: skenario F3.2/F3.9 diperluas assert costCenterId terisi; P&L per cost center balance dengan P&L total; ADR ter-commit; `pnpm verify`.

### Kartu F5.2 — Budget + commitment check
- **Effort**: L (pecah: schema+service; lalu integrasi PO+UI) · **Dependensi**: F5.1 · **ADR wajib (gabung ADR F5.1 boleh)**
- **Tujuan**: tabel `budgets` (periode fiskal, status draft/active/closed, audit) + `budget_lines` (accountId, costCenterId, locationId, amount Money); service `checkBudget(accountId, costCenterId, period)` → {budget, actual (dari journal_lines posted), committed (PO approved yang belum jadi GRN), available}; integrasi: `approvePO` (F4.4f) memanggil checkBudget per baris beban → bila melebihi available, gate naik ke definisi workflow "over-budget" (approval lebih tinggi), BUKAN ditolak mati; UI: halaman budget (input + monitor budget vs actual vs committed, drilldown).
- **Larangan khusus**: commitment dihitung query agregat saat cek (jangan tabel saldo committed yang harus disinkron); PO non-inventory tanpa akun beban jelas → BLOCKED, tanya mapping ke Lintang.
- **Bukti selesai**: test: budget 10 juta, PO aktif 8 juta belum GRN, PO baru 3 juta → masuk jalur over-budget; setelah GRN, committed pindah ke actual tanpa dobel; `pnpm verify`.

### Kartu F5.3 — Jurnal berulang + template akrual
- **Effort**: M · **Dependensi**: F5.1
- **Tujuan**: tabel `recurring_journals` (template lines JSON dengan akun/dimensi/amount, jadwal cron-like, tanggal mulai/akhir, aktif) + handler worker baru `recurring-journals` di `apps/worker/src/scheduler.ts` handlerMap (pola job yang ada): generate JE draft pada jadwalnya → JE masuk jalur posting normal (termasuk approval gate jurnal manual T-0285); UI CRUD di accounting.
- **Larangan khusus**: hasil generate = DRAFT, tidak pernah auto-post; idempoten per (templateId, tanggal jadwal) supaya worker restart tidak dobel.
- **Bukti selesai**: test generate idempoten; jalankan handler manual → draft muncul → post lewat gate; `pnpm verify`.

### Kartu F5.4 — MDG ringan: duplikat + merge master data
- **Effort**: M · **Dependensi**: gerbang F4
- **Tujuan**: (a) saat create partner/product/member, service mengecek kandidat duplikat (partner: nama normalisasi + NPWP; member: phone/email terenkripsi via lookup hash `encryptPiiForLookup` yang sudah ada; produk: nama + kategori) → UI menampilkan "mungkin duplikat dari X, lanjutkan?"; (b) merge partner & member: pilih survivor, repoint FK (partnerId di journal_lines/invoices/PO; memberId di loyalty/orders) dalam satu transaksi, korban di-soft-delete dengan penanda `merged_into_id`, audit before/after lengkap; merge lewat approval gate (`master_merge`).
- **Larangan khusus**: merge produk TIDAK termasuk (riwayat BOM/stok terlalu berisiko; catat sebagai keputusan); tidak ada hard delete.
- **Bukti selesai**: test merge partner dengan transaksi di kedua sisi → laporan AP/AR konsolidasi benar; deteksi duplikat muncul di UI; `pnpm verify`.

### Kartu F5.5 — Workspace per peran (launchpad)
- **Effort**: L (pecah per 2 peran) · **Dependensi**: F4.5 (inbox) selesai
- **Tujuan**: dashboard `(dash)/dashboard` menjadi launchpad per peran berbasis konfigurasi: tabel `workspace_tiles` (kode tile, permission yang dibutuhkan, urutan, target route, jenis: angka/antrian/shortcut) + komposisi per role di DB (BUKAN hardcode nama role); tile angka mengambil dari service reporting yang ada. Set awal: kasir (status shift, sync pending, antrian KDS), manajer toko (omzet hari ini, stok di bawah reorder, approval pending, pengecualian attendance), akuntan (close readiness dari T-0271, jurnal draft, unmatched bank lines), HR (pengajuan cuti/lembur pending, payroll blocker), purchasing (PR open, PO menunggu approve, GRN belum invoice), direktur (KPI BI + drilldown).
- **Larangan khusus**: tile tidak query DB langsung (lewat service); jangan menghapus dashboard lama sebelum semua role punya komposisi (feature flag di cms_settings).
- **Bukti selesai**: login 2 role berbeda → launchpad berbeda sesuai konfigurasi DB; ubah komposisi via seed/Settings tanpa kode; `pnpm verify`.

### Kartu F5.6 — Exception center
- **Effort**: M · **Dependensi**: F5.5
- **Tujuan**: halaman `(dash)/exceptions` + service agregator yang mengumpulkan: sync POS gagal/parkir > ambang, bank statement lines unmatched, stock_levels negatif, produk terjual tanpa BOM aktif, workflow instance pending > X hari, payroll blocker (karyawan tanpa kontrak/rekening), tax export blocker (JE tanpa taxCode pada akun pajak). Tiap item: jumlah + link aksi langsung. Definisi ambang di cms_settings.
- **Bukti selesai**: suntik 3 kondisi anomali di DB test → ketiganya muncul dengan link benar; `pnpm verify`.

### Kartu F5.7 — Drilldown laporan sampai dokumen sumber
- **Effort**: M · **Dependensi**: F4.3e (reporting lewat service)
- **Tujuan**: rantai klik: P&L/Neraca → daftar GL akun (filter periode+dimensi terbawa) → baris GL → halaman JE → dokumen asal (`referenceType`+`referenceId` di journal_entries → rute detail PO/sale/payroll, mapping rute di satu helper). Terapkan ke: trial balance, P&L, neraca, GL, aging (link ke invoice/JE), COGS (link ke produk+BOM).
- **Larangan khusus**: link dibangun dari helper tunggal `documentRoute(referenceType, id)` di satu file, bukan switch-case tersebar.
- **Bukti selesai**: klik angka pendapatan P&L → GL → JE penjualan → sales order; `pnpm verify`.

### Kartu F5.8 — Config versioning + rollback
- **Effort**: M · **Dependensi**: gerbang F4
- **Tujuan**: riwayat versi untuk: workflow_definitions, tax_rules, document_sequence_configs, cms_settings kunci kritis. Implementasi: tabel `config_revisions` (entityType, entityId, revisi, snapshot JSONB, authorUserId, createdAt) diisi otomatis oleh service update masing-masing; UI: daftar revisi + diff dua versi + tombol rollback (rollback = tulis versi baru berisi snapshot lama, lewat approval gate `config_rollback`, audit).
- **Larangan khusus**: rollback TIDAK pernah mengubah dokumen yang sudah diproses dengan config lama; berlaku ke depan saja.
- **Bukti selesai**: ubah definisi workflow 2× → diff tampil → rollback → definisi aktif kembali seperti versi 1 dengan audit; `pnpm verify`.

### Kartu F5.9 — Jejak costing (trace movement → valuasi → JE)
- **Effort**: M · **Dependensi**: F4.3d
- **Tujuan**: halaman per produk+lokasi: tabel kronologis stock_movements dengan kolom qty, cost masuk, avg cost sesudah, dan link JE HPP/persediaan terkait (via referenceType); laporan margin per produk memakai avg cost riil periode itu, tandai margin negatif (perluasan cogsReport T-0174). Bila data avg-cost-sesudah tidak tersimpan historis → hitung derivasi dari urutan movement, JANGAN menambah kolom snapshot tanpa ADR.
- **Bukti selesai**: untuk 1 produk uji dengan 3 GRN harga beda + 2 penjualan: angka avg cost di UI = hitungan manual; `pnpm verify`.

### Kartu F5.10 — Simulasi / dry-run proses besar
- **Effort**: M · **Dependensi**: F3.0 (pola transaksi-rollback sudah ada di harness)
- **Tujuan**: mode `dryRun: true` untuk: `runPayroll` (hasil slip per karyawan tanpa menulis), `closePeriod` (daftar blocker + ringkasan saldo yang akan terkunci), ekspor pajak (pratinjau file + daftar anomali). Implementasi: jalankan logika di dalam transaksi DB lalu ROLLBACK; hasil dikembalikan sebagai Result data; UI tombol "Simulasi" di samping tombol asli.
- **Larangan khusus**: dry-run tidak menulis APA PUN: tidak juga audit_log dan idempotency (verifikasi dengan assert hitungan row sebelum=sesudah); jangan menduplikasi logika perhitungan (satu fungsi, flag).
- **Bukti selesai**: test: dryRun payroll → row count seluruh tabel tak berubah, hasil = run asli yang dijalankan setelahnya; `pnpm verify`.

---

## Penutupan gerbang F5 (Perencana)
Checklist master plan §12.2 poin 6–10 terbukti dengan demo terdokumentasi di `docs/audit/F5-gate-demo.md`; `pnpm verify` + 12 skenario F3 hijau; `pm2 status` di VPS pasca-deploy gerbang dicatat (RAM tidak melewati batas wajar).
