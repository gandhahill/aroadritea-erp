# Kartu Fase 7 — app native POS (Android + Windows) + silent printing ESC/POS

> Bagian dari `docs/plans/MASTER-PLAN-S4-CLASS.md`. Baca §1 (kontrak eksekutor) dulu. Dipecah Perencana 2026-06-10 (T-0288).
> **Dasar keputusan: ADR-0015** (`docs/adr/0015-native-packaging-silent-printing.md`, status Proposed) — WAJIB dibaca utuh sebelum kartu mana pun di fase ini. Ringkas: yang dibungkus native hanya **surface POS** (bukan seluruh ERP; modul lain tetap browser); shell **Tauri 2** satu basis kode untuk Android + Windows; arsitektur cetak = builder ESC/POS (TS, unit-testable) → bridge Tauri → 4 adapter transport Rust (Win-USB, Win-BT, Android-USB, Android-BT); konfigurasi printer per terminal di tabel `pos_printer_configs`; fallback mulus ke print dialog browser; setiap event cetak diaudit. iOS tidak dibutuhkan.
> **Urutan eksekusi fase ini**: setelah gerbang F3 (bug fungsional bersih), sebelum F4. Alasan: nyeri operasional kasir harian, dan tidak bergantung pada F4/F5.

---

### Kartu F7.0 — Finalisasi ADR-0015 + jembatan kiosk-printing
- **Effort**: S · **Dependensi**: gerbang F3
- **Tujuan**: ADR-0015 berstatus Accepted (keputusan Lintang) dan terminal Windows yang ada mendapat jembatan jangka pendek Chrome `--kiosk-printing` selama shell disiapkan.
- **Langkah**: 1) minta konfirmasi Lintang atas ADR-0015 (BLOCKED sampai dijawab); 2) ubah status ADR → Accepted + update `docs/adr/README.md` dan tabel CLAUDE.md §3.1; 3) tulis `docs/runbook/pos-terminal-kiosk-printing.md`: cara membuat shortcut Chrome `--kiosk --kiosk-printing` per terminal Windows + batasannya (tetap HTML print, bukan ESC/POS penuh); 4) verifikasi di satu terminal toko bila memungkinkan, atau serahkan instruksi ke Lintang.
- **Larangan khusus**: jangan mulai kartu F7.1+ sebelum ADR Accepted.
- **Bukti selesai**: ADR Accepted ter-commit; runbook ada; `pnpm verify`.

### Kartu F7.1 — Builder ESC/POS (TS murni, unit-testable)
- **Effort**: M · **Dependensi**: F7.0
- **Tujuan**: modul `packages/shared/src/escpos/`: builder deterministik tanpa I/O yang mengubah data struk/label/tiket dapur → `Uint8Array` perintah ESC/POS: init, codepage (CP437/CP1252), align, bold/size, kolom qty×nama×harga (lebar 58/80 mm), barcode/QR bila perlu, feed+cut, buka laci (pulse). API: `buildReceipt(data, profile)`, `buildKitchenTicket(...)`, `buildLabel(...)`; `profile` = { paperWidth, codepage }.
- **Baca dulu**: ADR-0015 §3; data struk yang sudah ada di route print `apps/web/app/(print)/pos/print/receipt/[orderId]/page.tsx` (sumber field); spesifikasi ESC/POS Epson untuk perintah inti.
- **Larangan khusus**: builder tidak menyentuh DB/jaringan/Tauri; format rupiah & teks struk lewat util i18n/format yang sudah ada di `packages/shared`, jangan tulis formatter tandingan; uang tetap `Money`.
- **Bukti selesai**: unit test snapshot byte untuk ≥6 kasus (58/80mm, item bermodifier, diskon, multi-bayar, refund, label); `pnpm verify`.

