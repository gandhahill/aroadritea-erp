# ADR-0015: Native Packaging (Tauri 2) + Silent Printing ESC/POS

- **Status**: Proposed
- **Tanggal**: 2026-06-10
- **Pengambil keputusan**: Lintang Maulana Zulfan
- **Konteks bisnis**: SOURCE-OF-TRUTH §14 (POS & Operasional Toko)
- **Konteks teknis**: SYSTEM-DESIGN §14 (Offline POS), §33 (Naixer KDS), §34 (POS Demo), §35 (Resilience)

## Konteks

ERP Aroadri dibangun sebagai web app Next.js 15 (`apps/web`) + PWA offline untuk POS (ADR-0009). Saat ini POS mencetak struk/label lewat **dialog print browser**, yang punya dua masalah operasional di kasir:

1. **Dialog print selalu muncul** — kasir harus klik "Print" tiap transaksi. Browser sengaja blokir _silent printing_ demi keamanan. Untuk volume F&B yang ramai, ini lambat dan rawan salah klik.
2. **Tidak ada kontrol format struk thermal** — print via HTML tidak memberi kontrol penuh atas ESC/POS (lebar kertas, codepage, potong kertas, buka laci).

User ingin ERP **bisa di-install secara native** di perangkat kasir supaya bisa **print diam-diam tanpa dialog**.

**Realita fleet kasir (heterogen)** — dikonfirmasi user 2026-06-10:

| Dimensi | Variasi di lapangan |
|---|---|
| Platform perangkat kasir | **Android** (sebagian) + **Windows** (sebagian) |
| Koneksi printer | **Bluetooth** (sebagian) + **USB** (sebagian) |
| iOS | **Tidak dibutuhkan** |

Artinya ada **4 kombinasi** (Android/Windows × BT/USB) yang harus didukung satu basis kode. Printer label yang sudah dipakai: **Comson** (lihat ADR-0007). Catatan: jalur ini untuk **struk pelanggan + label/tiket dapur**, **bukan** jalur QR Naixer KDS (itu tetap via QR — ADR-0007).

**Kendala pengikat**: solo dev, anggaran ketat, prinsip hemat resource (server 1 vCPU/2 GB). Solusi tidak boleh memaksa rewrite UI atau menambah toolchain berlebihan.

## Keputusan

### 1. Hanya surface POS yang dibungkus native — bukan seluruh ERP

`apps/web` memakai Server Components / server actions Next.js 15 yang **tidak bisa di-static-export** dengan mulus ke dalam app native. Maka:

- **Hanya surface POS** yang dijadikan app native (di situ silent print dibutuhkan).
- Modul lain (accounting, reporting, tax, HR, dsb.) tetap diakses lewat **browser biasa** — tidak butuh native shell.
- Shell native memuat POS via **webview yang mengarah ke URL hosting** (mis. `erp.aroadritea.com`), bukan membundel seluruh app. Offline POS tetap berfungsi karena PWA/Serwist sudah aktif (ADR-0009).

### 2. Shell native: **Tauri 2** untuk Android dan Windows (satu basis kode)

Karena fleet butuh Android **dan** Windows, Tauri 2 dipilih karena menutup keduanya dengan satu toolchain (Rust), binary kecil (sejalan prinsip hemat resource), dan transport hardware diimplementasikan di sisi Rust lintas-platform.

### 3. Arsitektur cetak berlapis (satu abstraksi, transport tipis di belakang)

Prinsip kunci: apapun platform & koneksinya, ujungnya **mengirim aliran byte ESC/POS**. Yang berbeda hanya transport-nya. Maka jangan membuat 4 versi app — buat satu builder + empat adapter.

```
Receipt (data struk/label)
  └─> ESC/POS byte builder      ← ditulis SEKALI di packages/, unit-testable, no I/O
        └─> Bridge (Tauri command, JS↔Rust): printReceipt(bytes, printerId)
              └─> Transport adapter (dipilih dari konfigurasi terminal di DB)
                    ├─ Windows + USB
                    ├─ Windows + Bluetooth (SPP → COM)
                    ├─ Android  + USB (USB Host API)
                    └─ Android  + Bluetooth (SPP/BLE)
```

