# Kartu Fase 4 — fondasi platform Odoo-like extensibility (siap eksekusi)

> Bagian dari `docs/plans/MASTER-PLAN-S4-CLASS.md` §8. Baca §1 (kontrak) dulu. Dipecah Perencana 2026-06-10 (T-0287); kartu ini menang atas ringkasan master plan.
> Fakta dasar dari inventaris: custom field engine lengkap di `packages/services/src/customfield/index.ts` + schema `customfield.ts` TETAPI belum dirender di form entitas mana pun (hanya halaman Settings). `runApprovalGate` (`packages/services/src/workflow/index.ts:224`) baru dipanggil `accounting/post-journal.ts`. Tidak ada halaman inbox `/approvals`. Numbering sudah ada per-dokumen di `packages/services/src/shared/number-generator.ts` + tabel `sequences` (schema `common.ts`), formatnya hardcode. Direct-DB import di apps/web: 88 file.
> ADR-0018 menetapkan target Odoo-like FnB ERP Platform: fleksibilitas harus lewat platform services ringan, DB-driven, permission-aware, audited, dan bukan runtime plugin berat.

---

### Kartu F4.1 — Entity-extension registry
- **Effort**: M · **Dependensi**: gerbang F3
- **Tujuan**: modul `packages/services/src/platform/entity-registry.ts` (baru) yang mendeklarasikan entitas extensible: `product, partner, employee, member, supplier, purchase_order, goods_receipt, journal_entry, invoice, stock_adjustment, sales_order, payroll_run, complaint`. Tiap entri: entityType (selaras dengan nilai `entityType` yang SUDAH dipakai `custom_field_definitions`), label i18n key, placement form yang didukung, flag searchable/exportable, flag MCP exposure.
- **Baca dulu**: `packages/services/src/customfield/index.ts` (nilai entityType yang ada), `docs/audit/erp-feature-completeness-2026-06-09.md` §P0-1.
- **Larangan khusus**: registry = data + tipe TS murni, tanpa side effect; jangan migrasi DB (definisi field tetap di tabel yang ada).
- **Bukti selesai**: unit test registry (entityType unik, label i18n ada di 3 locale); `pnpm verify`.

### Kartu F4.2 — Renderer custom field reusable + integrasi 5 master data
- **Effort**: L (pecah: 1 sesi komponen + form produk; 1 sesi 4 form sisanya) · **Dependensi**: F4.1
- **Tujuan**: komponen `packages/ui` `<CustomFieldsSection entityType entityId />` (render per dataType: string/number/boolean/date/enum/reference, validasi dari definisi: required/regex/enumOptions) dipakai di form create/edit + halaman detail untuk: produk, partner, karyawan, member, supplier.
- **Baca dulu**: service customfield (`setValue/getValuesByEntity`), satu form master yang ada (mis. form produk) untuk pola form repo.
- **Langkah**: 1) komponen + server action generik `saveCustomFieldValues` (cek permission entitas induk, bukan permission baru); 2) integrasi form produk + detail; 3) ulangi 4 entitas; 4) nilai field ber-flag `isIndexed` muncul di filter daftar; 5) kolom custom field ikut di ekspor daftar entitas.
- **Larangan khusus**: jangan menulis validasi per-entitas yang menduplikasi service; satu komponen untuk semua. i18n label field dari definisi (definisi punya label per locale? bila belum ada → tambah kolom labelJson lewat migrasi, putuskan lewat ADR kecil di kartu ini).
- **Bukti selesai**: demo terdokumentasi (buat definisi field baru "halal-cert" di produk via Settings → muncul di form/detail/ekspor/filter TANPA edit kode); `pnpm verify`.

### Kartu F4.3a–F4.3g — Layering: hapus direct-DB `apps/web` (per modul)
- **Effort**: masing-masing M–L · **Dependensi**: gerbang F3 (boleh paralel dengan F4.1/F4.2)
- **Sensus 2026-06-10 (88 file)**: HR 18 · Settings 14 · Accounting 13 · Inventory 10 · Tax 6 · Purchasing 4 · POS 4 · Logistics 3 · Reporting 2 · lain-lain (dashboard, correspondence, audit, account, api/lib/components) ±14.
- **Pembagian kartu**: F4.3a Accounting(13) · F4.3b HR(18, pecah 2 sesi) · F4.3c Settings(14, pecah 2 sesi) · F4.3d Inventory(10) · F4.3e Tax(6)+Reporting(2) · F4.3f POS(4)+Purchasing(4)+Logistics(3), termasuk route print receipt/label · F4.3g sisa (dashboard, correspondence, audit, account, api/lib/components).
- **Prosedur per kartu (sama semua)**:
  1. `pnpm lint:layering` → daftar file modul ini dari baseline.
  2. Per file: pindahkan query ke fungsi service di `packages/services/src/<modul>/` (pakai service yang SUDAH ada bila fungsinya tersedia — cek dulu, jangan duplikasi), UI hanya memanggil service + `requirePermission*`.
  3. Hapus entri file dari `scripts/db-imports-baseline.json`.
  4. Perilaku TIDAK berubah: tanpa perubahan UI string, tanpa perubahan rute.