### Kartu F7.2 — Schema `pos_printer_configs` + service + UI Settings
- **Effort**: M · **Dependensi**: F7.0
- **Tujuan**: tabel `pos_printer_configs` persis kolom di ADR-0015 §4 (platform/transport/device_ref/paper_width/codepage/role/terminal_id + audit cols) via migrasi drizzle; service `packages/services/src/pos/printer-config.ts`: CRUD + `resolvePrinter(terminalId, role)` → config aktif; identitas `terminal_id` dibuat & disimpan per perangkat (localStorage + tampil di Settings); UI `(dash)/settings/pos/printers`: daftar + form per lokasi/terminal, permission `pos.settings` yang ada (cek seed dulu).
- **Larangan khusus**: tidak ada hardcode merek printer di kode; codepage/width hanya dari config; UI string i18n 3 bahasa; mutasi tercatat audit_log.
- **Bukti selesai**: test service resolve (terminal tanpa config → null; role berbeda → config berbeda); `pnpm verify`.

### Kartu F7.3 — Antarmuka `PrinterPort` + fallback browser + jalur cetak POS
- **Effort**: M · **Dependensi**: F7.1, F7.2
- **Tujuan**: antarmuka TS `PrinterPort { print(bytes, config): Promise<Result> }` dengan 2 implementasi awal: `TauriBridgePort` (memanggil `window.__TAURI__` command `print_receipt` — stub dulu, nyata di F7.4) dan `BrowserFallbackPort` (buka route print HTML yang ada + dialog). Pemilihan otomatis: shell terdeteksi (`isTauri`) + config printer ada → silent; selain itu → fallback. Pasang di titik selesai-bayar POS dan tombol re-print.
- **Baca dulu**: alur pembayaran POS di `apps/web/app/(dash)/pos/` (cari pemanggil route print) — catat titik integrasi di checkpoint SEBELUM mengubah.
- **Larangan khusus**: fallback browser harus tetap bekerja persis seperti sekarang ketika tanpa shell (regresi dilarang); demo mode POS (ADR-0008) TIDAK mencetak ke perangkat nyata — guard eksplisit.
- **Bukti selesai**: test unit pemilihan port; manual: tanpa shell, alur print lama tidak berubah; `pnpm verify`.

### Kartu F7.4 — Scaffold shell Tauri 2 (`apps/pos-shell`) + bridge command
- **Effort**: L (pecah: scaffold+Windows dulu; Android menyusul di F7.6) · **Dependensi**: F7.3
- **Tujuan**: app Tauri 2 di `apps/pos-shell/` (webview memuat URL POS produksi; URL dikonfigurasi build-time + bisa dioverride file config lokal), session cookie persisten, mode kiosk/fullscreen opsional; Tauri command `print_receipt(bytes: Vec<u8>, printer_id: String)` yang membaca config (diteruskan dari JS) dan memilih adapter transport.
- **Penting untuk toolchain**: shell TIDAK boleh merusak pipeline server: `pnpm -r build`/`pnpm verify` harus tetap lulus di mesin tanpa Rust (script build pos-shell = no-op guard bila `cargo` tidak ada; build native lewat workflow terpisah, lihat F7.8).
- **Larangan khusus**: tidak membundel apps/web ke dalam shell (webview → URL, sesuai ADR); tidak menyimpan kredensial di kode shell.
- **Bukti selesai**: `pnpm verify` lulus tanpa Rust; di mesin dev ber-Rust: shell Windows membuka POS dan login; command bridge terpanggil (log); commit.

### Kartu F7.5 — Adapter transport Windows (USB + Bluetooth/COM)
- **Effort**: M · **Dependensi**: F7.4
- **Tujuan**: implementasi Rust di `apps/pos-shell/src-tauri/`: (a) Windows-USB: tulis byte ke printer USB (winspool RAW atau USB bulk via rusb — pilih yang paling sederhana yang berfungsi, catat di checkpoint); (b) Windows-Bluetooth: SPP → port COM (tulis via serialport). `device_ref` dari config menentukan target. Error terstruktur kembali ke JS (printer mati, port salah) untuk ditampilkan kasir + diaudit.
- **Larangan khusus**: jangan auto-scan agresif yang menggantung UI; timeout tulis ≤ 5 detik; tanpa dependensi Rust raksasa.
- **Bukti selesai**: cetak nyata di printer thermal USB dan BT di Windows (atau, bila perangkat belum tersedia di dev: uji dengan virtual COM + dump byte, dan tandai verifikasi toko sebagai langkah F7.8); commit + catatan hasil di checkpoint.

