# ADR-0010: PPN Engine — Opt-In (Siap Aktif tapi Default Off)

- **Status**: Accepted
- **Tanggal**: 2026-05-05
- **Pengambil keputusan**: Lintang Maulana Zulfan
- **Konteks bisnis**: SOURCE-OF-TRUTH §6.5 (PB1/PBJT), §11 (Perpajakan)
- **Konteks teknis**: SYSTEM-DESIGN §19 (Tax Engine), §20 (Accounting Engine)

## Konteks

PT. Gandha Hill (Aroadri Tea) berstatus **PKP** (Pengusaha Kena Pajak) — terdaftar sebagai pemungut PPN. Namun:

- **Penjualan retail F&B** di toko **dikenakan PB1/PBJT 10% inclusive** (pajak restoran daerah, bukan PPN).
- Untuk transaksi retail F&B ini, **tidak ada kewajiban memungut PPN tambahan** — sudah cover oleh PB1.
- **Pembelian dari supplier PKP** menghasilkan PPN Masukan (Vat In) yang harus dicatat dan dilaporkan (untuk klaim restitusi atau kredit pajak).
- Kelak mungkin ada **transaksi B2B / corporate / wholesale / catering** yang **dikenakan PPN keluaran** (Vat Out) — saat ini belum dilakukan tapi disebutkan di SoT §4 sebagai potential future channel.

User mengarahkan (2026-05-05): "Untuk saat ini tidak dikenakan PPN, tapi harusnya ada fitur yang bisa mengakomodasi pengenaan PPN."

## Keputusan

Engine pajak dirancang **PPN-ready**, namun **default off** untuk transaksi penjualan retail F&B. Detail:

### 1. Tarif PPN Tetap Di-Seed
Saat go-live Phase 1, tabel `tax_rates` tetap di-seed dengan:
- `PB1` — `is_active=true`, `applies_to_default=true` untuk channel `walk_in`, `gofood`, `grabfood`, `shopeefood`.
- `PPN_OUT` (PPN Keluaran) — `is_active=true` (untuk B2B kelak), `applies_to_default=false` untuk channel retail.
- `PPN_IN` (PPN Masukan) — `is_active=true`, dipakai untuk **pembelian** dari supplier PKP saat menerima Faktur Pajak.
- `PPH21`, `PPH23`, `PPH25` — sesuai SoT §11.1.

### 2. Field Konfigurasi di Channel / Customer / Product

#### `tax_rules` (tabel baru)
| Field | Tipe | Catatan |
|---|---|---|
| 🔑 `id` | text | ULID |
| `*tenant_id` | text 🔗 | |
| `*scope_kind` | text CHECK | `'channel' \| 'customer_segment' \| 'product_category' \| 'global_default'` |
| `~scope_id` | text | id channel/customer/category — NULL kalau global |
| `*tax_code` | text 🔗 tax_rates.code | |
| `*is_applied_default` | boolean | TRUE = otomatis dipakai saat dokumen di-create |
| `*priority` | int | resolusi konflik bila multiple match |
| `*effective_from` | date | |
| `~effective_until` | date | |

Engine resolution saat membuat sales_order:
1. Lihat `customer.tax_segment` (mis. "B2B PKP" → PPN keluaran wajib).
2. Bila tidak ada → lihat `channel` (`walk_in` retail F&B → PB1 only).
3. Bila tidak ada → lihat `product_category` (mis. "merchandise non-makanan" mungkin kena PPN).
4. Fallback `global_default`.

### 3. UI: Opsi Manual Override per Dokumen
Setiap `sales_order` (B2B) atau `purchase_order` punya field opsional `tax_override` di header — staff dapat memaksa tax tertentu untuk dokumen ini (dengan permission `tax.override`, audit-logged).

### 4. Settings → Tax Configuration
Halaman admin di `apps/web /settings/tax/` memungkinkan direktur:
- Aktifkan/non-aktifkan tarif (toggle `is_active`).
- Edit tarif `rate_bps` (audit log + effective_from baru, jangan overwrite).
- Atur `tax_rules` per channel / customer segment / product category.
- Preview: simulasi transaksi untuk verifikasi tax calc.

### 5. PB1 Inclusive Tetap Default (Tidak Berubah)
Aturan SoT §6.5 tetap berlaku:
- PB1 10% **inclusive** harga jual yang ditampilkan.
- Untuk laporan: `tax_base = gross / (1 + 0.10)`, `pb1 = gross - tax_base`.

### 6. PPN Inclusive vs Exclusive
Tabel `tax_rates.calculation` menentukan:
- `inclusive`: tarif sudah masuk dalam harga.
- `exclusive`: tarif ditambahkan di atas harga.

Default seed:
- PB1: `inclusive`
- PPN_OUT: `exclusive` (kalau diaktifkan untuk B2B, biasanya ditambahkan di atas — sesuai praktik industri B2B Indonesia)
- PPN_IN: `exclusive`

### 7. Posting Akun
- PB1 → akun `PB1 / PBJT Payable` (di SoT Lampiran A).
- PPN_OUT → akun `PPN Outcome (Vat Out)`.
- PPN_IN → akun `Vat In (PPN Income)`.

Akun ini **sudah ada di seed COA** (lihat SoT Lampiran A) — tidak butuh migrasi tambahan.

