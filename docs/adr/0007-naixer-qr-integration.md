# ADR-0007: Integrasi POS ↔ KDS Naixer via QR Code (Tanpa API)

- **Status**: Accepted
- **Tanggal**: 2026-05-05
- **Pengambil keputusan**: Lintang Maulana Zulfan
- **Konteks bisnis**: SOURCE-OF-TRUTH §14.4 (Format QR Code untuk Naixer)
- **Konteks teknis**: SYSTEM-DESIGN §33 (Naixer KDS Integration)

## Konteks

Toko Aroadri Malioboro menggunakan **mesin pembuat teh otomatis Naixer** dari Tiongkok (lihat foto SOURCE-OF-TRUTH Lampiran B halaman 18). Mesin ini memiliki **KDS bawaan** yang membaca QR code di label cup untuk mendapatkan instruksi resep.

Workflow saat ini (lapangan):
1. Kasir input order di POS.
2. Printer Comson cetak label dengan QR code.
3. Karyawan scan QR di KDS Naixer.
4. Naixer menyajikan resep sesuai instruksi.

**Pengamatan lapangan**: tidak ada koneksi jaringan / API antara POS lama (restosuite.ai) dan Naixer. Komunikasi murni via QR code.

**Dua format QR yang dikenal**:

| Format | Contoh | Sumber | Status |
|---|---|---|---|
| A. Pipe + comma | `ORD0001\|P0003\|A001,M002,T001` | Dokumentasi resmi Naixer | Belum diuji di lapangan kita |
| B. Dash | `T003-C01-S02-W01` | Hasil scan QR yang dihasilkan POS lama | **Terbukti dibaca Naixer** |

User mengarahkan: pakai Format B sebagai default karena terbukti, tapi **siapkan fleksibilitas** untuk Format A bila vendor mengharuskan kelak.

## Keputusan

### 1. Integrasi via QR Code, **Tanpa Koneksi API**
- POS kita tidak akan memanggil API Naixer (tidak ada endpoint resmi yang terdokumentasi untuk konteks kita).
- Naixer dianggap **opaque box** yang menerima input via scan QR di label.

### 2. Generator QR Pluggable (Strategy Pattern)
Generator memiliki dua strategi:

- **Strategy `dash`** (default): `[product_code]-[spec_1]-[spec_2]-[spec_3]`
- **Strategy `pipe`**: `[order_id]|[product_code]|[spec_1],[spec_2],[spec_3]`

Strategi dipilih per lokasi via tabel `naixer_qr_format_config`. Switching format = update row, tidak butuh deploy.

### 3. Master Mapping di Database

Tiga tabel mapping (lihat SYSTEM-DESIGN §33.2):
- `naixer_product_codes` — peta `product_id` → kode produk Naixer.
- `naixer_modifier_codes` — peta `modifier_option_id` → kode spec Naixer.
- `naixer_qr_format_config` — konfigurasi format per lokasi.

Daftar kode dari vendor sedang diminta. Saat diterima, di-import via `scripts/seed-naixer-codes.ts` (CSV → DB).

### 4. QR Hanya untuk Naixer
QR code di label cup **eksklusif untuk Naixer**. Untuk tracking internal kita, gunakan **teks pickup number** + simpan `kds_qr_payload` di `sales_order_lines` (untuk audit / cetak ulang / refund tracking).

### 5. Fallback Saat Mapping Hilang
Bila modifier tidak punya `naixer_code`:
- **Strict mode** (default): tolak generate QR, tampilkan error ke kasir → kasir paksa pakai mesin teh manual untuk pesanan ini.
- **Lenient mode** (config): pakai kode default `Z00` → log warning + lanjutkan; karyawan dapur akan handle manual.

### 6. Demo Mode Aman
Saat POS dalam demo mode (lihat ADR-0008): QR diisi prefix `DEMO-` (mis. `DEMO-T003-C01-S02-W01`). Naixer tidak akan recognize → aman dari side effect.

### 7. UI Admin
Halaman `Settings → Integrations → Naixer KDS` di ERP:
- Tabel mapping produk (CRUD)
- Tabel mapping modifier (CRUD)
- Format config per lokasi (form)
- Tombol "Preview QR" untuk produk + modifier kombinasi tertentu (output: string + QR image SVG)
- Tombol "Test Print" untuk cetak label uji

### 8. MCP Tools
- `kitchen.list_naixer_product_codes()`
- `kitchen.set_naixer_product_code({...})`
- `kitchen.set_naixer_modifier_code({...})`
- `kitchen.get_qr_format({location_id})`
- `kitchen.set_qr_format({...})`
- `kitchen.preview_qr({sales_order_line_id})`