| Lapisan | Lokasi | Tanggung jawab |
|---|---|---|
| Format struk → ESC/POS bytes | `packages/` (TS) | Builder murni, deterministik, **unit-testable** |
| Bridge | Tauri command (JS↔Rust) | Kirim `bytes` + `printerId` ke native |
| Transport adapter | Rust (di shell) | 4 implementasi: Win-USB, Win-BT, Android-USB, Android-BT |
| Konfigurasi printer per terminal | **DB** | platform, transport, device id, lebar kertas, codepage |

### 4. Konfigurasi printer di DB, bukan hardcode

Sesuai aturan §5.7 CLAUDE.md (config database-driven). Tabel baru, diusulkan `pos_printer_configs`:

| Field | Tipe | Catatan |
|---|---|---|
| 🔑 `id` | text | ULID |
| `*tenant_id` | text 🔗 | |
| `*location_id` | text 🔗 | terminal/outlet |
| `*terminal_id` | text | identitas perangkat kasir |
| `*platform` | text CHECK | `'android' \| 'windows'` |
| `*transport` | text CHECK | `'bluetooth' \| 'usb'` |
| `*device_ref` | text | MAC address (BT) / vendor:product id / nama port (USB/COM) |
| `*paper_width` | int CHECK | `58` \| `80` (mm) |
| `~codepage` | text | mis. `CP437`, `CP1252` — encoding ESC/POS |
| `*role` | text CHECK | `'receipt' \| 'kitchen' \| 'label'` |
| `*is_active` | boolean | |
| audit cols | — | `created_at/by`, `updated_at/by`, `deleted_at` (§5.3) |

Saat POS mencetak, engine membaca config terminal aktif → pilih adapter transport yang sesuai. Outlet A (tablet Android + Bluetooth) dan outlet B (Windows + USB) sepenuhnya diatur dari data, bukan cabang kode.

### 5. Fallback ke print browser (degradasi mulus)

Jika POS dibuka di **browser polos tanpa shell native** (atau native bridge gagal), POS otomatis jatuh ke **print HTML browser biasa** (dengan dialog). Ini menjaga PWA tetap berfungsi penuh dan tidak mengunci POS ke perangkat ber-shell saja.

### 6. Audit trail

Setiap pencetakan struk/tiket adalah event operasional → dicatat (status cetak, terminal, printer, hasil sukses/gagal) sesuai §5.7 (larangan skip audit). Re-print harus tercatat terpisah.

## Alternatif yang Dipertimbangkan

### A. React Native + React Native for Windows
- Pros: "native sungguhan", ekosistem printer Android matang.
- Cons: RN render ke komponen native, **bukan DOM** → seluruh UI `apps/web` (shadcn/Tailwind/brand-override) harus **ditulis ulang**. RN-for-Windows komunitas kecil & support printing tipis. Effort terbesar untuk basis kode yang sudah web.
- **Ditolak** — salah alat untuk web app yang sudah jadi.

### B. Capacitor untuk Android + Windows
- Pros: bungkus web app apa adanya; ekosistem plugin thermal Android sangat matang.
- Cons: di **Windows**, Capacitor jatuh ke **Electron** (community) — berat (~100 MB+), bertentangan dengan prinsip hemat resource. Dua toolchain (Capacitor + Electron) untuk solo dev.
- **Ditolak sebagai pilihan utama**, tetapi adapter Android-nya tetap layak ditinjau ulang bila Tauri-Android bermasalah (lihat Konsekuensi).

### C. Chrome Kiosk Printing (`--kiosk-printing`)
- Pros: 0 kode baru; dialog hilang; cocok terminal Windows fix.
- Cons: Windows-only praktisnya; tetap cetak via HTML (tanpa kontrol ESC/POS penuh); tidak menyelesaikan sisi Android/Bluetooth.
- **Ditolak sebagai solusi akhir**, tapi **boleh dipakai sebagai jembatan jangka pendek** di terminal Windows sebelum shell Tauri siap.

