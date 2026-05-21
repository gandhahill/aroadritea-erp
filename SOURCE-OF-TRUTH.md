# SOURCE OF TRUTH — Sistem ERP Aroadri Tea

> Dokumen ini adalah **sumber kebenaran tunggal** untuk perancangan dan pengembangan sistem ERP PT. Gandha Hill Catering Management Indonesia (merek Aroadri Tea). Diolah dari kuesioner kebutuhan tertanggal 30 April 2026 (Versi 1.0). Setiap perubahan kebutuhan **wajib** diturunkan ke dokumen ini sebelum diimplementasikan ke kode.
>
> **Owner dokumen**: Lintang Maulana Zulfan (PIC + developer)
> **Versi**: 1.3 — 5 Mei 2026
> **Sumber mentah**: `../ERP-Questionaire.pdf` (30 halaman, terlampir foto lapangan) + arahan tambahan user 2026-05-05 v1 (subdomain split, CMS, public membership) + v2 (RAM upgrade ke 2 GB, Naixer QR detail, POS demo mode, resilience, anti-generic UI) + v3 (PPN engine opt-in)

---

## Daftar Isi

1. [Profil Perusahaan](#1-profil-perusahaan)
2. [Visi & Strategi Bisnis](#2-visi--strategi-bisnis)
3. [Struktur Organisasi & Peran](#3-struktur-organisasi--peran)
4. [Kanal Penjualan & POS](#4-kanal-penjualan--pos)
5. [Katalog Produk & Menu](#5-katalog-produk--menu)
6. [Transaksi, Pembayaran, Pajak Penjualan](#6-transaksi-pembayaran-pajak-penjualan)
7. [Diskon & Promosi](#7-diskon--promosi)
8. [Inventory & Bill of Materials](#8-inventory--bill-of-materials)
9. [Procurement & Supplier](#9-procurement--supplier)
10. [Akuntansi & Keuangan](#10-akuntansi--keuangan)
11. [Perpajakan](#11-perpajakan)
12. [HR & Payroll](#12-hr--payroll)
13. [CRM & Loyalty](#13-crm--loyalty)
14. [Dapur, KDS, Produksi](#14-dapur-kds-produksi)
15. [Multi-Lokasi & Cabang](#15-multi-lokasi--cabang)
16. [Laporan & Dashboard](#16-laporan--dashboard)
17. [Infrastruktur & Teknologi](#17-infrastruktur--teknologi)
18. [Keamanan, Audit, Backup](#18-keamanan-audit-backup)
19. [Regulasi & Kepatuhan](#19-regulasi--kepatuhan)
20. [Roadmap, Prioritas Modul, Timeline](#20-roadmap-prioritas-modul-timeline)
21. [Pain Points & Fitur Khusus](#21-pain-points--fitur-khusus)
21a. [§21.2a — Ekspor Excel (XLSX)](#212a--ekspor-excel-xlsx)
21b. [§21.2b — Halaman Dokumentasi](#212b--halaman-dokumentasi--petunjuk-penggunaan)
22. [Public Website, CMS, Membership Online](#22-public-website-cms-membership-online)
23. [Brand & Visual Identity](#23-brand--visual-identity)
24. [POS Demo / Training Mode](#24-pos-demo--training-mode)
25. [Resilience & Auto-Recovery](#25-resilience--auto-recovery)
26. [Glosarium](#26-glosarium)
27. [Lampiran A — Chart of Accounts (COA) Lengkap](#lampiran-a--chart-of-accounts-coa-lengkap)
28. [Lampiran B — Foto Lapangan & Sistem Lama](#lampiran-b--foto-lapangan--sistem-lama)

---

## 1. Profil Perusahaan

| Item | Nilai |
|---|---|
| Nama legal | **PT. Gandha Hill Catering Management Indonesia** |
| Merek dagang | **Aroadri Tea** |
| Tanggal pendirian | 17 Oktober 2024 |
| Dasar pendirian | Akta notaris dan SK Menkumham |
| NPWP | `0124030644036000` |
| NIB | `1810240376213` |
| Status PKP | **PKP** (terdaftar) |
| BPOM / Halal | **Belum ada** (dalam rencana) |
| Domain | `aroadritea.com` |

### KBLI Terdaftar
- Perdagangan besar berbagai macam barang
- Aktivitas konsultasi manajemen lainnya
- Sewa guna usaha tanpa hak opsi intelektual properti, bukan karya hak cipta
- Pelatihan kerja swasta lainnya
- Restoran

> **Catatan kepatuhan**: industri F&B harus mengikuti regulasi BPOM, Sertifikasi Halal, standar keamanan pangan, dan Perda pajak restoran (PB1/PBJT). Sistem ERP wajib dapat menyimpan dokumen sertifikasi (lapangan rencana ke depan) dan menghitung PB1/PBJT 10%.

---

## 2. Visi & Strategi Bisnis

| Pertanyaan | Jawaban |
|---|---|
| Visi 1/3/5 tahun | **Belum ditetapkan** — sistem perlu fleksibel terhadap arah bisnis di masa depan |
| Target outlet 1–3 tahun | Ada rencana, fokus awal di **Yogyakarta** |
| Rencana ekspansi (franchise / marketplace / B2B / catering) | **Belum direncanakan** |
| Target omzet | Belum ditetapkan (operasional baru dimulai 2026) |
| Kompetitor utama | **Chagee, Molly Tea** (segmen Chinese-style premium tea) |
| Diferensiasi Aroadri Tea | (diisi belakangan — ruang kosong di kuesioner) |

**Implikasi desain**: karena visi belum dibekukan, ERP **harus mudah ditambah modul / dimensi baru** (mis. franchise fee, marketplace channel, B2B invoicing) tanpa membongkar skema inti. Hindari hard-coding asumsi "single brand single channel".

---

## 3. Struktur Organisasi & Peran

### 3.1 Komposisi Tim Saat Ini
- **Karyawan tetap**: 8 orang (ada rencana penambahan)
- **Pekerja part-time / freelance**: ada — untuk asisten manajemen, keuangan, akuntansi, pajak
- **Karyawan asing (WNA)**: tidak ada
- **Bahasa kerja**: staf operasional menggunakan **Bahasa Indonesia**, direksi menggunakan **Mandarin** → ERP harus **multibahasa: Indonesia + Inggris + Mandarin** sejak awal

### 3.2 Daftar Peran Pengguna ERP
Peran yang sudah disebut user (daftar dapat ditambah; sistem **wajib** mengizinkan menambah peran + izin baru tanpa mengubah source code):

| Peran | Wewenang Inti |
|---|---|
| **Direktur** | Approval pembelian/PO, pengeluaran kas, penyesuaian stok, diskon/promosi, pembelian aset tetap, write-off bahan, pengajuan cuti |
| **Wakil Direktur** | (akan diturunkan dari direktur sesuai kebutuhan) |
| **Manajemen** | Operasional harian, monitoring laporan |
| **Akuntan / Keuangan** | Pencatatan pembukuan, rekonsiliasi bank (bulanan), administrasi pajak (internal) |
| **Kepala Toko** | Operasional toko, koordinasi staf shift |
| **Kasir** | Transaksi POS, **pembatalan transaksi** (kewenangan kasir), refund via mesin POS |
| **Asisten part-time** | Manajemen, keuangan, akuntansi, pajak (dukungan) |

Semua peran perlu **akses mobile** (smartphone). Sistem harus mendukung **kerangkap jabatan** (satu user dapat memiliki >1 peran).

### 3.3 Pemilik / Investor
- Pemilik **terlibat operasional** → tidak ada kebutuhan akses laporan terpisah untuk investor non-operasional saat ini.

### 3.4 Matriks Approval
| Aksi | Penyetuju |
|---|---|
| Purchase Order | Direktur |
| Pengeluaran kas | Direktur |
| Penyesuaian stok / inventory | Direktur |
| Diskon / promosi (membuat & mengaktifkan) | Direktur |
| **Pembatalan transaksi** | Kasir |
| Refund | Kasir (via mesin POS) |
| Write-off bahan baku rusak/kadaluarsa | Direktur |
| Pengajuan cuti | Direktur |
| Pembelian aset tetap | Direktur |

> **Tidak ada batas approval berjenjang** (mis. > Rp 5jt perlu approval lebih tinggi). Semua approval mengarah langsung ke direktur. **Namun** sistem **harus dapat dikonfigurasi** menambahkan rule berjenjang ke depan tanpa edit kode.

---

## 4. Kanal Penjualan & POS

### 4.1 Saluran Aktif
- ✅ **Toko fisik (walk-in)** — dine-in & take-away (tanpa area khusus terpisah)
- ✅ **Aplikasi delivery**: GoFood, GrabFood, ShopeeFood
- ❌ Marketplace (Tokopedia/Shopee) — belum
- ❌ Website e-commerce sendiri — belum
- ❌ Pre-order / made-to-order — belum
- ❌ B2B / corporate / wholesale — belum
- ❌ Catering / event — belum

### 4.2 Struktur Harga per Kanal
- Harga jual **sama di semua kanal**.
- Untuk delivery: **dipotong komisi 20%** (pendapatan bersih = 80% × harga jual).
- ERP **harus dapat berbeda harga per cabang** (jawaban Q110: "bisa berbeda"), meskipun saat ini disamakan.

### 4.3 Membership / Loyalty
- Belum berjalan; **akan direncanakan** → siapkan kerangka modul (member ID, point ledger, tier, redeem) tapi non-aktif default.

---

## 5. Katalog Produk & Menu

### 5.1 Kategori
1. **Teh** (minuman utama)
2. **Dessert**: egg tart (Rp 18.000 terlihat di display), fancy egg tart, pudding, mousecake

### 5.2 Lini Minuman & Varian
Mengacu jawaban Q22 + tampilan KDS Naixer:

| Lini | Varian |
|---|---|
| **Fresh Milk Tea** | Bamboo Oolong, Osmanthus Oolong, Glutinous Fragrant, Jasmine Green, Ceylon Black, Roasted Fragrant Yellow |
| **Fresh Tea** | Bamboo Oolong, Osmanthus Oolong, Jasmine Green, Ceylon Black, Roasted Fragrant Yellow, Glutinous Fragrant, Buckwheat Biluochun |
| **Lemon Fresh Tea** | Glutinous Fragrant, Bamboo Oolong, Osmanthus Oolong, Roasted Fragrant Yellow, Jasmine Green, Buckwheat Biluochun |
| **Snow Cap Milk Tea** | Bamboo Oolong, Osmanthus Oolong |

### 5.3 Atribut Varian
- **Ukuran**: Regular (≈ 500 ml) / Large
- **Suhu**: Hot / Cold
- **Range harga**: Regular Rp 32.000 – 45.000 ; Large Rp 42.000 – 49.000
- **Customization**:
  - Sugar level: normal sugar / less sugar / no sugar
  - Ice level: normal ice / less ice / no ice (untuk cold)
  - Topping (add-on): cheese pearl, oat pearl, crystal pearl, barley pearl

### 5.4 Produk Musiman / Bundle / Berat
- **Limited edition / musiman**: ada saat momen (Idul Fitri, Kemerdekaan RI, dll.) — perlu mekanisme product **flag musiman + tanggal aktif/non-aktif**
- **Bundle / combo**: belum ada
- **Produk per kg/liter**: tidak ada (semua per piece)

### 5.5 Produk Jadi Lain (Merchandise / Goodie Bag)
- Saat ini hanya **teh + dessert**. Tidak ada merchandise.

> **Implikasi schema**: gunakan model `Product → Variant → Modifier (sugar/ice/topping)` standar industri F&B. Topping sebagai item tersendiri (mempengaruhi harga & BOM).

---

## 6. Transaksi, Pembayaran, Pajak Penjualan

### 6.1 Metode Pembayaran yang Diterima
- ✅ Tunai
- ✅ Kartu debit/kredit (semua bank)
- ✅ **Flazz BCA**
- ✅ QRIS
- ❌ Transfer bank / e-wallet langsung — saat ini tidak (kemungkinan via QRIS)

### 6.2 Surcharge / MDR
- **Belum ada** surcharge atau biaya tambahan untuk metode bayar tertentu.

### 6.3 Refund & Retur
- Refund dapat dilakukan **dari mesin POS**
- Approval: **Kasir**
- Pembatalan transaksi: **Kasir**

### 6.4 Tipping
- **Belum ada** sistem tipping.

### 6.5 Pajak Penjualan: PB1 / PBJT
- **Tarif 10%**, **inclusive harga jual** (sudah termasuk dalam harga di menu)
- ERP wajib menghitung PB1/PBJT mundur dari harga jual untuk pelaporan.

### 6.6 Struk
- **Wajib cetak struk**, **3 printer**:
  1. **Label di gelas** (mengandung QR code unik per pesanan)
  2. **Struk untuk pelanggan / kasir**
  3. **Struk untuk dapur** (atau routing ke GoFood/GrabFood)
- Format label QR: contoh `T003-C01-S02-W01` (toko–channel–shift–worker / atau format unik per pesanan)
- Ukuran label Naixer KDS harus fleksibel per printer: **6x4 cm landscape** atau **4x3 cm landscape** sebagai pilihan awal.
- Isi label minimal: **QR code Naixer KDS**, **pickup number**, **jam pesanan**, dan **detail produk/modifier**.
- Lebar struk default **8 cm**, tetapi harus bisa diubah lewat UI setting karena ukuran printer thermal bisa berbeda.
- Contoh isi label: `Pickup number: 3 | 10:42 | Glutinous Fragrant Tea (500ml) | Less sugar, Normal ice`

### 6.7 Split Bill / Gabung Bill
- Belum ada kebutuhan, **tetapi** harus mudah ditambahkan sebagai fitur (kebutuhan deklaratif user).

---

## 7. Diskon & Promosi

### 7.1 Jenis yang Akan Berjalan
- ✅ Diskon persentase
- ✅ Buy X Get Y
- ✅ Voucher / kupon
- ✅ Diskon member (saat loyalty aktif)
- ✅ Promo platform (GoFood, GrabFood)
- ✅ Diskon manual sekali pakai di POS (harus beralasan dan masuk notifikasi review promosi)
- ❌ Happy hour — tidak diminta saat ini
- ❌ Diskon nominal flat sebagai program promosi permanen — tidak diminta saat ini

### 7.2 Aturan Promosi
- Pembuat & pengaktif promosi: **Direktur**
- **Belum ada** batas waktu, kuota, atau syarat minimum pembelian — tetapi sistem harus **dapat menambah** ketiga aturan tersebut sebagai fitur (per perintah user).
- Kasir boleh memasukkan diskon manual yang tidak ada di daftar promosi hanya untuk kasus operasional sekali pakai. Diskon manual wajib memiliki alasan tertulis, tercatat di audit, masuk total diskon POS, dan mengirim notifikasi kepada pengguna yang berwenang mengelola promosi agar dapat direview setelah transaksi.

> **Implikasi desain**: model promosi gunakan engine rule-based: `condition + scope + benefit + lifecycle (start/end/quota)`. Aktif/non-aktif via toggle.

---

## 8. Inventory & Bill of Materials

### 8.1 Bahan Baku Utama (Sample)
| Bahan | Satuan | Supplier | Lead Time | MOQ | Shelf Life |
|---|---|---|---|---|---|
| Teh (jenis: Jasmine Green, Osmanthus Oolong, Buckwheat Biluochun, Ceylon Black, Roasted Fragrant Yellow, Bamboo Oolong, Glutinous Fragrant) | g / pack 500 g | **Huabao** (Tiongkok) | 1 bulan | 1 dus | 6 bulan |
| Gula | kg | (lokal) | 1–2 hari | 1 dus | (umum) |
| Lemon | kg | (lokal) | 1–2 hari | 1 dus | (pendek, simpan kulkas) |
| Krimer (Creamer) | sesuai kemasan | (perlu input) | 1–2 hari | 1 dus | (perlu batch & expiry) |
| Frozen egg tart | pack | (perlu input) | 1–2 hari | 1 dus | (simpan freezer) |
| Basic syrup | botol/liter | Huabao | 1 bulan | — | — |
| Cup + tutup | pcs (per dus 1000 pcs) | Tiongkok | 1 bulan | 1 dus | — |

(Daftar lengkap akan diinput user sendiri ke sistem setelah modul inventory siap.)

### 8.2 Persyaratan Penyimpanan
- **Frozen / chilled**: lemon, egg tart → wajib catat lokasi rak / chest freezer
- **Dry**: teh, gula, krimer, cup
- Aset chest freezer terdaftar (Chest Freezer AB-318R)

### 8.3 Stok Penilaian & Manajemen
- Metode: **FIFO**
- **Stock opname**: bulanan untuk semua, **mingguan** untuk teh & lemon
- **Minimum stock alert** untuk: **teh, gula, lemon, krimer, cup** (target stok aman 3 bulan)
- **Tracking batch & expiry**: wajib untuk **krimer** (dapat diperluas)
- **Write-off** bahan rusak/kadaluarsa: dicatat, approval **Direktur**
- **Transfer bahan**: hanya **antar toko** (saat ini hanya satu toko aktif → kerangka transfer harus ada untuk pertumbuhan)

### 8.4 Lokasi Stok
- Saat ini: **stok di toko** (Malioboro)
- Skema multi-lokasi tetap disiapkan untuk gudang pusat / outlet baru ke depan, tetapi data publik dan seed produksi saat ini hanya memuat outlet aktif Yogyakarta.

### 8.5 Resep / BOM
- **Setiap produk** memiliki resep standar
- User akan **input resep sendiri** setelah sistem siap (ERP harus menyediakan UI BOM yang ramah)
- **Resep dapat berbeda per ukuran/varian**
- **Substitusi bahan** diperbolehkan (mis. merek creamer berbeda) — siapkan field "alternative ingredient"

> **Auto-deduct stok** saat penjualan adalah requirement WAJIB. BOM driver: setiap line item POS → deduct bahan baku otomatis berdasarkan resep.

---

## 9. Procurement & Supplier

### 9.1 Alur Pembelian Saat Ini
1. **Pengajuan**: Direktur
2. **Approval**: Direktur
3. **Pembuatan PO**: Direktur
4. **Penerimaan barang & cek**: Direktur
5. **Pencatatan pembukuan**: Akuntan

> Catatan: untuk skala kecil sekarang, satu orang (Direktur) menjalankan banyak peran. ERP harus tetap **mendukung pemisahan peran** secara logis ketika tim membesar (segregation of duties).

### 9.2 Aturan Pembelian
- Tidak ada batas approval berjenjang (semua di Direktur).
- Pembelian dilakukan **berdasarkan kebutuhan** (bukan terjadwal).

### 9.3 Supplier
- Daftar lengkap akan diinput user. Sample yang tersebut: **Huabao** (supplier teh dari Tiongkok).
- Kontrak jangka panjang: **akan diinput**.
- Supplier alternatif untuk bahan utama: **akan diinput**.
- Syarat pembayaran ke supplier: **tunai semua** (saat ini), tidak ada utang dagang aktif.

### 9.4 Penerimaan Barang
- **Quality check** dilakukan saat barang datang.
- Jika tidak sesuai → **retur**.
- Goods Receipt Note (GRN) **belum diperlukan terpisah** dari faktur pembelian — namun ERP sebaiknya menyediakan dokumen GRN (best practice akuntansi).

---

## 10. Akuntansi & Keuangan

### 10.1 Standar & Konfigurasi
| Item | Nilai |
|---|---|
| Standar akuntansi | **SAK ETAP** |
| Multi-currency | Tidak (Rupiah saja) |
| Frekuensi laporan | **Bulanan** |
| Bahasa laporan | **Tiga bahasa**: Indonesia, Inggris, Mandarin |
| COA | **Sudah ada** (SAK ETAP) — lampiran A |

### 10.2 Bank & Kas
- **Rekening bank**: BCA `7600551986`, IDR, fungsi **Operasional**
- **Petty cash**: plafon **Rp 500.000**, mekanisme pengisian belum baku → ERP perlu modul petty cash dengan plafon + replenishment
- **Rekonsiliasi bank**: bulanan, oleh **Akuntan**
- **Integrasi internet banking / API bank**: **tidak diperlukan** saat ini

### 10.3 Piutang & Utang
- **Tidak ada penjualan kredit** (semua tunai/cashless saat transaksi)
- **Supplier semua tunai** (tidak ada utang dagang dengan jatuh tempo)
- **Aging analysis** belum diperlukan, namun siapkan kerangka untuk pengembangan B2B ke depan

### 10.4 Aset Tetap
| Aset | Catatan |
|---|---|
| Chest Freezer AB-318R | Penyimpanan dingin |
| Toaster Electronic | Dapur |
| Mesin Kasir Imin Swan 2 (DS2-14) | POS terminal |
| Printer Thermal CSP 893 UE | Struk |
| Printer Thermal CSPL78 BT | Label / cup |
| Signage / Logo Aroadri | 6 unit |
| (Rencana) Cash drawer, wastafel, neon box | Pembelian dekat |

- **Metode penyusutan**: **garis lurus**
- **Approval pembelian aset tetap**: **Direktur**

### 10.5 Jenis Laporan Wajib
- ✅ Neraca / Laporan Posisi Keuangan
- ✅ Laporan Laba Rugi
- ✅ Laporan Perubahan Ekuitas
- ✅ Laporan Arus Kas
- ✅ Buku Besar
- ✅ Neraca Saldo
- ✅ Jurnal Umum
- ✅ **Laporan per cabang/lokasi** (dimensi cabang wajib di setiap entry jurnal)

### 10.6 Penerima Laporan
- Manajemen
- Pemegang saham
- Otoritas perpajakan (untuk pelaporan pajak)

> COA lengkap (60+ akun) ada di **Lampiran A**. Akun ini **harus** sudah ter-seed di sistem saat go-live.

---

## 11. Perpajakan

### 11.1 Status & Jenis Pajak
| Pajak | Berlaku |
|---|---|
| **PPN** (Pajak Pertambahan Nilai) | ✅ Iya |
| **PPh Pasal 21** (karyawan) | ✅ Iya |
| **PPh Pasal 23** (jasa) | ✅ Iya |
| **PPh Pasal 25/29** (badan) | ✅ Iya |
| **PPh Final UMKM 0,5%** | ✅ Iya (peraturan PP 5/2022, omzet ≤ Rp 500 juta/tahun) |
| **PB1 / PBJT** (pajak restoran 10%) | ✅ Iya, inclusive |

### 11.2 Tools & Integrasi
- **e-Faktur**: menggunakan **Coretax**
- **Integrasi DJP Online** (e-Filing / e-Billing): **tidak diperlukan saat ini**
- **Administrasi pajak**: **Internal**
- **Omzet > Rp 4,8 M / tahun**: belum diketahui (operasional baru mulai 2026); status PKP sudah aktif

> **Implikasi**: ERP wajib export **rekap PPN keluaran/masukan** dan **PB1/PBJT** dalam format yang mudah re-input ke Coretax (CSV/Excel sesuai struktur Coretax). Tidak perlu API DJP saat ini.

### 11.2b PPh Final UMKM 0,5% (PP 5/2022)

Peraturan terbaru:WP final hanya untuk omzet ≤ Rp 500 juta per tahun. Dasar hukum: PP 5/2022 (perubahan PP 23/2018) + PMK 6/2024.

| Aturan | Detail |
|---|---|
| **Omset threshold** | ≤ Rp 500.000.000 per tahun |
| **Tarif** | 0,5% dari omzet (final, tidak dapat dikreditkan) |
| **Sudah termasuk PPh Pasal 21, 22, 23, 25, 26** | WP tidak perlu hitung PPh lain untuk transaksi ini |
| **Penghitungan** | Per masa pajak (bulanan), berdasarkan brutto omzet |
| **Pembayaran** | Disetor sendiri oleh WP setiap bulan |
| **Laporan** | Masuk ke SPT Masa PPh Final UMKM |

> **Status saat ini** (2026-05-10): Aroadri Tea baru beroperasi sejak 2024, omzet aktualbelum diketahui apakah sudah melebihi Rp 500 juta/tahun. Sistem **wajib** menyediakan engine PPh Final 0,5% (tax rules + calculation + export) agar siap ketika omzet sudah tercatat dan memenuhi threshold. Toggle via `tax_rules` seperti PPN opt-in. Konfirmasi akuntan/tax consultant diperlukan untuk status kepatuhan aktual.

### 11.3 PPN Penjualan — Opt-In (Decided 2026-05-05)

> Keputusan user: "untuk saat ini tidak dikenakan PPN, tapi harusnya ada fitur yang bisa mengakomodasi pengenaan PPN".

**Aturan**:
- **Penjualan retail F&B** (channel `walk_in`, `gofood`, `grabfood`, `shopeefood`) **tidak dikenakan PPN** — sudah dipungut PB1 10% inclusive (lihat §6.5).
- **PPN Masukan (Vat In) dari pembelian** supplier PKP **tetap aktif** — dicatat untuk klaim restitusi / kredit pajak.
- **PPN Keluaran (Vat Out)** untuk transaksi retail **DEFAULT OFF**, namun engine pajak **siap mengakomodasi** aktivasi kelak (mis. saat ekspansi B2B / catering / wholesale).
- Tarif PPN tetap di-seed di tabel `tax_rates`, hanya `applies_to_default=false` untuk channel retail.
- Konfigurasi tarif berlaku via tabel `tax_rules` (per channel / per customer segment / per product category).

**Risiko Pajak Ganda**:
- Jangan pernah mengenakan PB1 + PPN bersamaan ke transaksi yang sama.
- UI memberi warning saat user mencoba aktifkan PPN ke channel yang sudah ber-PB1.

> Detail teknis di SYSTEM-DESIGN §19 dan ADR-0010.

---

## 12. HR & Payroll

### 12.1 Data Karyawan yang Disimpan
- Data pribadi (nama, alamat, KTP, NPWP)
- Riwayat pendidikan
- Kontrak kerja (file)
- BPJS Kesehatan & Ketenagakerjaan
- Rekening gaji
- (Tidak ada karyawan WNA → tidak perlu kebutuhan KITAS/IMTA)

### 12.2 Komponen Payroll
- Gaji pokok
- Tunjangan (termasuk THR)
- Lembur
- Bonus / komisi
- Potongan (BPJS, pajak PPh 21, **potongan keterlambatan**, **potongan absen tanpa alasan**)

### 12.3 Aturan Penggajian
- **Tanggal payroll**: **8 setiap bulan**
- **Metode pembayaran**: **transfer bank**
- **Slip gaji digital**: **wajib** (kirim per email atau download via portal karyawan)

### 12.4 Kehadiran & Cuti
- **Sistem absensi saat ini**: **belum ada** → ERP **wajib menyediakan modul absensi** (mobile-friendly, GPS check-in, atau scan QR di lokasi)
- **Shift kerja**:
  - Shift pagi: **09:30 – 17:30 WIB**
  - Shift siang: **14:30 – 22:30 WIB**
- **Jam operasional toko**: **09:30 – 22:00 WIB** (Mall Malioboro 10:00–22:00)

### 12.5 Aturan Keterlambatan & Absensi (SOP Aroadri Tea 2026-04-06)

> Sumber: dokumen SOP internal tertanggal 06 April 2026. Wajib dipatuhi seluruh karyawan.

| Aturan | Detail |
|---|---|
| **Toleransi** | Maksimal **15 menit** dari jam shift |
| **Jatah telat** | **3× per bulan** per karyawan |
| **Denda telat** | Rp 50.000 per kejadian, setelah jatah 3× habis |
| **Kabari WA** | Wajib kabari grup WhatsApp maksimal **10 menit sebelum** shift dimulai |
| **Absen tanpa kabar** | Potong gaji **Rp 100.000** per kejadian |

**Mekanisme di payroll:**
- Absensi module mencatat setiap check-in → flag "telat" jika lewat jam shift + toleransi 15 menit.
- Jika dalam 1 bulan kalender sudah 3× flag "telat" → sistem otomatis mencatat komponen payroll `DEDUCTION_LATE` Rp 50.000 per kejadian berikutnya.
- Jika absen (tidak check-in sama sekali + tidak ada cuti/izin) → komponen `DEDUCTION_ABSENCE` Rp 100.000.

### 12.6 Waktu Istirahat (SOP)

| Shift | Waktu Break |
|---|---|
| Shift pagi (09:30–17:30) | **13:30 – 15:30 WIB** (1 jam) |
| Shift siang (14:30–22:30) | **16:00–17:00 WIB** atau **setelah 20:30 WIB** |

**Pengecualian** (tidak boleh ambil istirahat pukul 18:00–20:30):
- Shalat (Islam)
- Sakit bawaan (maag)
- Kondisi khusus karyawan perempuan saat menstruasi

### 12.7 Cuti

- Jatah: **1 hari per minggu**.
- Swap dengan karyawan lain: boleh, dengan konfirmasi atasan.
- **Tidak boleh** combine jatah Libur di minggu yang sama tanpa alasan darurat.
- Approval: **direktur**.

### 12.8 Prosedur Membuka Toko (SOP — Shift Pagi)

1. Seduh teh sesuai kebutuhan.
2. Buat creamer jika diperlukan.
3. Bersihkan meja, kursi, lantai toko.
4. Siram tanaman (dalam & luar ruangan).
5. Rapikan & bersihkan area bar, pintu kaca.
6. Bersihkan mesin sesuai petunjuk.
7. Pastikan stock teh sudah diseduh & eggtart dipanggang jika diperlukan.
8. **Input mutasi SO** jika ada penggunaan barang di pagi hari.

### 12.9 Prosedur Menutup Toko (SOP — Shift Malam)

1. Tutup toko tepat **22:00 WIB**.
2. Mulai close order + larutan pembersih ~**21:50 WIB**.
3. Bersihkan mesin, wadah teh, pan oven.
4. Bersihkan lantai dengan cairan pembersih.
5. Rapikan meja, kursi, area kerja, area bar.
6. Pencatatan & laporan keuangan harian.

**Jadwal periodik:**
| Pekerjaan | Frekuensi |
|---|---|
| Area kaca & lantai | Setiap hari |
| Selokan dapur & bar | Setiap **2 hari** |
| Mesin penyeduh teh + selang | Setiap **Minggu malam** |
| Deep clean mesin (single tube + jejak hitam lantai) | Setiap **Minggu malam** |
| Lanjutan deep clean + kaca seluruh toko | Setiap **Senin pagi** |

### 12.10 Standar Produksi (SOP)

**Wajib gunakan alat ukur** (gelas ukur / takaran / timbangan) untuk: teh, es batu, lemon, egg tart, ice sugar syrup, air putih. **Dilarang** memperkirakan secara perasaan.

**Urutan produksi per varian** (detail lengkap di SYSTEM-DESIGN §21.8.4):
- Milk Tea (dingin): shaker → scan mesin → blend es → shake → gelas saji
- Lemon Tea: lemon + es → smash → shaker mesin → syrup → shake → gelas saji
- Fresh Tea: shaker mesin → air putih + syrup + es → shake → gelas saji
- Hot (Milk Tea & Fresh Tea): shaker mesin → blend → stemer → steam 65°C → gelas saji

**Produk error**: wajib perbaikan, cari tahu kesalahan, buat ulang. **Dilarang** menyajikan produk tidak sesuai standar ke pelanggan.

### 12.11 Ketentuan Area & Kebersihan (SOP)

**Area bar**: hanya peralatan bikin minuman + kain lap. **Dilarang**: HP, tumbler pribadi, benda tidak berkaitan.

**Area kerja**: kering, bebas genangan air. **Tidak boleh makan** di area bar (hanya dapur/luar). Wajib bersihkan area bar segera setelah selesai bikin minuman.

**Tampilan karyawan**: wajib pakai apron, jaga kebersihan diri.

### 12.12 Stock Alert (SOP)

| Item | Threshold | Aksi |
|---|---|---|
| Teh (semua varian) | < 300 ml (10:00–20:00) | Wajib buat teh baru (Osmanthus, Glutinous, Bamboo, Roasted Yellow Tea) |
| Creamer | < 1.000 ml | Wajib buat creamer baru |
| Setelah 20:00 | Stock teh habis | Buat **setengah porsi** saja |

### 12.13 Free Tester

- Wajib sediakan **2 varian gratis** (milk tea + lemon tea) setiap hari **10:30–21:30 WIB**.
- Min. **1 orang jaga** saat jam operasional.
- **Staf per shift**: 2–3 orang
- **Jenis cuti**: sakit, izin (**tanpa kuota tahunan** saat ini)
- **Approval cuti**: **Direktur**

### 12.5 Surat Peringatan
- Ada dokumen `SURAT PERINGATAN.pdf` di repo input → ERP perlu modul **disciplinary record** (SP1/SP2/SP3, surat teguran) dengan attachment.

---

## 13. CRM & Loyalty

### 13.1 Data Pelanggan (Member)
- Hanya disimpan untuk **member yang mendaftar** (bukan walk-in anonim)
- Field: nama, nomor telepon, email, tanggal lahir, riwayat pembelian, preferensi produk

### 13.2 Loyalty Program
- **Belum berjalan** — akan direncanakan
- Sistem **harus menyiapkan struktur**: member ID, point/stamp ledger, tier, voucher redemption, expiry

### 13.3 Komunikasi & Kanal
- ❌ Blast WhatsApp / SMS / Email **tidak diperlukan saat ini**
- ✅ Integrasi sosial media: **Instagram, TikTok** — **tanpa API** (manual posting), tidak perlu tarik data otomatis
- ❌ WeChat — tidak

### 13.4 Penanganan Komplain
- Saat ini: **kompensasi produk** (mis. mengganti dengan pudding)
- ERP perlu modul **complaint log + compensation tracking** (siapa, kapan, bentuk kompensasi, biaya yang dibebankan ke "promo expense" atau "operating expense")

---

## 14. Dapur, KDS, Produksi

### 14.1 Mesin Pembuat Teh + KDS Naixer
- Toko menggunakan **mesin pembuat teh otomatis dengan KDS bawaan dari Tiongkok** bermerek **Naixer**.
- KDS sudah **terintegrasi dengan POS lama (restosuite.ai)** — perlu validasi apakah Naixer punya API/HTTP webhook untuk integrasi dengan ERP baru.
- Kapasitas mesin teh per jam/hari: **belum diketahui** (perlu ukur lapangan).
- Naixer menyimpan: production record, material usage record, cleaning record, fault record, calibration record, peristaltic pump usage record.
- Material yang dikenal di Naixer: Jasmine Green Tea, Osmanthus Oolong, Buckwheat Biluochun, Ceylon Black, Creamer, Roasted Fragrant Yellow, Bamboo Oolong, Glutinous Fragrant, Basic Syrup.

### 14.2 SLA Penyajian
- **Teh ready ≤ 2 menit** (ideal); maksimum 15 menit jika ada antrean.

### 14.3 Alur Order
1. Pelanggan memesan di kasir.
2. Kasir input ke POS → ERP.
3. Sistem **cetak label gelas** (dengan **QR code unik per pesanan**) **dan struk** (kasir + dapur).
4. Karyawan dapur **scan QR code** di KDS Naixer.
5. Mesin Naixer menyajikan **resep yang sesuai**.
6. Disajikan ke pelanggan.

### 14.4 Format QR Code untuk Naixer (Diperbarui 2026-05-05)

> **Keputusan integrasi**: integrasi POS kita ↔ KDS Naixer **HANYA via QR code di label cup**. Tidak ada koneksi API/jaringan langsung ke mesin Naixer. Lihat ADR-0007 untuk detail teknis.

#### Dua format yang dikenal

**Format A — Dokumentasi Resmi Naixer (pipe + comma)**:
```
[ID_Pesanan]|[Kode_Produk]|[Spec_1],[Spec_2],[Spec_3]
```
Contoh: `ORD0001|P0003|A001,M002,T001`
(Spec = ukuran gelas, tingkat es, tingkat gula — kode kustom dari Naixer.)

**Format B — Lapangan / Field-Tested (dash, tanpa ID pesanan)**:
```
[Kode_Produk]-[Spec_1]-[Spec_2]-[Spec_3]
```
Contoh: `T003-C01-S02-W01`

Hasil pengujian langsung di toko Aroadri Malioboro: **Format B berhasil dibaca mesin Naixer** (label printer Comson + scan di KDS Naixer).

#### Aturan Implementasi
1. **Default generator**: Format B (dash, terbukti bekerja di lapangan).
2. **Fleksibilitas**: generator harus **pluggable** — strategi format dapat diubah (Format A vs Format B) via konfigurasi tanpa edit source. Antisipasi bila pihak Naixer mewajibkan kembali Format A di kemudian hari.
3. **Mapping master code**: butuh tabel pemetaan dari **produk POS** ke **kode produk Naixer** (mis. "Glutinous Fragrant Milk Tea" → `T003`), dan **modifier POS** ke **kode spec Naixer** (mis. ukuran=Large → `C01`, ice=less → `S02`, sugar=less → `W01`). Daftar kode lengkap **akan diberikan oleh vendor Naixer** (sedang diminta).
4. **QR adalah satu-satunya antarmuka**: tidak perlu polling/API ke Naixer. Naixer dianggap "kotak hitam" (opaque box) yang hanya membaca QR.
5. **Label cup** tetap mencetak **teks tambahan** untuk staf dan pelanggan: "Pickup #N | <Nama Produk> (<Ukuran>) | <ringkasan modifier>" — independen dari QR.
6. **Tracking internal**: kita tetap punya `kds_qr_token` tabel `sales_order_lines` untuk mapping balik QR-string → line_id (dipakai untuk refund / replay / audit).

#### Master Mapping Tables (akan diisi setelah vendor kirim daftar)
| Tabel | Kolom Inti |
|---|---|
| `naixer_product_codes` | `product_id`, `naixer_code` (e.g., `T003`) |
| `naixer_modifier_codes` | `modifier_option_id`, `naixer_code` (e.g., `C01` untuk Large) |
| `naixer_qr_format_config` | `location_id`, `format` (`dash` \| `pipe`), `parameter_order[]` |

### 14.5 Pengelolaan Waste
- **Pemisahan sampah cup vs teh**, namun **belum ada pencatatan**.
- ERP perlu modul **waste log** (tanggal, jenis, jumlah, alasan) → otomatis link ke jurnal "loss / write-off".

### 14.6 Display Order untuk Pelanggan (Customer-Facing Display)
- **Fitur khusus yang diminta**: layar di depan kasir yang menampilkan **daftar pesanan pelanggan** (status: queued, in progress, ready). Mirip "now serving" board.

---

## 15. Multi-Lokasi & Cabang

### 15.1 Lokasi Operasional
| # | Lokasi | Fungsi | Status |
|---|---|---|---|
| 1 | **Aroadri Tea Malioboro Mall** | Toko | Aktif |
| 2 | **Aroadri Tea Plaza Malioboro** | Toko | Aktif |
| 3 | Kantor Yogyakarta | Internal | Aktif untuk administrasi/accounting |
| 4 | Kantor Jakarta | Internal | Aktif untuk administrasi/accounting |

Alamat outlet:
- **Aroadri Tea Malioboro Mall**: Malioboro Mall, Jl. Mataram No. 31, Suryatmajan, Danurejan, Kota Yogyakarta, Daerah Istimewa Yogyakarta 55213.
- **Aroadri Tea Plaza Malioboro**: Plaza Malioboro, Jl. Malioboro No. 52-58, Suryatmajan, Danurejan, Kota Yogyakarta, Daerah Istimewa Yogyakarta 55213.

Website publik hanya boleh menampilkan **outlet aktif**. Kantor Yogyakarta/Jakarta boleh dipakai di ERP internal dan COA, tetapi tidak boleh muncul di halaman publik.

### 15.2 Operasional Multi-Lokasi
- **Petty cash per lokasi**: ✅ ya
- **Pembelian terpusat**: ✅ ya (dilakukan oleh Direktur, dikirim ke lokasi)
- **Laporan keuangan per cabang**: ✅ wajib
- **Harga jual antar lokasi**: bisa **berbeda**
- **Transfer stok antar lokasi**: ✅ bisa

> **Implikasi schema**: setiap dokumen transaksional (sales, purchase, journal entry, stock movement) **wajib** menyimpan dimensi `location_id`. Skema akun mungkin perlu sub-ledger per lokasi atau dimensi tambahan.

### 15.3 Profil Lokasi: Toko Malioboro (Lapangan)
- **Layout**: kasir di tengah, kapasitas **40 kursi**, tidak ada area khusus dine-in vs takeaway.
- **Jam operasional**: 10:00–22:00 WIB.
- **Mesin kasir**: 1 unit (Imin Swan 2).
- **Listrik**: 11 titik colokan, pakai roll, **tidak ada UPS** (rekomendasi: tambah UPS untuk POS).
- **Internet**: Indibiz 50 Mbps — **kadang putus**, **belum ada backup link**.
- **Stock count harian**: input manual ke spreadsheet (termasuk barang non-bahan baku seperti spons, sabun cuci piring).
- **Prosedur opening/closing**: cuci mesin teh + bersih-bersih toko. **Belum ada SOP serah-terima shift formal** → ERP perlu modul **shift handover** (kas opening, kas closing, selisih, signature).

---

## 16. Laporan & Dashboard

### 16.1 Laporan Penjualan
- ✅ Penjualan harian per kasir
- ✅ Penjualan per produk / kategori
- ✅ Penjualan per jam (peak hour analysis)
- ✅ Penjualan per saluran (dine-in, takeaway, delivery)
- ✅ Penjualan per metode pembayaran
- ✅ Best seller / worst seller

### 16.2 Laporan Inventory
- ✅ Stok harian
- ✅ Pergerakan stok (masuk / keluar)
- ✅ Stok mendekati kadaluarsa
- ✅ Nilai persediaan
- ✅ Variance report (stok fisik vs sistem)

### 16.3 Dashboard Manajemen (Default Widget)
- Total penjualan hari ini
- Jumlah transaksi
- Average transaction value (AOV)
- Produk terlaris
- Stok rendah
- Saldo kas / bank
- Profit & Loss ringkas
- Grafik tren penjualan

### 16.4 Notifikasi / Alert Otomatis
- ✅ Stok rendah
- ✅ Transaksi bernilai besar (threshold dapat di-set)
- ❌ Void / pembatalan (tidak diminta auto-alert)
- ❌ Target penjualan tercapai (belum ada target)

### 16.5 Akses Dashboard per Peran
Daftar lengkap belum diberikan; sistem **wajib** menyediakan **per-role widget visibility** (RBAC level field).

---

## 17. Infrastruktur & Teknologi

### 17.1 Hardware Saat Ini
| Perangkat | Status |
|---|---|
| Mesin kasir Imin Swan 2 | ✅ ada |
| Printer thermal CSP 893 UE (struk) | ✅ ada |
| Printer thermal CSPL78 BT (label cup) | ✅ ada |
| Tablet | ✅ ada |
| Timbangan digital | ✅ ada |
| CCTV | ✅ ada |
| Router / modem internet | ✅ ada (Indibiz 50 Mbps) |
| Cash drawer | ❌ belum (rencana beli) |
| Komputer / laptop dedicated | ❌ tidak |
| Barcode scanner | ❌ tidak |
| UPS | ❌ tidak |

### 17.2 Software Saat Ini
- **POS**: **restosuite.ai** (akan diganti — banyak bug, terbatas)
- **Akuntansi**: **Excel** (akan diganti / terintegrasi)
- **WhatsApp Business**: aktif (komunikasi)
- **Coretax**: pakai (untuk e-Faktur)

### 17.3 Sistem yang Harus Diintegrasikan
- **Tidak ada** sistem eksternal yang wajib diintegrasikan.
- Optional / future:
  - **Naixer KDS** (kalau ada API → integrasikan resep auto)
  - **Coretax** (export CSV untuk re-input)

### 17.4 Persyaratan Deployment
| Kriteria | Nilai |
|---|---|
| Akses mobile | ✅ wajib |
| Deployment | ☁️ **Cloud** |
| Teknologi | **Web-based + PWA** |
| Spek server | **1 vCPU / 2 GB RAM / 60 GB Disk** (upgrade dari 1 GB pada 2026-05-05; tetap ketat — Odoo/ERPNext minimum 4 GB) |
| Domain root | `aroadritea.com` |
| Subdomain ERP | `erp.aroadritea.com` (private — login required) |
| Subdomain admin (opsional) | `admin.aroadritea.com` *(jika dipisah dari ERP)* |

**Pembagian domain (keputusan user 2026-05-05):**

| Surface | URL | Audiens | Otentikasi |
|---|---|---|---|
| **Website publik + CMS-rendered marketing** | `aroadritea.com` | publik / pelanggan | tidak (kecuali halaman akun member) |
| **Pendaftaran membership online** | `aroadritea.com/member/...` | calon member | tidak (signup); login (akun member) |
| **Sistem ERP** | `erp.aroadritea.com` | staf, manajemen, direksi | wajib (RBAC) |
| **MCP server** | `erp.aroadritea.com/mcp` atau subdomain `mcp.erp.aroadritea.com` | AI lokal via token | API token |
| **Customer-facing display** (di toko) | `display.aroadritea.com/<location>` atau `erp.aroadritea.com/display/<location>` | layar antrean toko | token lokasi |

> Detail teknis arsitektur pemisahan ada di **`SYSTEM-DESIGN.md` §6 (Repository Layout)** dan **§31 (Public Website + CMS)**.

> **Catatan kritis arsitektur**: dengan RAM 1 GB, opsi seperti Odoo / ERPNext **tidak realistis** (minimum 4 GB). Wajib menggunakan stack ringan dan pertimbangkan **offload database** ke layanan managed gratis (Neon, Supabase, PlanetScale free tier) untuk membebaskan RAM di compute server.

### 17.5 Multibahasa
- Sistem **wajib multibahasa sejak awal**: **Indonesia, Inggris, Mandarin (Simplified)**.
- Strategi i18n: kunci translasi (mis. `i18next` / `next-intl` / `react-intl`) untuk UI; kolom `name_id`, `name_en`, `name_zh` untuk data master (produk, kategori, modifier).
- Laporan keuangan harus tersedia dalam tiga bahasa.

---

## 18. Keamanan, Audit, Backup

### 18.1 Kepatuhan Data
- **UU PDP** (Perlindungan Data Pribadi) berlaku — wajib **enkripsi data pribadi** saat at-rest dan in-transit.

### 18.2 Keamanan Level Militar (ditambahkan 2026-05-09)
User mensyaratkan **keamanan setingkat militer** (non-2FA) dengan komponen berikut:

| Aspek | Persyaratan |
|---|---|
| **Enkripsi Data-at-Rest** | Semua data sensitif (KTP, NPWP, nomor HP, email, kata sandi, session token) dienkripsi menggunakan AES-256-GCM sebelum disimpan di database. Enkripsi dilakukan di level aplikasi (bukan rely pada DB encryption saja). |
| **Enkripsi Data-in-Transit** | HTTPS/TLS 1.3 wajib untuk semua koneksi. HSTS header dengan max-age ≥ 1 tahun. Tidak ada fallback ke HTTP. |
| **Brute Force Protection** | Rate limiting login attempt: maksimal 5 percobaan gagal dalam 15 menit per IP + per akun. Setelah exceed → blokir sementara 15 menit + notifikasi ke user via email. Percobaan gagal dicatat di audit log. |
| **CAPTCHA / Anti-Bot** | Cloudflare Turnstile (atau hCaptcha fallback) di halaman: login, signup member, form publik. |
| **Audit Trail Imutable** | Setiap mutasi data tercatat di `audit_log` append-only. Tidak ada delete/update terhadap audit log. |
| **Security Audit & Penetration Testing** | Dilakukan minimal **setiap 6 bulan** oleh pihak ketiga independen. Laporan audit disimpan dan ditindaklanjuti dalam 30 hari. |
| **Incident Response Plan** | Prosedur handling jika terjadi breach: isolat sistem, investigate, notify affected users (sesuai UU PDP max 3×24 jam), remediate. |
| **Security Headers** | CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy di semua halaman ERP. |
| **Secrets Management** | API keys, DB credentials, JWT secrets tidak pernah di-commit. Menggunakan environment variables atau secret manager (Vault / Cloudflare Secrets). Rotation minimal 90 hari. |

> **Catatan**: 2FA **tidak wajib** per request user (2026-05-09). Namun sistem **wajib menyediakan opsi 2FA** bagi user yang ingin mengaktifkannya secara sukarela.

### 18.2 Backup
- **Frekuensi**: **harian** (otomatis)
- **Retensi**: **mingguan** (rolling 7 hari)
- Lokasi backup: di luar server utama (off-site / cloud storage)

### 18.3 Audit Trail
- ✅ **Wajib**: catat siapa mengubah data apa & kapan (user, action, entity, timestamp, before/after).
- Audit trail **harus dapat dibaca oleh AI lokal** melalui **MCP (Model Context Protocol) server** (lihat 18.5).

### 18.4 Otentikasi
- **2FA**: **tidak diperlukan saat ini** (boleh disediakan sebagai opsi)
- Login **end-to-end** secure (HTTPS, password hashed, session token)

### 18.5 MCP Server (Fitur Khusus)
> Permintaan eksplisit dari user — fitur diferensiasi.

- ERP **wajib menyediakan MCP server** sehingga AI lokal (Gemini CLI, Claude Code, Google Antigravity, dll.) dapat:
  - Membantu **input/edit data**
  - Membantu **perekrutan** (HR pipeline)
  - **Mengaudit** data (cross-check audit trail)
- AI tidak menggunakan API LLM provider; **AI lokal via MCP** mengakses ERP via tool calls (read/write resources, read audit log, query laporan).
- Tools MCP minimum: `list_products`, `create_purchase_order`, `read_audit_log`, `query_journal`, `create_employee`, `read_inventory`, dll.
- Authentikasi MCP: per-user token dengan scope (RBAC sama dengan UI).

### 18.6 Skalabilitas & Fleksibilitas Kustomisasi
- User mensyaratkan: **menambah peran, izin, modul, field tanpa edit source code**.
- Strategi:
  - **Custom field engine** (definisi field via UI → tersimpan di tabel `entity_extension`)
  - **Permission matrix database-driven** (bukan hardcoded role middleware)
  - **Workflow / approval rules database-driven**
  - Plugin system / module toggle per tenant

---

## 19. Regulasi & Kepatuhan

| Regulasi | Berlaku |
|---|---|
| BPOM | ✅ — sistem harus dapat menyimpan nomor & masa berlaku sertifikat |
| Sertifikasi Halal | ✅ — sda |
| Standar keamanan pangan | ✅ — checklist sanitasi (modul kitchen) |
| Perda pajak restoran | ✅ — **PB1/PBJT 10%** |
| UU PDP | ✅ — enkripsi data pelanggan & karyawan |

### Pelaporan Tambahan
- Hanya ke **manajemen + pemegang saham** + **otoritas perpajakan**. Tidak ada pelaporan ke regulator lain saat ini.

### Data Retention
- Backup harian, retensi mingguan (untuk recovery).
- Data transaksi **tetap disimpan permanen** di database utama (tidak di-purge) — required untuk audit pajak (umumnya 10 tahun untuk wajib pajak Indonesia).

---

## 20. Roadmap, Prioritas Modul, Timeline

### 20.1 Target Go-Live
- **Secepatnya**, tidak terikat event tertentu.
- Bersedia **implementasi bertahap** (phase by phase).

### 20.2 Prioritas Modul (Skala 1–9, 1 = paling urgent)
| Prio | Modul |
|---|---|
| **1** | **Accounting (Akuntansi & Keuangan)** |
| **2** | **Reporting & Dashboard** |
| **3** | **Tax (Perpajakan)** |
| **4** | **POS (Point of Sale / Kasir)** |
| **5** | **Inventory (Stok & Gudang)** |
| **6** | **Purchasing (Pembelian)** |
| **7** | **Kitchen / Production** |
| **8** | **HR & Payroll** |
| **9** | **CRM (Customer Management)** |

> **Catatan strategi**: meskipun POS adalah "wajah" sistem F&B, prioritas Direktur adalah **kontrol keuangan & pajak terlebih dulu**. Phase 1 fokus pondasi akuntansi (COA + Jurnal + GL + AP/AR sederhana + Laporan), karena modul lain pada akhirnya bermuara ke akuntansi.

### 20.3 Phasing yang Disarankan (draft, perlu konfirmasi user)
| Phase | Modul Inti | Outcome |
|---|---|---|
| **Phase 1** | Accounting + Reporting + Tax + Multi-lokasi + i18n + IAM/Permission engine | Pembukuan & laporan SAK ETAP siap, ekspor pajak siap |
| **Phase 2** | POS + Inventory + BOM + Purchasing | Auto-deduct stok dari sales, GRN, supplier ledger |
| **Phase 3** | Kitchen / KDS + Customer-facing display + (opt) integrasi Naixer | Operasional toko full-loop |
| **Phase 4** | HR & Payroll + Absensi + Slip gaji digital + Surat Peringatan | Operasional SDM full |
| **Phase 5** | **Public Website + CMS + Member registration** + CRM + Loyalty + Komplain | Engagement pelanggan + akuisisi member online |
| **Phase 6** | MCP Server (perluasan) + Custom field engine + Workflow engine | Diferensiasi & ekstensibilitas AI |

> **Catatan**: MCP server skeleton + IAM/permission engine **harus** ada sejak Phase 1 (foundation), perluasan tools per modul mengikuti phase masing-masing. Public website + CMS dan registrasi member online ditarik ke Phase 5 (bersamaan dengan CRM / Loyalty) karena bergantung pada data master produk + lokasi yang sudah stabil dari Phase 2.

### 20.4 Budget
- Hanya: **biaya server, domain, gaji developer bulanan** (developer = user sendiri, sudah termasuk maintenance).
- **Tidak ada** budget terpisah untuk pelatihan pengguna → ERP wajib menyediakan **tutorial in-app yang dapat dipanggil kapan saja**.

---

## 21. Pain Points & Fitur Khusus

### 21.1 Pain Points Saat Ini
1. **Internet tidak stabil, kadang terputus** → ERP **wajib** memiliki:
   - **Mode offline** untuk POS (queue transaksi → sync saat online)
   - PWA dengan service worker + IndexedDB
   - Idempotency key untuk re-submit aman
2. **Sistem POS lama (restosuite.ai) ada bug** → quality bar untuk sistem baru: stabilitas tinggi, error monitoring (Sentry-like).
3. **Belum ada SOP serah terima shift** → ERP membantu standardisasi via modul shift handover.
4. **Tidak ada UPS** → bukan masalah ERP, tapi POS harus auto-recover bila listrik padam (transaksi tidak hilang).

### 21.2 Fitur Khusus yang Diminta (Non-Standar)
1. **Customer-facing display** di kasir: daftar pesanan + status (queued / making / ready).
2. **MCP Server** untuk AI lokal (audit, input/edit data, perekrutan).
3. **Audit-able by AI** — semua perubahan terlacak & dapat di-query oleh AI.
4. **Multibahasa sejak awal** (ID/EN/ZH).
5. **Skalabilitas + fleksibilitas kustomisasi tanpa edit source code** → custom fields, permission DB-driven, workflow DB-driven.
6. **Tutorial in-app** yang dapat dipanggil kapan saja (onboarding + reference).
7. **Login end-to-end** (secure stack).
8. **Ekspor Excel (XLSX) di Semua Modul** — setiap modul yang menangani data harus menyediakan tombol/tindakan ekspor ke format XLSX. Lihat §21.2a.
9. **Halaman Dokumentasi & Petunjuk Penggunaan** — halaman komprehensif yang mencakup tutorial detail untuk semua use case, navigasi daftar isi, dan fitur search. Lihat §21.2b.

#### §21.2a — Ekspor Excel (XLSX) di Semua Modul

Setiap modul yang mengelola data **wajib** menyediakan fitur ekspor ke format XLSX. Ketentuan:

| Modul | Data yang Diekspor |
|---|---|
| Accounting | Chart of Accounts, Jurnal Umum, Buku Besar, Neraca Saldo |
| Reporting | Trial Balance, Balance Sheet, Profit & Loss, Cash Flow, Laporan Penjualan per Produk/Kasir/Channel |
| Tax | Daftar Tarif Pajak, Rekap PPN Masukan/Keluaran, Ringkasan PB1 |
| POS | Riwayat Transaksi, Shift Harian, Refund |
| Inventory | Daftar Produk, Stok per Lokasi, Pergerakan Stok, BOM |
| Purchasing | Purchase Orders, Goods Receipt Notes, Supplier |
| HR | Daftar Karyawan, Kontrak, Absensi |
| Payroll | Slip Gaji, Rekap Payroll per Bulan |
| CRM | Daftar Member, Riwayat Poin, Komplain |

**Spesifikasi Teknis Ekspor XLSX:**
- Library: **ExcelJS** (sudah di-stack — lihat SYSTEM-DESIGN §5).
- Format file: `.xlsx` (Excel 2007+).
- Styling: header baris berwarna (brand-red #D6262E), freeze pane di baris pertama, auto-column width, number format IDR untuk kolom uang.
- Bahasa: sesuai locale user saat ini (ID/EN/ZH).
- Filter: user dapat memfilter data sebelum ekspor (tanggal, lokasi, kategori, dll).
- Paginasi: ekspor seluruh data yang ter-filter, tidak hanya halaman saat ini.
- Ukuran maksimal: 100.000 baris per file. Jika lebih → pisah ke beberapa file dengan indicator part (part 1 of 3).

**Spesifikasi UI Ekspor:**
- Tombol ekspor di setiap halaman daftar/tabel.
- Pilihan format: XLSX (default), CSV (opsional).
- Opsi pilih kolom yang di-export.
- Progress indicator untuk export besar (> 10.000 baris).

#### §21.2b — Halaman Dokumentasi & Petunjuk Penggunaan

Sistem **wajib** menyediakan halaman dokumentasi komprehensif untuk semua fitur ERP. Ketentuan:

**Struktur Halaman (`apps/web/(dash)/docs/`):**

| Fitur | Lokasi | Deskripsi |
|---|---|---|
| Landing dokumentasi | `/docs` | Halaman utama dengan TOC di kiri, search bar, versi ERP |
| Modul Accounting | `/docs/accounting/*` | Penggunaan COA, cara posting jurnal, menutup periode |
| Modul Reporting | `/docs/reporting/*` | Cara membaca laporan, filter, export |
| Modul Tax | `/docs/tax/*` | Setup pajak, generate laporan Coretax |
| Modul POS | `/docs/pos/*` | Cara transaksi, refund, shift open/close, demo mode |
| Modul Inventory | `/docs/inventory/*` | Setup produk, BOM, stock opname |
| Modul Purchasing | `/docs/purchasing/*` | PO workflow, GRN, retur |
| Modul HR | `/docs/hr/*` | Onboarding karyawan, absensi |
| Modul Payroll | `/docs/payroll/*` | Setup komponen, jalankan payroll |
| Modul CRM | `/docs/crm/*` | Manajemen member, komplain |
| Panduan Umum | `/docs/guides/*` | Login, navigasi, keyboard shortcut, FAQ |
| Glosarium | `/docs/glossary` | Istilah teknis ERP dalam ID/EN/ZH |
| Changelog | `/docs/changelog` | Riwayat update sistem |

**Fitur Halaman Dokumentasi:**

1. **Navigasi Daftar Isi (TOC) di Kiri**
   - Sidebar tetap (sticky) saat scroll.
   - Hierarki: Modul → Section → Sub-section (3 level).
   - Indikator aktif (highlight) saat scroll ke section.
   - Collapse/expand per modul.

2. **Fitur Search**
   - Search bar di bagian atas (cmd+K / ctrl+K shortcut).
   - Full-text search pada seluruh konten dokumentasi.
   - Hasil search menampilkan snippet + highlight kata kunci.
   - Keyboard navigation (↑↓ untuk navigasi hasil, Enter untuk pilih).

3. **Konten Dokumentasi**
   - Format: Markdown dengan custom components.
   - Setiap panduan mencakup:
     - **Tujuan**: apa yang dicapai.
     - **Prasyarat**: permission/role yang diperlukan.
     - **Langkah-langkah**: step-by-step dengan screenshot/ilustrasi.
     - **Tips & Troubleshooting**: gotcha umum.
     - **Video tutorial** (opsional, embed YouTube/Loom).
   - Multi-bahasa: konten tersedia dalam ID/EN/ZH (switcher di header).
   - Breadcrumb di atas: `Docs / Accounting / Posting Jurnal Manual`.

4. **Petunjuk Use Case Komprehensif**
   - **Onboarding Kasir Baru**: langkah dari login → transaksi pertama → refund → demo mode.
   - **Setup Produk Baru**: dari login → tambah produk → varian → modifier → BOM.
   - **Tutup Bulan**: posting jurnal penyesuaian → generate laporan → tutup periode.
   - **Export Laporan ke Coretax**: filter data → export → format yang dibutuhkan DJP.
   - **Training Demo Mode**: cara mengaktifkan, simulasi transaksi, reset.

5. **Konsistensi dengan Sistem**
   - Jika ada perubahan UI di modul, dokumentasi terkait harus di-update.
   - Link ke modul terkait (cross-link antar halaman docs).
   - Last updated timestamp per halaman.

> **Implikasi teknis**: dokumentasi disimpan di database (tabel `cms_docs`) agar dapat di-manage tanpa edit kode. Alternatif: static MDX files dalam repository (lebih simple, tapi perlu redeploy untuk update). **Direkomendasikan: CMS-driven** (`cms_docs`) dengan markdown editor untuk fleksibilitas.

### 21.3 Laporan Harian (Summary & Metode Pembayaran)

Setiap akhir shift/hari, kasir dan kepala toko memerlukan **laporan ringkasan penjualan harian** yang memuat:

| Komponen | Detail |
|---|---|
| **Periode** | Tanggal mulai – selesai (1 hari atau rentang自定义) |
| **Total Penjualan** | Gross, net (setelah diskon), pajak |
| **Rincian per Metode Bayar** | Tunai, QRIS, Flazz, Debit, Kredit, GoFood, GrabFood, ShopeeFood |
| **Komisi Delivery** | 20% × gross dari GoFood/GrabFood/ShopeeFood (otomatis di-hitung) |
| **Net Revenue** | Pendapatan bersih setelah komisi delivery |
| **Refund Total** | Jumlah dan jumlah transaksi refund |
| **Shift Info** | Shift yang dibuka/ditutup, kasir, variance kas |
| **Top Products** | Produk 10 terlaris |

**Spesifikasi UI:**
- Page: `apps/web/(dash)/reporting/daily-summary/`
- Filter: tanggal, lokasi, kasir (opsional).
- Tabel rincian metode bayar (kolom: metode, jumlah transaksi, total nominal).
- Grafik donut untuk breakdown metode bayar.
- **Cetak / Export**: PDF + XLSX.

#### §21.3b — Ekspor Excel Omzet Harian (Khusus Pajak / Coretax)

> Fitur ini diminta user pada 2026-05-12. Dipicu oleh kebutuhan pelaporan pajak harian ke Coretax (DJPh online) yang memerlukan **omzet neto setelah PB1 10% dipisahkan**, dengan kemungkinan **penyesuaian manual** jika ada perbedaan antara omzet akuntansi dan omzet fiskal (mis. koreksi harga, retur yang belum dicatat, transaksi batal, dll.).

**Tujuan:**
- Menyediakan file Excel yang langsung bisa digunakan untuk **isian SPT Masa PPh Final UMKM (PP 5/2022)** atau **rekon Coretax**.
- Kolom omzet di-export **sudah dikurangi PB1 10%** (karena PB1 bersifat *inclusive*, omzet fiskal harus di-backward dari gross).
- User bisa **edit penyesuaian manual** langsung di file Excel sebelum submit.

**Rumus Perhitungan:**
```
PB1_rate = 10%
PB1_exclusive_omzet  = gross_sales ÷ (1 + PB1_rate/100)
                    = gross_sales ÷ 1.10
PB1_tax_amount      = gross_sales − PB1_exclusive_omzet
Net taxable omzet   = PB1_exclusive_omzet + adjustments
```
Di mana `adjustments` = penyesuaian manual user (bisa negatif/positif), contoh:
- Penyesuaian harga karena retur yang belum dicatat (−)
- Koreksi transaksi batal (+)
- Potongan harga spesial yang belum tercatat (−)

**Spesifikasi Excel:**

| Kolom | Deskripsi | Contoh |
|---|---|---|
| A | Tanggal | 2026-05-12 |
| B | Lokasi | Malioboro |
| C | Gross Sales (IDR) | 5.500.000 |
| D | PB1 10% (IDR) | 500.000 |
| E | **Omzet Neto (IDR)** = C − D | 5.000.000 |
| F | **Penyesuaian (IDR)** | −50.000 |
| G | **Omzet Fiskal (IDR)** = E + F | 4.950.000 |
| H | Keterangan penyesuaian | Retur 2x milk tea |

**Perbedaan Omzet Akuntansi vs Omzet Fiskal:**
- **Omzet Akuntansi** = `PB1_exclusive_omzet` dari sistem (otomatis).
- **Omzet Fiskal** = `PB1_exclusive_omzet` + `adjustments` (user-inputtable).
- Kolom F dan H adalah **editable oleh user** sebelum ekspor — sistem menyimpan nilai terakhir sebagai *draft* per lokasi per tanggal.
- Draft penyesuaian disimpan di tabel `daily_revenue_adjustments (location_id, date, adjustment_amount, adjustment_note, created_by, updated_at)` agar tidak hilang saat refresh.

**Spesifikasi UI:**
- Page: `apps/web/(dash)/reporting/omzet-harian/`
- Filter: tanggal (default: hari ini), lokasi.
- Tabel dengan kolom A–H di atas.
- Edit inline untuk kolom F (Penyesuaian) dan H (Keterangan) — double-click untuk edit.
- Tombol: **Simpan Penyesuaian**, **Export Excel (XLSX)**.
- Warning banner jika ada penyesuaian ≠ 0: "⚠️ Omzet fiskal berbeda dari omzet akuntansi sebesar Rp X."

**Spesifikasi Teknis:**
- Library: ExcelJS (sudah di-stack).
- File name: `omzet-harian-{YYYY-MM-DD}-{location}.xlsx`.
- Styling: header baris berwarna brand-red (#D6262E), freeze pane di A1, number format IDR tanpa desimal.
- Sheet name: "Omzet Harian".

**Spesifikasi MCP Tool:**
```ts
reporting.get_daily_omzet_export
input: { location_id, date, locale }
output: { gross_sales, pb1_amount, net_omzet, adjustment_amount, adjustment_note, fiscal_omzet, last_modified }
```
Tool ini membaca data dari `getDailySummary` + penyesuaian dari `daily_revenue_adjustments`.

**Catatan Penting (UU Perpajakan):**
- PB1/PBJT 10% bersifat *inclusive* — harga yang dibayar pelanggan SUDAH termasuk PB1.
- Untuk pelaporan pajak, omzet yang menjadi dasar pengenaan PPh Final 0,5% (PP 5/2022) adalah omzet **setelah dikurangi PB1**.
- Koreksi fiskal (penyesuaian) harus didukung bukti dokumen yang benar.
- Konsultasi dengan akuntan/tax consultant diperlukan untuk kasus-kasus khusus.

### 21.4 Laporan Penjualan Per Jam (Hourly Sales)

Laporan ini ditujukan untuk analisis pola penjualan dan perencanaan staffing:

| Komponen | Detail |
|---|---|
| **Periode** | Tanggal, rentang tanggal, atau weekly |
| **Breakdown per Jam** | 10:00–11:00, 11:00–12:00, dst. — 10:00–22:00 (12 slot) |
| **Rincian Produk Terjual** | Per jam: nama produk, qty, nominal |
| **Pengelompokan (Group By)** | User memilih grouping: |
| | • **Varian** (Fresh Milk Tea / Fresh Tea / Lemon Fresh Tea / Snow Cap) |
| | • **Ukuran** (Regular / Large) |
| | • **Kategori** (Teh / Dessert / Topping / Packaging) |
| | • **Channel** (Walk-in / GoFood / GrabFood / ShopeeFood) |
| | • **Kombinasi** (Varian + Ukuran, dll.) |
| **Summary** | Total per jam, peak hour (jam tersibuk), AOV per jam |

**Spesifikasi UI:**
- Page: `apps/web/(dash)/reporting/hourly-sales/`
- Filter: tanggal, lokasi, group by (multi-select dropdown).
- Tabel: jam | group (e.g., Fresh Milk Tea) | item | qty | nominal.
- Heatmap visual: jam (x-axis) vs kategori produk (y-axis), warna = nominal.
- Export XLSX.

### 21.5 Petty Cash — Fitur Kasir & Kepala Toko

Setiap kasir perlu dapat **melihat saldo petty cash** yang tersedia di lokasinya:

| Fitur | Detail |
|---|---|
| **Lihat Saldo** | Kasir & kepala toko dapat melihat saldo petty cash saat ini per lokasi. Tabel: lokasi, saldo petty cash, batas maximum, replenish date. |
| **Top-up Petty Cash** | Kepala toko bisa request replenish. Workflow: request → approval director → top-up → dokumentasi. |
| **History Petty Cash** | Daftar semua transaksi petty cash (top-up, penggunaan kecil) dengan tanggal, jumlah, keterangan, penanggung jawab. |
| **Warning** | Jika saldo < 20% dari batas, tampilkan warning di dashboard kepala toko. |

**Implementasi:**
- Tabel: `petty_cash_accounts (location_id, balance, max_limit, last_replenish_at)`.
- Tabel: `petty_cash_transactions (location_id, amount, kind: 'topup'|'expense', description, created_by)`.
- Role permission: `pettycash.read`, `pettycash.topup` (director).

### 21.6 Reimbursement & Pengajuan Dana

Mekanisme reimbursement untuk pengeluaran di luar petty cash:

| Fitur | Detail |
|---|---|
| **Pengajuan** | Karyawan/kepala toko bisa ajukan dana (receipt/foto bukti). Field: jumlah, keterangan, kategori (operasional/supplies/emergency), tanggal, lokasi, lampiran foto (upload ke R2). |
| **Approval** | Semua pengajuan → approval direktur. |
| **Status Tracking** | Draft → Submitted → Approved → Disbursed → Rejected. |
| **Pengingat** | Jika belum di-approve 48 jam, auto-escalation notification ke director. |
| **Pelaporan** | Laporan reimbursement per bulan (jumlah, kategori, approval time). |

**Schema:**
```
reimbursement_requests (id, requester_id, location_id, amount, category, description, attachment_url, status, approved_by, approved_at, disbursed_at)
```
**Workflow:** standard DB-driven workflow (§18 SD).

### 21.7 Stock Opname & Variansi (Anti-Loss Mechanism)

> **Pain point eksplisit**: "nyetok tisu 3, pas stock opname tinggal 2 dan gatau ke mana". Solution: perbandingan stok awal vs akhir + reason logging + audit trail.

Sistem harus menyediakan mekanisme stock opname lengkap:

#### 21.7.1 Template Stock Opname (Referensi Template Aktual)

Template aktual yang harus didukung sistem ada di `../_STOCK OPNAME - MEI 2026.xlsx`. Struktur template 3 sheet:

**Sheet 1 — Master Data Produk:**
```
KODE | KATEGORI | NAMA BARANG | GAMBAR | LINK | Satuan | Stok Awal
```
Kolom wajib per produk: kode unik (e.g., `W-BOT`, `TPUTIH`, `GULA12`), kategori (Teh/Cup/Gula/Creamer/Bakery/Packaging/Topping/Operating Supplies/Alat kebersihan), nama barang, foto (URL Drive), link produk, satuan (Bungkus/Pcs/Kaleng/Botol/Gen/Pack), stok awal (numeric).

**Sheet 2 — Log Pergerakan Harian (Stock Movement):**
```
TANGGAL | KODE BARANG | NAMA BARANG | JENIS | KUANTITAS | KELUAR | MASUK
```
Kolom: tanggal (DD MON YYYY), kode barang, nama barang, jenis (kategori/item), kuantitas, keluar (qty keluar), masuk (qty masuk). Untuk produk teh: keluar per transaksi (1 cup pakai X gram); untuk cup: keluar = jumlah transaksi × 1 cup per order.

**Sheet 3 — Stock Opname Summary:**
```
Kode Barang | Kategori | Nama Barang | Stok Sistem | Total Masuk | Total Keluar | Stok Fisik | Selisih
```
Kolom: kode barang, kategori (Teh/Cup/Gula/Creamer/Bakery/Packaging/Alat kebersihan), nama barang, stok sistem (dari DB), total masuk (dari Sheet 2), total keluar (dari Sheet 2), stok fisik (input manual saat stock opname), selisih (fisik - sistem). Baris dengan selisih ≠ 0 ditandai merah.

#### 21.7.2 Fitur Sistem

| Fitur | Detail |
|---|---|
| **Import Master** | Import dari Excel (Sheet 1: kode, kategori, nama, satuan, stok awal). Format harus match template. |
| **Input Pergerakan Manual** | Sheet 2: kasir/kepala toko input harian (tanggal, kode barang, qty masuk/keluar, jenis). |
| **Stock Opname Periodik** | Buat stock opname session: tentukan tanggal, lokasi. Sistem generate Sheet 3 otomatis (stok sistem + gerakan periode). Kasir input stok fisik. Sistem hitung selisih. |
| **Reason Logging** | Jika ada selisih, user **wajib isi alasan**: "Rusak", "Kadaluarsa", "Hilang", "Dicuri", "Pemakaian internal", "Salah hitung", "Lainnya". Field alasan wajib tersimpan di audit log. |
| **Approval Variance** | Selisih > threshold (dapat di-set per kategori) → harus di-approve director. |
| **Auto-JE untuk Loss** | Selisih yang di-approved sebagai "Hilang/Dicuri/Rusak" → generate write-off JE (debit: loss expense, credit: inventory). |
| **Dashboard Variansi** | Halaman `inventory/variance/` menampilkan grafik variansi per produk, tren bulanan, top produk dengan variansi tertinggi. |
| **Comparison Report** | Laporan perbandingan: "Stok Awal vs Stok Akhir" per periode, breakdown alasan selisih. |

**Threshold default:**
- Item murah (kurang dari Rp 10.000/unit): selisih maksimal Rp 50.000 per bulan tanpa approval director (disimpan di log).
- Item mahal atau selisih > Rp 50.000: wajib approval.

> **Implikasi schema**: tabel `stock_opname_sessions (id, location_id, period_start, period_end, status, physical_count_by, approved_by)`, `stock_opname_lines (session_id, product_id, system_qty, physical_qty, variance, reason, variance_approved_by)`.

### 21.9 Upload Bukti Transaksi & Audit MCP

Setiap entri jurnal akuntansi **wajib** bisa dilampiri bukti transaksi (scan/foto kwitansi, struk, faktur, dll.):

| Fitur | Detail |
|---|---|
| **Lampiran per Jurnal** | Saat membuat manual JE, kasir/akuntan bisa upload lampiran (maks 10 MB per file, format: JPG/PNG/PDF). |
| **Storage** | Files di-upload ke R2/S3 object storage, tidak di-database. URL disimpan di tabel `journal_attachment (journal_entry_id, file_url, file_name, uploaded_by, uploaded_at)`. |
| **View/Download** | User dengan permission `accounting.journal.read` bisa view/download lampiran. |
| **Audit Trail** | Setiap upload/download tercatat di `audit_log`. |
| **MCP Queryable** | MCP tool `accounting.get_journal_with_attachments(id)` mengembalikan jurnal + semua lampiran. |

**Implementasi:**
- Upload via API: `POST /api/files/upload` → return `{ url, file_key }`.
- Tabel: `journal_attachments (id, journal_entry_id, file_key, file_name, file_size, mime_type, uploaded_by, uploaded_at)`.
- MCP tool: `accounting.get_attachments(journal_id)`, `accounting.upload_attachment(journal_id, file)`.

### 21.10 Donasi (Rounding Donation)

> **Pain point eksplisit**: "biasanya kalo cash dan uangnya tidak bulat tidak ada kembalian". Solution: sisakan kembalian sebagai donasi.

Fitur donasi memungkinkan pelanggan membulatkan kembalian atau menyisihkan sejumlah uang:

| Fitur | Detail |
|---|---|
| **Rounding Donation** | Saat payment cash, jika kembalian < Rp 500, opsi: "Bulatkan ke atas" atau "Donasikan kembalian". Jika customer pilih donasi, kembalian di-round ke atas (e.g., kembalian Rp 230 → Rp 300, selisih Rp 70 = donasi). |
| **Nominal Donation** | Customer bisa pilih donasi sejumlah nominal tetap (Rp 1.000, Rp 2.000, Rp 5.000) atau custom. |
| **Opsi di UI POS** | Saat payment cash: muncul modal "Sisa kembalian Rp X. Ingin donasikan?" dengan tombol: "Ya, donasi Rp Y", "Bulatkan", "Tidak, kembalian penuh". |
| **Tracking Donation** | Total donasi per transaksi tersimpan di `payments.donation_amount`. |
| **Akuntansi** | Donation tidak jadi revenue; masuk ke akun "Donation Receivable" atau "Trust Fund" per periode. |
| **Laporan** | Laporan donasi per periode: total donasi, jumlah transaksi donasi, rata-rata donasi. |
| **Recipient** | Saat ini donasi ditabungkan (belum ada pihak ketiga) → disimpan sebagai "tabungan donasi" sampai ditentukan recipient-nya. |

> **Catatan**: opsi ini membuat transaksi cash menjadi "non-cash" untuk selisih kembalian. Tidak mempengaruhi COGS atau revenue — hanya mengubah account donasi.

---

### 21.11 Surat Menyurat & Register Dokumen Administrasi

ERP wajib menyediakan modul surat menyurat untuk kebutuhan administrasi internal, legal, pajak, procurement, HR, dan keuangan.

| Fitur | Detail |
|---|---|
| **Register Surat** | Catat surat masuk, surat keluar, dan memo internal. Nomor surat unik per tenant. |
| **Metadata Wajib** | Lokasi, arah surat, nomor surat, perihal, pihak terkait, tanggal surat, jatuh tempo, kanal, klasifikasi, prioritas, status, penanggung jawab. |
| **Status Workflow** | `draft`, `registered`, `in_progress`, `sent`, `closed`, `archived`. |
| **Lampiran** | File surat dapat ditautkan via URL storage/upload yang sudah ada; isi dokumen tidak disimpan langsung di database. |
| **Audit Trail** | Setiap create, update, dan archive/delete wajib tercatat di `audit_log` dengan before/after. |
| **Akses** | Permission terpisah: `correspondence.view`, `correspondence.create`, `correspondence.update`, `correspondence.delete`. |

---

### 21.8 PIC & Komunikasi
- **PIC dari sisi perusahaan**: **user sendiri** (Lintang Maulana Zulfan).
- **Kanal komunikasi proyek**: **WhatsApp**.

---

## 22. Public Website, CMS, Membership Online

> Bagian ini ditambahkan dari arahan user pada 2026-05-05.

### 22.1 Tujuan Website Publik (`aroadritea.com`)
1. **Etalase merek**: tampilkan menu produk, lokasi toko, foto, narasi merek (filosofi 山水 / shānshuǐ).
2. **Pendaftaran membership**: calon pelanggan dapat mendaftar sebagai member, mendapatkan kartu digital + benefit.
3. **Konten dapat dikelola tanpa developer** (CMS).
4. **SEO-friendly** sehingga muncul di pencarian "Aroadri Tea Yogyakarta", "boba Yogyakarta", dll.
5. **Multi-bahasa**: Indonesia (utama), Inggris (turis), Mandarin (segmen ekspat & turis Tiongkok).
6. **Mobile-first**: pelanggan datang dari Instagram/TikTok via HP.

### 22.2 Cakupan Halaman Wajib
- **Beranda** — hero (logo, tagline, CTA "Daftar Member"), highlight menu, lokasi terdekat.
- **Menu** — daftar produk (sinkron dengan ERP), kategori, varian, harga.
- **Tentang** — narasi merek, filosofi, tim (opsional), milestone.
- **Lokasi Toko** — list + peta + jam operasional.
- **Berita / Blog / Promo** — konten editorial yang dikelola via CMS.
- **Karir** — lowongan kerja (opsional Phase 2; integrasikan dengan modul HR/perekrutan via MCP).
- **Member** — info benefit, FAQ, syarat & ketentuan.
- **Kontak** — form kontak / WA business.
- **Privasi & Syarat** — wajib (UU PDP).

### 22.3 Content Management System (CMS)
Sistem **internal** (bukan WordPress / Sanity / Strapi eksternal) yang menjadi bagian dari ERP. Alasan:
- Konten produk & lokasi sudah ada di ERP → konten website "live" dari sumber yang sama (tidak duplikasi data).
- Hemat biaya lisensi & infrastruktur.
- Konsisten dengan permintaan user "fleksibilitas kustomisasi tanpa edit source code" (lihat §21.2).

#### 22.3.1 Tipe Konten yang Dikelola CMS
| Tipe | Sumber Data | Editor |
|---|---|---|
| **Halaman statis** (Beranda, Tentang, Privasi) | tabel `cms_pages` (blok kontent) | Manajemen, marketing |
| **Posting Blog/Berita/Promo** | tabel `cms_posts` | Manajemen, marketing |
| **Banner / Hero** | tabel `cms_banners` (dengan jadwal aktif) | Manajemen |
| **Menu / Produk** | tabel `products` (ERP) — read-only di CMS | (dikelola di modul Inventory) |
| **Lokasi Toko** | tabel `locations` (ERP) — read-only di CMS | (dikelola di modul Lokasi) |
| **FAQ** | tabel `cms_faqs` | Manajemen |
| **Testimoni / Review** (opsional) | tabel `cms_testimonials` | Manajemen |
| **Setting site** (logo, kontak, sosmed) | tabel `cms_settings` (key-value) | Direktur, Manajemen |

#### 22.3.2 Workflow Editorial
- **Draft → Review → Published → Archived**
- Approval **opsional** (gunakan workflow engine — lihat SoT §21.2 / SD §18).
- **Schedule publish** (publish di waktu tertentu).
- **Versioning** (history versi konten dapat di-rollback).

#### 22.3.3 Multi-Bahasa CMS
- Setiap halaman / posting punya **konten per bahasa** (`id`, `en`, `zh`).
- Editor dapat fokus mengisi 1 bahasa dulu, sisanya fallback ke bahasa default `id`.

#### 22.3.4 SEO
- Setiap halaman wajib field `slug`, `meta_title`, `meta_description`, `og_image`.
- Sitemap.xml + robots.txt otomatis ter-generate.
- Schema.org markup (Organization, Restaurant, MenuItem) untuk hasil pencarian kaya.

### 22.4 Pendaftaran Membership Online

#### 22.4.1 Alur
1. Pengunjung di `aroadritea.com/member/daftar` mengisi form: nama, email, nomor HP (WA), tanggal lahir, kota.
2. Verifikasi nomor HP via OTP WhatsApp **atau** OTP email (Phase 1: pakai email otomatis dari mailbox HestiaCP; OTP WhatsApp Phase 2 bila integrasi WA Business API ada).
3. Setelah verifikasi → akun member dibuat di ERP (tabel `partners` kind=customer is_member=true + tabel `members`).
4. Member memakai **nomor telepon terdaftar** sebagai identitas utama saat transaksi di toko.
5. Member dapat login ke `aroadritea.com/member/akun` untuk:
   - Lihat saldo poin
   - Lihat riwayat transaksi
   - Update profil
   - Lihat voucher yang berlaku
   - Lihat tier saat ini (bila tier aktif)

#### 22.4.1a Alur Identifikasi Member di Kasir
1. Saat transaksi POS, kasir bertanya: "Apakah ada member?"
2. Jika pelanggan menjawab ada, kasir meminta **nomor telepon member**.
3. POS mencari data member aktif berdasarkan nomor telepon yang sudah dinormalisasi.
4. Jika ditemukan, POS menampilkan nama member; kasir mengonfirmasi: "Atas nama `<nama member>`?"
5. Jika pelanggan mengonfirmasi, POS attach `customer_id` ke transaksi agar poin/loyalty tercatat.
6. Jika nomor tidak ditemukan atau nama tidak cocok, transaksi tetap dapat dilanjutkan sebagai walk-in anonim.

#### 22.4.2 Data yang Dikumpulkan
Sesuai SoT §13.1 (CRM): nama, telepon, email, tanggal lahir. Tambahan untuk member portal: kata sandi (hashed), preferensi notifikasi.

#### 22.4.3 Kepatuhan UU PDP
- Halaman **Kebijakan Privasi** wajib ada sebelum form aktif.
- Checkbox consent eksplisit: "Saya menyetujui [Kebijakan Privasi]" — wajib diisi sebelum submit.
- Member dapat **request hapus akun** (right to erasure) → modul akun member.
- Audit log untuk akses & ekspor data member.

#### 22.4.4 Anti-Abuse
- Rate limit signup per IP: 3 / jam.
- CAPTCHA (hCaptcha / Cloudflare Turnstile) di halaman signup.
- Verifikasi OTP wajib sebelum akun aktif.
- Tabel `member_signup_attempts` untuk audit + deteksi pattern abuse.

### 22.5 Kartu Member Digital (Opsional / Phase 2)
- Flow utama operasional toko adalah **lookup nomor telepon + konfirmasi nama**, bukan scan QR.
- Kartu digital/QR boleh disiapkan di Phase 2 sebagai alternatif, tetapi tidak wajib untuk akumulasi poin.
- Jika nanti diaktifkan, QR code kartu member hanya berisi token/member id non-PII dan tetap membutuhkan konfirmasi kasir.

### 22.6 Newsletter / Komunikasi
- **Phase 1**: tidak ada blast email/WA (sesuai SoT §13.3).
- **Phase 2 (opsional)**: tambah modul newsletter dengan checkbox opt-in saat signup.

### 22.7 Performa & SEO Targets
- **LCP** < 2.5 s di koneksi 4G.
- **CLS** < 0.1.
- **TTI** < 3.5 s.
- Lighthouse score ≥ 90 (Performance, SEO, Accessibility, Best Practices).
- Gambar di-`webp` / `avif`, lazy-loaded.
- Static / ISR (Incremental Static Regeneration) untuk halaman publik.

---

## 23. Brand & Visual Identity

> Detail otoritatif ada di `brand-assets/BRAND.md`.

### 23.1 Logo
Lingkaran merah dengan huruf **A** stilisasi membentuk **siluet gunung putih** + motif **awan keberuntungan (祥云)** di kiri-kanan + **gelombang air & awan** di bawah, dengan tanda **™** di kanan atas. Filosofi: gunung-air (山水 / shānshuǐ) — alam, kemurnian, ketenangan — sejalan dengan posisi premium teh ala Tiongkok.

### 23.1a Nama & Tagline
- **Aroadri** berasal dari perpaduan kata **Aroma** dan **Adri**. Dalam bahasa Sanskerta, **Adri** berarti **gunung**.
- Tagline resmi: **Nature Aroma in Every Sip**. Tagline ini adalah teks brand dan tidak diterjemahkan di website publik.
- Teks signage outlet **中国茶** digunakan sebagai aksen visual brand di website publik pada semua bahasa/locale.

### 23.2 Penggunaan
- Login screen ERP & website publik: logo besar di tengah.
- Header dashboard ERP: logo kecil + nama "Aroadri Tea — ERP".
- Cetak struk POS: **logo monokrom hitam** (printer thermal tidak cetak warna).
- Slip gaji: logo monokrom + nama legal "PT. Gandha Hill Catering Management Indonesia".
- Favicon website: bentuk huruf A tunggal (square 32×32, 192×192, 512×512).

### 23.3 Palet & Tipografi (Awal — Konfirmasi Brand Designer)
| Token | Pemakaian |
|---|---|
| `brand-red` `#D6262E` | Logo, header, tombol primer |
| `brand-red-dark` `#A41B22` | Hover, tekanan |
| `brand-cream` `#FBF6EE` | Latar terang |
| `brand-ink` `#1A1A1A` | Teks |
| `brand-gold` `#C8A557` | Aksen premium (opsional) |

Tipografi multibahasa:
- Latin: **Inter** (UI ERP) atau **Manrope** (UI publik)
- Mandarin: **Noto Sans SC**
- Display: **Noto Serif SC** atau **ZCOOL XiaoWei** (untuk heading marketing)

### 23.4 Larangan
- Jangan rotasi / distorsi logo.
- Jangan ganti warna logo selain merah resmi atau monokrom hitam.
- Jangan tambah bayangan / gradasi pada logo asli.
- Kontras logo terhadap latar minimum 4.5:1.

---

## 24. POS Demo / Training Mode

> Bagian ini ditambahkan dari arahan user 2026-05-05 v2.

### 24.1 Tujuan
Kasir baru, manajer yang ingin uji coba fitur, dan QA yang verifikasi flow POS perlu **mode demo** yang:
- Mensimulasikan transaksi POS lengkap (tambah produk, modifier, diskon, payment, refund, cetak struk).
- **TIDAK** mempengaruhi data produksi (DB, akuntansi, inventory, KDS, audit log).
- **TIDAK** mengirim transaksi ke Naixer (tidak ada label fisik tercetak ke printer real, atau cetak ke printer dengan watermark "DEMO").
- Mudah diaktifkan / dinonaktifkan; data demo dapat di-reset dengan satu klik.

### 24.2 Cakupan Demo Mode
| Modul | Demo Mode | Catatan |
|---|---|---|
| **POS** | ✅ wajib | Fitur utama yang diminta user |
| Inventory adjustment | (Phase 2 opt) | Untuk training admin gudang |
| Purchase Order | (Phase 2 opt) | |
| Akuntansi (manual JE) | ❌ | Tidak boleh — risiko salah post produksi terlalu tinggi; pakai sandbox tenant penuh kalau perlu |
| Payroll | ❌ | Sda |

### 24.3 Karakteristik
- **Indikasi visual jelas**: banner merah/kuning lebar "MODE DEMO — Transaksi tidak masuk ke sistem" tampil terus selama mode aktif.
- **Watermark di struk demo**: bila tetap dicetak, struk diberi tulisan diagonal "DEMO / TIDAK SAH" agar tidak tertukar dengan struk asli.
- **Master data**: produk, harga, modifier, tax rate **dibaca dari produksi** (snapshot saat aktivasi) supaya simulasi realistis.
- **Transaksi & perubahan**: disimpan **client-side only** (IndexedDB di POS device), **tidak pernah dikirim ke server**.
- **Reset**: tombol "Reset Demo" hapus semua transaksi demo dari device.
- **Tidak ada mode toggle tersembunyi**: aktifasi via menu kasir (ikon + label "Mode Demo") atau URL khusus `/pos/demo`. Wajib login dengan permission `pos.demo.use`.

### 24.4 Use Cases
1. **Onboarding kasir baru**: simulasi 10 transaksi sebelum shift pertama.
2. **Demo ke calon mitra/franchisee**: tampilkan UI POS tanpa risiko.
3. **QA / regression test**: developer / QA bisa uji fitur baru di toko nyata tanpa polusi data.
4. **Pelatihan saat tutup toko**: setelah jam toko, manajer latih fitur diskon/refund.

### 24.5 Larangan
- ❌ Demo mode **tidak boleh** mengakses printer label/struk fisik di production printer queue (harus toggle ke "demo printer" / "tampilkan saja preview di layar").
- ❌ **Tidak boleh** mengirim webhook ke pihak ketiga (GoFood callback simulasi, dll.).
- ❌ Transaksi demo **tidak boleh** muncul di laporan penjualan, dashboard, atau audit log produksi.

> Detail teknis di SYSTEM-DESIGN §34 dan ADR-0008.

---

## 25. Resilience & Auto-Recovery

> Bagian ini ditambahkan dari arahan user 2026-05-05 v2.

### 25.1 Pain Point yang Dialamatkan
Karena spek server terbatas (1 vCPU / 2 GB RAM), terdapat risiko nyata:
- Server **crash** karena memory pressure / OOM kill.
- Aplikasi Next.js / Hono **down** karena exception unhandled.
- Internet toko **putus** (telah didokumentasi di §21.1).
- **Listrik padam** di toko mengakibatkan POS reboot.
- Layanan berhenti total saat sedang melayani pelanggan = kehilangan revenue + reputasi.

### 25.2 Persyaratan Tingkat Tinggi
1. POS **wajib tetap berfungsi** meski:
   - Server VPS **down** atau tidak terjangkau.
   - Internet toko **putus**.
   - Listrik **padam** dan POS device baru reboot.
2. Semua transaksi yang dilakukan offline / saat server down **wajib otomatis tersinkronisasi** begitu koneksi pulih.
3. **Tidak boleh** kehilangan transaksi karena server crash.
4. Layanan server harus **otomatis restart** bila proses crash (bukan menunggu intervensi manual).
5. **Notifikasi** ke admin (mis. WhatsApp / email) saat:
   - Server down lebih dari 5 menit.
   - Backup gagal.
   - Memory > 85% lebih dari 10 menit.
6. **Recovery time objective (RTO)**: layanan kembali aktif dalam ≤ 2 menit setelah crash.
7. **Recovery point objective (RPO)**: tidak ada transaksi POS yang hilang (zero data loss untuk transaksi yang sudah dieksekusi kasir).

### 25.3 Strategi (Ringkas)
| Lapisan | Strategi |
|---|---|
| **POS client (PWA)** | Service worker pre-cache shell; IndexedDB outbox queue; idempotency key per transaksi; auto-retry sync exponential backoff |
| **POS device boot** | Setelah listrik pulih, browser kiosk auto-launch; outbox dipulihkan; sync resume otomatis |
| **Server proses** | Docker `restart: always` + healthcheck → container yang gagal di-restart otomatis |
| **Memory guard** | Node.js `--max-old-space-size` per proses + Docker memory limits + OOM-killer akan trigger restart |
| **Database** | Managed Postgres (Neon/Supabase) — HA bawaan provider |
| **Reverse proxy** | Caddy dengan upstream health check; bila upstream down, serve maintenance page (mode "service akan kembali sebentar lagi") |
| **Worker** | Cron + queue idempotent; retry job gagal otomatis; DLQ untuk yang gagal berulang |
| **Monitoring** | Healthcheck `/healthz` + uptime monitor (UptimeRobot free tier atau cron internal) |
| **Notifikasi outage** | Email / WA Business via webhook eksternal (tidak menambah komponen di server) |

### 25.4 Definisi "Selesai" (untuk modul POS)
POS dianggap **resilient-ready** bila lulus tes berikut:
1. **Cabut kabel jaringan** saat user di tengah membuat order → POS tetap bisa selesaikan transaksi + cetak struk + masuk outbox.
2. Setelah jaringan pulih → outbox flush ke server, ID resmi diterbitkan, struk dapat dicetak ulang.
3. **Reboot POS device** dengan transaksi pending → setelah reboot, transaksi pending masih ada di outbox.
4. **Stop server** → POS terus melayani transaksi baru tanpa error fatal.
5. **Start server** → outbox flush, server menerima tanpa duplikasi (idempotency).

> Detail teknis & checklist di SYSTEM-DESIGN §35 dan ADR-0009.

---

## 26. Glosarium

| Istilah | Arti dalam konteks proyek |
|---|---|
| **PB1 / PBJT** | Pajak Barang dan Jasa Tertentu (pajak restoran daerah, 10%, inclusive harga jual) |
| **PKP** | Pengusaha Kena Pajak (status PT Gandha Hill: PKP) |
| **SAK ETAP** | Standar Akuntansi Keuangan untuk Entitas Tanpa Akuntabilitas Publik |
| **COA** | Chart of Accounts — bagan akun (lihat Lampiran A) |
| **BOM** | Bill of Materials — komposisi resep produk |
| **KDS** | Kitchen Display System — layar dapur untuk antrean produksi |
| **Naixer** | Merek mesin pembuat teh otomatis dari Tiongkok dengan KDS bawaan |
| **GRN** | Goods Receipt Note — dokumen penerimaan barang |
| **GoFood / GrabFood / ShopeeFood** | Aplikasi delivery; komisi 20% |
| **MCP** | Model Context Protocol — protokol agar AI dapat memanggil tools eksternal |
| **PWA** | Progressive Web App — web yang dapat diinstall & jalan offline |
| **MoQ** | Minimum Order Quantity |
| **AOV** | Average Order Value |
| **SP** | Surat Peringatan (HR) |
| **Coretax** | Sistem administrasi pajak DJP terbaru, digunakan untuk e-Faktur |
| **CMS** | Content Management System — modul ERP untuk mengelola konten website publik tanpa edit kode |
| **JAMstack** | Arsitektur web: JavaScript + APIs + Markup; konten static-prerendered + API dinamis (Trivedi & Patel, 2026 — relevan untuk website publik) |
| **Headless CMS** | CMS yang memisahkan storage konten dari rendering — front-end konsumsi via API |
| **OTP** | One-Time Password — kode verifikasi sekali pakai (email / WA / SMS) |
| **Member Portal** | Halaman privat member di `aroadritea.com/member/akun` |
| **山水 (shānshuǐ)** | "Gunung-air" — genre seni lukis Tionghoa, jadi filosofi visual brand Aroadri Tea |
| **祥云 (xiángyún)** | Awan keberuntungan — motif tradisional Tionghoa di logo Aroadri |
| **Outbox (POS)** | Antrean transaksi POS yang menunggu sync ke server (lokal di IndexedDB) |
| **Idempotency Key** | Key unik per request mutasi agar retry tidak menghasilkan duplikasi |
| **RTO** | Recovery Time Objective — durasi maksimum sistem boleh down |
| **RPO** | Recovery Point Objective — durasi maksimum data yang boleh hilang saat recovery |
| **OOM Killer** | Out-of-memory killer di Linux yang membunuh proses bila RAM habis |
| **Format A (Naixer)** | Format QR resmi Naixer: `ORD0001\|P0003\|A001,M002,T001` |
| **Format B (Naixer)** | Format QR field-tested: `T003-C01-S02-W01` (default Aroadri) |
| **Demo Mode** | Mode POS sandbox client-side; transaksi tidak masuk produksi |

---

## Lampiran A — Chart of Accounts (COA) Lengkap

> Sumber: jawaban Q59 kuesioner. Standar: **SAK ETAP**. Mata uang: **IDR**. Sistem **wajib seed** akun-akun ini saat go-live, dengan kode akun dan klasifikasi (Aktiva/Pasiva/Modal/Pendapatan/Beban) yang akan ditentukan saat setup.

### Aktiva Lancar
- Petty Cash
- Cash
- Cash in Bank
- Pingpong Payments
- Account Receivable
- Allowance for Doubtful Debt *(kontra-akun)*
- Merchandise Inventory
- Office Supplies
- Store Supplies
- Prepaid Expense
- Prepaid Rent of Jakarta Office
- Prepaid Rent of Yogyakarta Office
- Prepaid Rent of Malioboro Store
- Jakarta Office Security Deposit
- Yogyakarta Office Security Deposit
- Store Security Deposit
- Prepaid Final Tax
- Prepaid PBJT Tax
- Prepaid PPN
- Vat In (PPN Income)

### Aktiva Tetap & Investasi
- Investment
- Construction in Progress
- Renovasi / Leasehold Improvement
- Store Equipment
- Accumulated Depreciation Of Store Equipment *(kontra-akun)*
- Office Equipment
- Accumulated Depreciation Of Office Equipment *(kontra-akun)*
- Machine
- Accumulated Depreciation Of Machine *(kontra-akun)*
- Trademarks
- Accumulated Depreciation Of Trademark *(kontra-akun)*
- Furnitur and fixture
- Accumulated Depreciation Of Furnitur and fixture *(kontra-akun)*

### Kewajiban
- Account Payable
- Expense Payable
- Income Tax Payable
- PPN Payable
- PB1 / PBJT Payable
- Salaries Payable
- Final Income Tax Payable
- Final Income Tax 23 Payable
- Due to Owner
- Reimbursement Payable
- Long Term Liabilities
- Bank BCA Loan
- PPN Outcome (Vat Out)

### Modal / Ekuitas
- Common Stock
- Devidend
- Income Summary
- Retained Earning

### Pendapatan
- Sales
- Sales Return *(kontra)*
- Sales Discount *(kontra)*
- Interest Revenue
- Other Income

### Harga Pokok Penjualan / Pembelian
- Purchase
- Purchase Return *(kontra)*
- Purchase Discount *(kontra)*
- Beginning Inventory
- Ending Inventory
- Freight Paid / Freight In

### Beban Operasional
- Advertising Expense
- Jakarta Office Utilities Expense
- Yogyakarta Office Utilities Expense
- Store Utilities Expense
- Bad Debt Expense
- Depreciation Expense
- Installation Expense
- Store Rent Expense
- Office Rent Expense
- Wages and Salaries Expense
- Others Operating Expense
- Office Salaries Expense
- Store Salaries Expense
- Office Supplies Expense
- Store Supplies Expense
- Administrative Expense
- Property Maintenance Expense
- Pre-Operation Expenses
- Renovation Expense
- Depreciation Expense of Furniture and Fixture
- Depreciation Expense of Machine
- Depreciation Expense of office Equipment
- Depreciation Expense of Store Equipment
- Depreciation Expense of Trademark
- Final Rental Tax Expense
- Commission Expense
- Freight Out
- Jakarta Office Rent Expense
- Yogyakarta Office Rent Expense
- PJU Expense *(Pajak Penerangan Jalan Umum / utility)*
- Transportation Expense
- Comunication Expense *(sic — typo asli)*

### Beban Non-Operasional
- Interest Expense
- Bank Administration Fees
- Income Tax Expenses

> **Catatan tindak lanjut**:
> - Beberapa akun ada yang merupakan **kontra-akun** (depreciation, sales return, allowance) — pastikan tipe akun di-set benar saat seeding.
> - "Comunication Expense" adalah typo asli COA lama dan dipertahankan di label English seed agar cocok dengan daftar historis; UI dapat menampilkan label Indonesia yang natural.
> - Akun lokasi-spesifik COA lama mencakup kantor Jakarta, kantor Yogyakarta, dan toko Malioboro. Website publik tetap hanya menampilkan outlet. Saat menambah outlet/kantor baru, akun prepaid/utilities/salaries terkait perlu otomatis di-clone, atau gunakan **dimensi cabang** alih-alih akun terpisah (rekomendasi: pakai dimensi cabang, biarkan COA tetap ringkas).

---

## Lampiran B — Foto Lapangan & Sistem Lama

Foto-foto referensi yang ada di kuesioner (PDF asli):

| Halaman PDF | Deskripsi |
|---|---|
| 16 | Tampak depan toko Malioboro (signage "AROADRI TEA" + lampion oriental) |
| 16 | Area kasir dengan menu Best Seller TOP 3 + 2 layar |
| 17 | Mesin kasir Imin Swan 2 (tampak dekat) + EDC |
| 17 | Area dapur / pantry: wastafel, mesin teh, peralatan |
| 18 | Mesin pembuat teh Naixer dengan KDS layar (UI Bahasa Inggris) |
| 18 | Area gudang: rak penyimpanan stok teh, syrup, krimer (label "Jasmine", "Bamboo", "Ceylon", "Osmanthus" tertulis tangan) |
| 19 | Display dessert: Egg Tart Rp 18K |
| 19 | Tampak dalam toko (kursi, lampion, mural) |
| 20 | Printer label **Comson** + label QR ("Pickup number:3, Glutinous Fragrant Tea (500ml), Less sugar, Normal ice") |
| 20 | Router internet & instalasi listrik di kabinet bawah kasir |
| 22–24 | Screenshot **restosuite.ai POS lama**: New order, Orders, Stock management, Reports - Business |
| 25–27 | Screenshot **KDS Naixer**: Order recipe, Material information, Production data, Data records |

> Foto-foto ini akan menjadi referensi UX (apa yang harus **lebih baik** dari restosuite.ai dan apa yang **tetap dipertahankan**). Khususnya, KDS Naixer punya 6 jenis log (production, material, cleaning, fault, calibration, peristaltic pump) — pertimbangkan apakah ERP perlu mirror semua atau cukup tarik via integrasi.

---

## Catatan Versi

| Versi | Tanggal | Penulis | Perubahan |
|---|---|---|---|
| 1.0 | 2026-05-05 | Lintang Maulana Zulfan | Versi awal, diturunkan dari kuesioner v1.0 (30 April 2026) |
| 1.1 | 2026-05-05 | Lintang Maulana Zulfan | Tambah §22 (Public Website + CMS + Membership), §23 (Brand), update §17.4 (subdomain split), update §20.3 (CMS masuk Phase 5), tambah istilah glosarium |
| 1.2 | 2026-05-05 | Lintang Maulana Zulfan | Upgrade RAM 1→2 GB; perluas §14.4 (dua format Naixer QR + master mapping); tambah §24 (POS Demo Mode), §25 (Resilience & Auto-Recovery); tambah istilah glosarium (Outbox, RTO, RPO, dll.) |
| 1.4 | 2026-05-09 | Lintang Maulana Zulfan | Tambah §18.2 (Keamanan Level Militar), §21.2a (Ekspor XLSX), §21.2b (Dokumentasi), §21.3 (Laporan Harian), §21.4 (Hourly Sales), §21.5 (Petty Cash), §21.6 (Reimbursement), §21.7 (Stock Opname & Variansi), §21.9 (Upload Bukti+Jurnal MCP), §21.10 (Donasi/Rounding) |
| 1.5 | 2026-05-10 | Lintang Maulana Zulfan | Update §12 (HR & Payroll): SOP jam kerja, shift, istirahat, keterlambatan (Rp 50/100k), absensi + komponen payroll; §12.8–§12.13 SOP lengkap (buka/tutup toko, produksi, area, stock alert) |
| 1.6 | 2026-05-12 | Lintang Maulana Zulfan | Tambah §21.3b (Ekspor Excel Omzet Harian): omzet neto setelah PB1 10% dipisahkan, penyesuaian manual untuk beda akuntansi vs fiskal, draft per lokasi/tanggal, rumus PB1_exclusive = gross ÷ 1.10 |

---

> **Aturan main**: setiap PR / commit yang menambah / mengubah behavior sistem **harus** menyebutkan bagian dokumen ini yang relevan, dan bila ada kebutuhan baru yang belum ada di dokumen ini, **pertama** update dokumen ini, **lalu** kerjakan kodenya.