## Alternatif yang Dipertimbangkan

### A. Reverse-engineer API Naixer
- Pros: Komunikasi dua arah (status produksi, error, dll.).
- Cons:
  - Tidak ada dokumentasi API resmi untuk versi mesin di toko.
  - Risiko legal (reverse-engineer melanggar EULA).
  - Setiap update firmware Naixer dapat memutus integrasi.
- **Ditolak**.

### B. Gunakan Format A (pipe) sebagai default
- Pros: Sesuai dokumentasi resmi Naixer.
- Cons:
  - Belum diverifikasi dapat dibaca mesin di lapangan; uji coba berisiko mengganggu operasional.
  - Format B sudah terbukti.
- **Ditolak default**, namun siapkan strategi.

### C. Hard-code kode Naixer di seed (statis)
- Pros: Sederhana.
- Cons:
  - Ketika menu berubah (varian baru, ukuran baru), butuh deploy.
  - User meminta fleksibilitas via UI.
- **Ditolak**, pakai mapping di DB.

### D. QR berisi hanya order_line_id internal kita; punya app proxy yang baca QR + lookup mapping + kirim ke Naixer
- Pros: QR ringkas.
- Cons:
  - Butuh app proxy berjalan di KDS device — komplikasi infrastruktur di toko.
  - Naixer tidak dapat dipanggil API → app proxy harus simulasi keystroke / network ke Naixer (rapuh).
- **Ditolak**.

## Konsekuensi

### Positif
- **Sederhana**: tidak ada koneksi jaringan ke Naixer, tidak ada dependency runtime ke vendor.
- **Reliable**: QR sudah terbukti di lapangan (Format B).
- **Fleksibel**: switching ke Format A hanya butuh update DB + restart generator.
- **Audit-friendly**: mapping terdokumentasi di DB, audit log tercatat saat berubah.
- **Aman saat Naixer down**: QR tetap bisa di-print; kalau Naixer tidak bisa baca, dapur manual handle (failover natural).

### Negatif / Trade-off
- **Tidak ada feedback dari Naixer** ke ERP (tidak tahu status produksi real-time per cup). Mitigasi: KDS Aroadri terpisah untuk tracking status (queued / making / ready) — lihat SYSTEM-DESIGN §21.7.
- **Master mapping perlu dipelihara**: setiap produk baru / modifier baru → tambah mapping. Mitigasi: workflow validasi: produk POS yang `is_kds_routed=true` tidak boleh aktif tanpa mapping Naixer.
- **Bergantung vendor untuk daftar kode**: Phase 2 belum bisa dimulai sebelum daftar tiba. Mitigasi: minimal mapping untuk produk yang sudah ada saat ini bisa dimulai dengan trial-and-error.

### Neutral
- **Phase**: implementasi mapping & generator masuk ke **Phase 3 (Kitchen)** sesuai prioritas modul.

## Implementasi Checklist
- [ ] Schema `naixer_product_codes`, `naixer_modifier_codes`, `naixer_qr_format_config` di Drizzle.
- [ ] Migration + seed default config Aroadri Malioboro (format=`dash`).
- [ ] Service `packages/services/kitchen/naixer-qr.ts` dengan strategy pattern.
- [ ] Test unit: encode dash, encode pipe, missing mapping (strict + lenient).
- [ ] UI admin di `apps/web /settings/integrations/naixer/`.
- [ ] MCP tools.
- [ ] Skrip import CSV `scripts/seed-naixer-codes.ts`.
- [ ] Dokumentasi runbook: cara menambah produk + mapping baru.

## Tindak Lanjut
- [x] **Vendor list TIDAK menjadi blocker** Phase 3 (decided 2026-05-05). User akan menginput kode produk + spec mapping sendiri via UI Settings → Integrations → Naixer KDS saat modul siap. Skrip import CSV tetap disediakan sebagai shortcut bila kelak vendor mengirim daftar lengkap.
- [ ] Build UI mapping CRUD secepatnya di Phase 3 (bukan menunggu CSV vendor).
- [ ] Validasi Format A juga dengan 1-2 sample bila ada kesempatan (untuk konfirmasi fallback bekerja).
- [ ] Dokumentasikan SOP bagi user untuk menguji QR di KDS Naixer setelah menambah mapping baru (cetak label, scan, verifikasi mesin menyajikan resep yang benar).

## Referensi
- SOURCE-OF-TRUTH.md §14 (Dapur, KDS, Produksi)
- SYSTEM-DESIGN.md §33 (Naixer KDS Integration)
- Dokumentasi vendor Naixer (sedang diminta).
- Foto label uji dari SOURCE-OF-TRUTH Lampiran B halaman 20.
