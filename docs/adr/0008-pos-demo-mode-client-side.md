# ADR-0008: POS Demo / Training Mode (Client-Side IndexedDB Sandbox)

- **Status**: Accepted
- **Tanggal**: 2026-05-05
- **Pengambil keputusan**: Lintang Maulana Zulfan
- **Konteks bisnis**: SOURCE-OF-TRUTH §24 (POS Demo / Training Mode)
- **Konteks teknis**: SYSTEM-DESIGN §34 (POS Demo / Training Mode)

## Konteks

User memerlukan **mode demo POS** yang:
- Memungkinkan kasir baru berlatih semua flow tanpa risiko polusi data.
- Memungkinkan demo ke calon mitra/investor.
- Memungkinkan QA / dev menguji fitur baru di toko nyata.
- **TIDAK** mempengaruhi data produksi (DB, akuntansi, inventory, KDS, audit log).
- **TIDAK** mengirim transaksi ke Naixer.

## Keputusan

**Demo mode = sandbox client-side di IndexedDB**, terpisah total dari outbox produksi.

### Skema
```
indexeddb: aroadri-pos          ← produksi (transaksi nyata)
indexeddb: aroadri-pos-demo     ← demo (transaksi hilang setelah reset)
```

### Aktifasi
- Permission baru: `pos.demo.use` (default off untuk staff baru, on untuk role training_lead).
- Tombol "Mode Demo" di menu kasir → modal konfirmasi → toggle ke `/pos/demo`.
- Master data (produk, harga, modifier, tax) **di-snapshot** dari `aroadri-pos` (read-only) ke `aroadri-pos-demo` saat aktivasi.

### Indikasi Visual (wajib)
- Banner persistent atas: "MODE DEMO — Transaksi tidak masuk sistem" warna `brand.red` background, putih text.
- Title bar browser: prefix `[DEMO]`.
- Setiap order detail: stempel diagonal "DEMO" di tampilan ringkas.

### Cetak Label
- Default: **preview di layar** (modal showing struk + QR).
- Opsional toggle: cetak fisik dengan watermark "DEMO / TIDAK SAH" + QR prefix `DEMO-` (Naixer tidak akan baca).
- Permission tambahan: `pos.demo.print` untuk cetak fisik.

### Tidak Pernah Sync ke Server
- Service worker tidak mengirim `pending_orders` dari `aroadri-pos-demo` ke `/api/sync/pos`.
- Bahkan bila online, transaksi demo **tetap di device**.
- Browsing dari device lain tidak melihat transaksi demo (isolasi per-device by design).

### Reset & Keluar
- "Reset Demo": hapus `demo_orders` saja, snapshot master tetap.
- "Keluar Mode Demo": wipe seluruh `aroadri-pos-demo` + redirect `/pos`.

### Master Data Stale
Snapshot master tidak boleh > 24 jam (harga produk mungkin berubah). Bila lewat: prompt user untuk refresh snapshot dari produksi.

## Alternatif yang Dipertimbangkan

### A. Tenant Demo Server-Side
Buat tenant baru `tenant_id='demo'` di DB dengan data terpisah.

- Pros: Konsisten dengan multi-tenant pattern; bisa diakses dari multi-device.
- Cons:
  - Menambah beban database (tabel `*_demo` atau partisi).
  - Risiko kebocoran: bug di permission check bisa membuat data demo bocor ke produksi atau sebaliknya.
  - Cleanup data demo periodik perlu worker.
  - Lebih kompleks untuk dev solo.
- **Ditolak**.

### B. Tabel `*_demo` Paralel
Setiap tabel transaksional punya twin `_demo`. Service layer route berdasarkan flag.

- Pros: Isolasi schema-level.
- Cons:
  - Duplikasi schema 30+ tabel.
  - Migrasi 2x lipat.
  - Risiko drift schema antara `*` dan `*_demo`.
- **Ditolak**.

### C. Schema PostgreSQL Terpisah (`schema_demo`)
- Pros: Isolasi schema-level dengan satu set DDL.
- Cons:
  - Connection routing rumit; setiap query butuh `SET search_path`.
  - Drizzle support multi-schema agak verbose.
  - Migrasi tetap 2x.
- **Ditolak** (kompleksitas vs benefit untuk dev solo).

### D. Database Lokal di Device (SQLite via WASM)
- Pros: Isolasi fisik penuh.
- Cons:
  - Bundle SQLite WASM ~500 KB tambahan.
  - Drizzle SQLite client di browser belum mature.
  - IndexedDB sudah cukup untuk use case demo.
- **Ditolak** (overengineering).

## Konsekuensi

### Positif
- **Isolasi sempurna**: data demo tidak bisa bocor ke produksi (different IndexedDB database).
- **Sederhana**: tidak ada perubahan schema server.
- **Cepat reset**: tinggal hapus IndexedDB.
- **Per-device**: setiap kasir punya sandbox sendiri; tidak konflik dengan kasir lain.
- **Aman dari Naixer**: QR demo prefix `DEMO-` tidak terbaca mesin.
- **Hemat resource server**: tidak menambah beban DB / RAM.

### Negatif / Trade-off
- **Demo terbatas ke modul POS**: tidak bisa demo akuntansi / payroll. Mitigasi: untuk demo modul lain, gunakan **environment staging** (terpisah).
- **Tidak ada history demo cross-device**: kalau training di device A, tidak terlihat di device B. Mitigasi: per design — demo per kasir.
- **Stale master data**: snapshot bisa basi. Mitigasi: warning + tombol refresh.

### Neutral
- **Kalau Phase 2 butuh demo modul lain**: pertimbangkan environment staging.

## Implementasi Checklist
- [ ] Permission `pos.demo.use`, `pos.demo.print` di-seed.
- [ ] Komponen banner DEMO di `packages/ui/`.
- [ ] Service worker filter: jangan sync dari `aroadri-pos-demo`.
- [ ] Halaman `/pos/demo` di `apps/web` dengan toggle store.
- [ ] Tombol "Reset Demo" + "Keluar Mode Demo".
- [ ] Test E2E: skenario aktivasi, transaksi demo, reset, keluar, verifikasi tidak ada record di server.
- [ ] Dokumentasi pelatihan untuk kasir baru (di `docs/runbook/pos-demo-mode.md`).

## Referensi
- SOURCE-OF-TRUTH.md §24
- SYSTEM-DESIGN.md §34
- ADR-0007 (Naixer QR — bagian demo prefix)