### Kartu F7.6 — Adapter transport Android (USB Host + Bluetooth SPP)
- **Effort**: L · **Dependensi**: F7.4
- **Tujuan**: target Android di Tauri 2: izin + alur pairing (runtime permission BT, izin USB Host per perangkat), adapter Android-BT (SPP; BLE hanya bila printer fleet menuntut) dan Android-USB (USB Host API bulk transfer). Keystore signing APK milik Lintang (BLOCKED bila belum ada — beri instruksi pembuatan keystore di checkpoint).
- **Larangan khusus**: per ADR-0015, bila Tauri-Android terbukti bermasalah serius, JANGAN memaksa — tulis temuan, usulkan pemindahan adapter Android ke Capacitor di balik `PrinterPort` yang sama (keputusan Perencana/Lintang), builder & UI tidak berubah.
- **Bukti selesai**: APK debug mencetak nyata via BT di satu perangkat Android; izin USB Host diminta dengan benar; commit + catatan.

### Kartu F7.7 — Audit event cetak + re-print
- **Effort**: S · **Dependensi**: F7.3
- **Tujuan**: setiap cetak (silent maupun fallback) menulis audit: entityType `pos_print`, action print/reprint, metadata { orderId, terminalId, printerId, transport, hasil sukses/gagal + kode error }; re-print tercatat terpisah dengan alasan; gagal cetak memunculkan banner kasir + masuk kandidat exception center (F5.6 akan mengonsumsinya).
- **Larangan khusus**: byte struk TIDAK ikut disimpan di audit (besar + tak berguna); jangan blokir penjualan bila audit print gagal (best-effort, log error).
- **Bukti selesai**: test service audit print; cetak → row audit muncul; `pnpm verify`.

### Kartu F7.8 — Build pipeline native + distribusi + verifikasi toko
- **Effort**: M · **Dependensi**: F7.5, F7.6, F7.7
- **Tujuan**: workflow GitHub Actions terpisah `native.yml` (workflow_dispatch + tag rilis): build MSI/NSIS (Windows) + APK signed (Android) via matrix runner; artefak diunggah ke GitHub Releases; `docs/runbook/pos-terminal-setup.md`: instalasi per platform, pairing BT, izin USB, pemilihan printer di Settings, troubleshooting; verifikasi lapangan: cetak struk + tiket dapur + label di printer toko nyata (termasuk uji kompatibilitas printer **Comson** per ADR-0015) untuk kombinasi fleet nyata (minimal Android+BT dan Windows+USB).
- **Larangan khusus**: secret signing hanya di GitHub Secrets (BLOCKED bila belum diisi Lintang); workflow native TIDAK menjadi prasyarat CI utama.
- **Bukti selesai**: link release berisi MSI + APK; checklist verifikasi toko terisi (tanggal, terminal, printer, hasil); runbook final.

---

## Penutupan gerbang F7 (Perencana)
1. Silent print terverifikasi di kombinasi fleet nyata (minimal Android+Bluetooth dan Windows+USB) dengan audit row tercatat; re-print tercatat.
2. Fallback browser tetap berfungsi di terminal tanpa shell (regresi nol pada alur lama).
3. `pnpm verify` + 12 skenario F3 hijau; pipeline CI utama tetap tidak butuh Rust.
4. ADR-0015 Accepted; runbook setup terminal selesai; catat tanggal tutup di master plan §3.