### 8. Pembelian dari Supplier PKP (Aktif Sejak Phase 1)
Meski PPN penjualan default off, **PPN Masukan dari pembelian tetap aktif**:
- Saat membuat Purchase Invoice, jika supplier `is_pkp=true` dan ada faktur pajak masuk → input nominal PPN.
- JE: `Inventory/Asset (DR) + Vat In PPN (DR) / Account Payable (CR)`.
- Coretax export PPN Masukan tetap berfungsi.

### 9. Roadmap Aktifasi PPN Keluaran
Tahapan saat user ingin aktifkan PPN keluaran (mis. ekspansi B2B):
1. Buat customer segment "B2B PKP" di partners.
2. Konfigurasi `tax_rules` — channel B2B + segment "B2B PKP" → apply `PPN_OUT`.
3. Buat tipe dokumen tambahan "Sales Invoice B2B" (selain POS retail).
4. Generate Faktur Pajak (e-Faktur via Coretax export).
5. Konsultasi konsultan pajak untuk skema (DPP, Tarif Efektif Lain, dll.) bila perlu.

> Aktivasi PPN keluaran ini **tidak ditulis ulang** — engine sudah siap, hanya konfigurasi.

## Alternatif yang Dipertimbangkan

### A. Tidak Membangun PPN Engine Sama Sekali (Hanya PB1)
- Pros: Sederhana Phase 1.
- Cons:
  - Saat user butuh aktifkan PPN, perlu rebuild engine + migrasi data + retest semua flow.
  - Kelak akan jadi technical debt besar.
- **Ditolak** sesuai arahan user "siapkan fitur untuk akomodasi".

### B. PPN Aktif Default
- Pros: Konsisten dengan status PKP.
- Cons:
  - Salah memungut PPN di transaksi retail F&B (yang sudah PB1) → masalah pajak ganda.
  - Berisiko complience.
- **Ditolak**.

### C. PPN sebagai Module Terpisah (Plugin)
- Pros: Isolation.
- Cons:
  - Tax engine inti perlu tetap tahu PPN untuk kalkulasi gabungan.
  - Plugin tambah kompleksitas.
- **Ditolak**, integrate di engine utama dengan flag.

### D. PPN Hardcode di Channel Tertentu
- Pros: Sederhana.
- Cons: Tidak fleksibel untuk segmentasi customer / product category.
- **Ditolak**, gunakan `tax_rules` table.

## Konsekuensi

### Positif
- **Forward-compatible**: engine siap aktif tanpa rebuild saat bisnis menambah B2B.
- **Compliance current**: tidak salah memungut PPN di retail F&B yang sudah dipajaki PB1.
- **PPN Masukan tetap recorded**: klaim restitusi / kredit pajak dari pembelian supplier PKP berjalan.
- **Audit-friendly**: aktifasi PPN keluaran kelak tercatat di tabel `tax_rules` + audit log + ADR baru bila ada perubahan strategi.
- **Coretax export ready**: format export PPN keluaran dan masukan sudah dirancang.

### Negatif / Trade-off
- **Kompleksitas engine awal lebih tinggi**: schema `tax_rules` + resolusi prioritas. Mitigasi: implementasi bertahap, minimum viable di Phase 1 (hanya PB1 + PPN_IN aktif), lengkapi Phase 2+ bila perlu.
- **UI Settings tax**: butuh halaman admin yang baik. Mitigasi: prioritaskan fitur read-only di Phase 1, edit di Phase 2.
- **Risiko salah konfigurasi user**: kalau direktur salah mengaktifkan PPN untuk channel retail → pajak ganda. Mitigasi: validation guard ("Yakin aktifkan PPN untuk channel walk_in? Channel ini sudah dikenakan PB1 — biasanya PPN tidak berlaku ganda. Konsultasikan konsultan pajak."), audit log, dan permission `tax.update` ketat.

### Neutral
- **Konsultan pajak**: user perlu konfirmasi skema PPN saat ekspansi B2B nanti — engine kita siap, tetapi keputusan compliance ada di konsultan.

## Implementasi Checklist

### Phase 1 (Foundation + Tax)
- [ ] Schema `tax_rates` (sudah ada di SD §9.2).
- [ ] Schema `tax_rules` (baru — tambah ke `packages/db/schema/tax.ts`).
- [ ] Seed default: PB1 active+default (channel retail), PPN_OUT inactive untuk default channel, PPN_IN active untuk procurement.
- [ ] Service `tax.resolve(context)` → returns applicable tax rate(s).
- [ ] Service `tax.calculate(amount, taxCode, calculation)` → returns tax_base + tax_amount.
- [ ] Validation guard saat update `tax_rules` (warning bila kombinasi mencurigakan).
- [ ] Coretax export PPN Masukan (dari purchase_invoices yang punya PPN_IN line).

### Phase 2+ (Saat B2B Aktif)
- [ ] UI Settings → Tax Configuration (CRUD `tax_rules`).
- [ ] UI tax override per dokumen.
- [ ] Coretax export PPN Keluaran.
- [ ] Faktur Pajak generator (PDF + nomor seri sesuai aturan DJP).

## Referensi

- UU PPN dan PB1/PBJT (UU HKPD 2022) — landasan hukum.
- SOURCE-OF-TRUTH.md §6.5 (PB1 inclusive), §11 (Perpajakan)
- SYSTEM-DESIGN.md §19 (Tax Engine), §20 (Accounting Engine)
- ADR-0005 (Build vs Modify) — alasan engine dibangun custom yang fleksibel