- **Larangan khusus**: dilarang refactor desain UI "sekalian"; dilarang mengubah signature service yang dipakai modul lain; file print receipt wajib tetap cepat (query gabungan satu kali).
- **Bukti selesai per kartu**: baseline menyusut sesuai jumlah file modul; `pnpm verify`; smoke manual 2 halaman terdampak.

### Kartu F4.4a–F4.4k — Approval-gate universal (per transisi, pola tiru T-0285)
- **Effort**: S per kartu · **Dependensi**: gerbang F3
- **Pola baku** (dari `post-journal.ts` + `workflow/index.ts:224`): sebelum transisi, panggil `runApprovalGate({ workflowEntityType, entityId, payload }, ctx)`; bila `pending_approval` → kembalikan Result khusus + copy i18n "menunggu persetujuan" (3 bahasa); instance approved memuaskan gate; aksi lifecycle workflow menulis audit.
- **Daftar kartu** (workflowEntityType → file service target):

| Kode | Transisi | entityType | File service |
|---|---|---|---|
| F4.4a | Tutup periode akuntansi | `period_close` | `accounting/close-period.ts` |
| F4.4b | Refund di atas ambang (kondisi `conditionJson` amount) | `pos_refund` | `pos/refund-sale.ts` |
| F4.4c | Void penjualan | `pos_void` | `pos/create-sale.ts` (voidSale) |
| F4.4d | Approve stock adjustment | `stock_adjustment_approve` | service adjust di `inventory/` |
| F4.4e | Approve opname dengan variance > ambang | `opname_approve` | `inventory/opname-service.ts` |
| F4.4f | Approve PO (matriks nilai berjenjang) | `purchase_order_approve` | `purchasing/create-po.ts` |
| F4.4g | Post purchase return | `purchase_return_post` | `purchasing/return-service.ts` |
| F4.4h | Approve payroll run | `payroll_approve` | `payroll/approve-payroll.ts` |
| F4.4i | Perubahan harga jual produk | `product_price_change` | service update produk `inventory/` |
| F4.4j | Diskon manual di atas ambang | `manual_discount` | jalur diskon manual POS (`pos/`) |
| F4.4k | Perubahan role/permission user | `user_role_change` | `iam/` (assign role) |

- **Per kartu**: gate + definisi workflow default ter-seed (kondisi ambang via `conditionJson`; ambang nilai dibaca dari `cms_settings`, bukan hardcode) + test (di bawah ambang lolos; di atas ambang pending; approved lolos) + i18n 3 bahasa + audit.
- **Larangan khusus**: JANGAN hardcode nama role approver di service (ada di stepsJson definisi); jangan mengubah perilaku ketika TIDAK ada definisi aktif (default: lolos, sama seperti T-0285).
- **Bukti selesai per kartu**: 3 test di atas hijau; `pnpm verify`.

### Kartu F4.5 — Inbox approval terpusat `/approvals`
- **Effort**: M · **Dependensi**: minimal 3 kartu F4.4 selesai
- **Tujuan**: halaman `(dash)/approvals`: daftar `workflow_instances` pending yang step aktifnya boleh diputuskan role user, tombol approve/reject + komentar (`approveStep/rejectStep` di service workflow), riwayat instance, link ke dokumen sumber (pakai entityType+entityId → rute detail), badge jumlah pending di sidebar, notifikasi via `notifyByPermission` saat instance baru.
- **File**: `apps/web/app/(dash)/approvals/` (baru), `apps/web/app/(dash)/sidebar.tsx` + `apps/web/lib/nav-access.ts` (entri baru + permission `workflow.approve` — cek dulu apakah sudah ter-seed), i18n 3 file.
- **Larangan khusus**: keputusan approve TETAP lewat service (role check di server); halaman tidak query DB langsung (lewat service, sejalan F4.3).
- **Bukti selesai**: skenario manual: buat refund di atas ambang → muncul di inbox manajer → approve → refund jalan; `pnpm verify`.