### D. Local Print Bridge / Agent terpisah (mis. QZ Tray atau agent custom)
- Pros: web app tak berubah; kontrol ESC/POS penuh; lintas-OS.
- Cons: agent terpisah harus di-install & dirawat per mesin; di Android kurang pas. Dengan Tauri sebagai shell, logika cetak sudah ada di dalam shell sehingga agent terpisah jadi redundan.
- **Ditolak** karena fungsinya diserap oleh shell Tauri; pola transport-nya tetap diadopsi (poin Keputusan §3).

## Konsekuensi

### Positif
- **Tanpa rewrite UI** — POS web dipakai apa adanya di dalam webview Tauri.
- **Satu basis kode** menutup 4 kombinasi (Android/Windows × BT/USB).
- **Silent print + kontrol ESC/POS penuh** (lebar kertas, codepage, cut, buka laci).
- **Ringan** — binary Tauri kecil, konsisten dengan filosofi hemat resource.
- **Builder ESC/POS unit-testable** terpisah dari I/O → mudah dites tanpa printer fisik.
- **Konfigurasi per terminal di DB** → fleet heterogen tanpa cabang kode.
- **Degradasi mulus** ke print browser bila tanpa shell.

### Negatif / Trade-off
- **Toolchain Rust** baru untuk solo dev (build + signing Android/Windows). Mitigasi: scope kecil (hanya shell + transport), CI build per platform.
- **Tauri mobile (Android) lebih muda** dari Capacitor. Mitigasi: adapter transport diisolasi di balik antarmuka `PrinterPort` — bila Tauri-Android bermasalah, adapter Android bisa dipindah ke Capacitor **tanpa** mengubah builder ESC/POS maupun UI POS.
- **Pengelolaan perangkat** (pairing BT, izin USB Host) berbeda per platform → butuh runbook setup terminal.
- **Signing**: Windows perlu sertifikat code-signing (opsional tapi disarankan); Android perlu keystore. Belum perlu Apple (no iOS).

### Neutral
- **Jalur Naixer KDS tetap QR** (ADR-0007) — tidak terpengaruh keputusan ini.
- **Printer Comson** yang ada perlu diuji kompatibilitas perintah ESC/POS-nya saat implementasi.

## Implementasi Checklist (indikatif — saat fase POS)

### Foundation
- [ ] `packages/<x>/escpos` — builder byte ESC/POS (struk, label, tiket dapur) + unit test.
- [ ] Schema `pos_printer_configs` di `packages/db/schema/` + migrasi + audit cols.
- [ ] Service resolusi printer: `printer.resolve(terminalId, role)` → config aktif.
- [ ] Antarmuka `PrinterPort` (TS) + fallback adapter print-browser.

### Shell Tauri
- [ ] Scaffold app Tauri 2 (target Android + Windows) memuat URL POS.
- [ ] Tauri command `printReceipt(bytes, printerId)`.
- [ ] Adapter Rust: Windows-USB, Windows-BT(SPP/COM), Android-USB(Host API), Android-BT(SPP/BLE).
- [ ] Audit log event cetak (sukses/gagal, re-print).

### Operasional
- [ ] Runbook setup terminal (pairing BT, izin USB, pemilihan printer).
- [ ] (Opsional jembatan) aktifkan Chrome `--kiosk-printing` di terminal Windows sementara shell disiapkan.
- [ ] Uji kompatibilitas ESC/POS printer Comson + printer thermal 58/80mm yang dipakai.

## Referensi

- ADR-0006 (Design System) — UI brand-override yang dipertahankan apa adanya di webview.
- ADR-0007 (Naixer KDS via QR) — jalur cetak label/KDS yang terpisah dari jalur ini.
- ADR-0009 (Resilience & Auto-Recovery) — PWA offline POS + idempotency.
- ADR-0008 (POS Demo Mode) — demo client-side, tidak mencetak ke perangkat nyata.
- SYSTEM-DESIGN.md §14 (Offline POS), §33 (Naixer), §34 (POS Demo), §35 (Resilience).
- CLAUDE.md §5.3 (audit cols), §5.7 (config database-driven, larangan skip audit).
- Spesifikasi ESC/POS (Epson) — perintah cetak thermal standar industri.