### Kartu F4.6 — Numbering engine terkonfigurasi
- **Effort**: M · **Dependensi**: gerbang F3 · **ADR wajib** (skema baru + lintas modul)
- **Fakta**: `shared/number-generator.ts` + tabel `sequences` sudah atomic; format (`INV/YYYY/MM/NNNN`, `PO-YYYY-MM-NNNN`, dst.) hardcode per fungsi.
- **Tujuan**: tabel `document_sequence_configs` (docType, locationId nullable, formatTemplate dengan token `{YYYY}{MM}{LOC}{NNNN}`, resetPolicy yearly/monthly/never, padWidth, aktifMulai) + `generateDocumentNumber(docType, ctx)` yang membaca config (fallback ke format lama bila tidak ada config); migrasikan pemanggil number-generator satu per satu; UI Settings → Document Numbering (CRUD config, preview hasil); dokumen fiskal (invoice/NSFP) wajib gapless: nomor diambil DI DALAM transaksi yang sama dengan insert dokumen.
- **Larangan khusus**: jangan mengubah nomor dokumen yang sudah terbit; config baru hanya berlaku untuk dokumen berikutnya; jangan menyentuh logika NSFP e-Faktur tanpa membaca `tax/efaktur.ts` dulu.
- **Bukti selesai**: test concurrency (10 nomor paralel tanpa duplikat/lompat untuk gapless); demo ubah format PO per lokasi via UI tanpa kode; ADR baru ter-commit; `pnpm verify`.

### Kartu F4.7 — Import wizard generik
- **Effort**: L (pecah: engine+dry-run; lalu UI+3 entitas; lalu fixed asset) · **Dependensi**: F4.1 · **ADR wajib**
- **Fakta**: `inventory/import-service.ts` sudah punya pola (sheet master + movement, normalisasi kode). Generalisasi, jangan tulis ulang.
- **Tujuan**: service `platform/import-engine.ts`: definisi mapping kolom→field per entityType (dari registry F4.1 + custom fields), parse XLSX/CSV, **dry-run default** (validasi per baris, deteksi duplikat by kunci natural, laporan baris error yang bisa diunduh), commit eksplisit per batch dengan audit (`import_batch` di audit_log), rollback batch. UI wizard di Settings: upload → mapping (simpan template mapping) → dry-run hasil → commit. Entitas minimal: produk (delegasi ke import-service lama), partner, stok awal, fixed asset (kebutuhan CLAUDE.md §10: Excel aset user).
- **Larangan khusus**: dry-run TIDAK menulis tabel bisnis apa pun; commit hanya setelah dry-run sukses di payload yang sama (hash payload dicek); ukuran file ikut batas upload area (F2.4).
- **Bukti selesai**: import 100 baris partner dengan 5 baris rusak → dry-run menandai 5, commit memasukkan 95 + audit; ADR ter-commit; `pnpm verify`.

### Kartu F4.8 — Timeline dokumen universal
- **Effort**: M · **Dependensi**: F4.3 modul terkait (supaya detail page sudah lewat service)
- **Tujuan**: komponen `<DocumentTimeline entityType entityId />`: gabungan audit_log (action post/approve/reject/void/dll), workflow steps (siapa approve kapan + komentar), komentar bebas (tabel baru `document_comments`: entityType, entityId, body, authorUserId, audit kolom), lampiran (pakai pola journal_attachments → generalisasi bila perlu). Pasang di detail: journal, PO, GRN, purchase return, opname, payroll run, refund.
- **Larangan khusus**: timeline read model dari audit_log yang ADA, jangan membuat tabel riwayat status paralel; komentar bukan pengganti alasan approve (yang itu tetap di workflow step notes).
- **Bukti selesai**: detail PO menampilkan kronologi create→approve→GRN dengan pelaku + waktu; `pnpm verify`.

### Kartu F4.9 — Saved views + laporan terjadwal
- **Effort**: M · **Dependensi**: gerbang F3
- **Tujuan**: (a) tabel `saved_views` (userId, route, name, filtersJson) + tombol simpan/terapkan di halaman laporan utama (GL, aging, daily summary, BI); (b) job worker `report-scheduler` (pola `apps/worker/src/scheduler.ts` handlerMap + `scheduledJobs`): kirim XLSX laporan terpilih via `sendTransactionalEmail` sesuai jadwal per user; konfigurasi di Settings.
- **Larangan khusus**: ekspor memakai helper ekspor yang ada (XLSX exceljs dari T-0178); email wajib lewat transport resmi; PII di laporan ikut aturan F2.9.
- **Bukti selesai**: simpan view filter GL → muncul kembali; jadwal harian dummy mengirim email dengan lampiran benar (uji dengan SMTP dev); `pnpm verify`.

---

## Penutupan gerbang F4 (Perencana)
Demo terdokumentasi di `docs/audit/F4-gate-demo.md`: (1) field baru tanpa kode (F4.2); (2) aturan approval baru tanpa kode (F4.4 + F4.5); (3) format nomor baru tanpa kode (F4.6); (4) import master tanpa parser baru (F4.7); (5) `scripts/db-imports-baseline.json` = 0 entri. Plus `pnpm verify` + 12 skenario F3 tetap hijau.
