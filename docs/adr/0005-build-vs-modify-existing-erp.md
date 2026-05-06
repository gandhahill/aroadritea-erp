# ADR-0005: Bangun Custom dari Nol vs Modifikasi ERP Open Source

- **Status**: Accepted
- **Tanggal**: 2026-05-05
- **Pengambil keputusan**: Lintang Maulana Zulfan
- **Konteks bisnis**: SOURCE-OF-TRUTH §17 (Infrastruktur), §20 (Roadmap), §21 (Pain Points), §22 (Public Website + CMS)
- **Konteks teknis**: SYSTEM-DESIGN §1, §3, §5

## Konteks

PT. Gandha Hill (Aroadri Tea) butuh ERP. Keputusan strategis paling fundamental: **bangun dari nol** atau **modifikasi ERP open source** (Odoo, ERPNext, dll.)?

ADR ini menangkap perdebatan dan memformalkan keputusan supaya tidak diputar ulang tanpa informasi baru.

### Constraint penting
1. **Server VPS 1 vCPU / 2 GB RAM / 60 GB disk** (constraint keras dari user).
2. **Multibahasa ID/EN/ZH** wajib sejak hari pertama, termasuk laporan keuangan.
3. **MCP server** untuk integrasi AI lokal (Gemini CLI, Claude Code, Antigravity).
4. **Custom field & permission engine** database-driven.
5. **Offline-first POS** karena internet toko sering putus.
6. **Public website + CMS + member registration** (lihat ADR-0003, ADR-0004).
7. **PIC = developer tunggal**.
8. **Tidak ada budget** untuk lisensi enterprise atau SaaS berbayar.
9. **Modul priority**: Accounting → Reporting → Tax → POS → Inventory → Purchasing → Kitchen → HR → CRM (lihat SoT §20.2).

### Karakteristik unik Aroadri yang perlu dipertimbangkan
- Integrasi mesin teh **Naixer** (KDS bawaan) via QR unik per pesanan.
- **Customer-facing display** di kasir.
- **Coretax export** (e-Faktur Indonesia).
- **PB1/PBJT 10% inclusive** (perda restoran daerah).
- **Brand visual Chinese-traditional** — UI premium.

## Keputusan

**Bangun dari nol (custom)** dengan stack yang dipilih di ADR-0001.

## Alternatif yang Dipertimbangkan

### A. Modifikasi Odoo (Community Edition)
**Pros:**
- Modul akuntansi, inventory, purchasing, HR, payroll matang.
- Workflow approval engine sudah ada.
- Multi-company, multi-currency siap pakai.
- Banyak komunitas Indonesia memakai (kontributor lokal banyak).

**Cons:**
- **Memori puncak Odoo + PostgreSQL + Werkzeug + worker pool ≈ 2–4 GB**. Tidak masuk ke 2 GB RAM. Bahkan setelah optimasi, minimum recommended 4 GB.
- **Stack Python + XML view** + Odoo ORM. Modifikasi mendalam butuh pemahaman Odoo framework yang dalam — dev solo butuh waktu lama.
- **Multi-bahasa Mandarin di Odoo** ada tapi terjemahan partial; kustomisasi reporting dalam tiga bahasa ribet (RML/XML report templates).
- **MCP server** harus ditulis di luar Odoo sebagai layer terpisah → integrasi data via XML-RPC/JSON-RPC Odoo, latency tambah, schema lock-in.
- **Custom field engine** di Odoo terbatas (Studio modul berbayar di Enterprise; Community ada tapi kurang ergonomis).
- **PWA + offline POS**: Odoo POS ada offline mode, tetapi sangat kompleks dan terikat dengan struktur Odoo. Kustomisasi sulit.
- **Integrasi Naixer KDS dan customer-facing display**: tidak ada di luar kotak, harus tetap dibangun.
- **Public website + CMS + member registration**: Odoo punya modul Website + eCommerce, tetapi memori bertambah lagi (~500 MB tambahan), dan tema-temanya tidak cocok untuk brand Chinese-premium tanpa rework massif.
- **Lock-in skema**: kalau kelak migrasi keluar Odoo, ekspor data ke schema umum sulit.
- **License**: Odoo Community LGPL, tapi banyak modul fitur penting hanya di Enterprise berbayar.

**Verdict**: ditolak. Memori jadi penghalang utama; bahkan kalau memori cukup, kompleksitas modifikasi untuk requirement unik (MCP, KDS Naixer, customer display, Mandarin reports, custom CMS) mendekati atau melebihi effort custom build.

### B. Modifikasi ERPNext / Frappe Framework
**Pros:**
- Komunitas Indonesia sangat aktif (banyak tutorial Bahasa Indonesia).
- Modul "DocType" memungkinkan custom field tanpa coding (kuat).
- Multi-tenant out-of-the-box.

**Cons:**
- **Stack**: Python + JS (Vue) + MariaDB/MySQL + Redis + nginx. Lima komponen running. Memori minimum ≥ 4 GB. Tidak masuk.
- **Mandarin support** sama seperti Odoo: ada tapi kurang lengkap untuk laporan keuangan tiga bahasa simultan.
- **MCP server** belum native; harus ditulis sebagai service tambahan.
- **PWA offline POS**: ERPNext memiliki POS offline tetapi keterbatasannya cukup parah (tidak semua fitur jalan offline).
- **Customer-facing display**: tidak ada built-in.
- **Public website + CMS**: ada modul Website ERPNext, tetapi tidak bisa render konten Chinese-traditional dengan SSG/ISR seperti Next.js.

**Verdict**: ditolak alasan memori sama dengan Odoo.

### C. Frappe Framework Saja (tanpa ERPNext)
- Pros: Lebih ringan dibanding ERPNext lengkap.
- Cons: Tetap butuh MariaDB + Redis + worker. Memori masih ≥ 2 GB. Reinvent banyak fitur akuntansi dari nol di atas Frappe (gagal kompromi: dapat semua kompleksitas Frappe, tapi harus build modul akuntansi sendiri tetap).
- **Ditolak**.

### D. Akaunting / Dolibarr / FreedomERP / ringan-ringan saja
**Pros:**
- Memori ringan (PHP-based, <500 MB).
- Bisa muat di server kecil.

**Cons:**
- **Modul POS / KDS / F&B**: lemah atau tidak ada.
- **Customization**: Akaunting struktur extension PHP sederhana tetapi sulit menambah MCP/PWA.
- **Multi-bahasa Mandarin**: support terbatas.
- **UI**: kuno, tidak cocok untuk brand premium.
- **PWA offline**: tidak ada.

**Verdict**: kustomisasi yang dibutuhkan untuk mencapai SoT-equivalent feature set diperkirakan setara atau lebih besar daripada custom build — dengan trade-off UI dan ekosistem yang inferior.

### E. Hybrid: pakai library akuntansi (mis. `django-hordak`, `medusa-accounting`) + UI custom
**Pros:**
- Logika double-entry sudah teruji oleh komunitas.

**Cons:**
- Belum ada library Node/TypeScript yang matang seperti `django-hordak`.
- Mengikat ke ekosistem (Django/Python) — tidak konsisten dengan stack ADR-0001.

**Verdict**: ditolak; akuntansi double-entry adalah fitur "klasik" yang mudah dibangun dengan disiplin testing.

### F. Custom Build dari Nol (Keputusan)
**Pros:**
- **Footprint memori realistis** (lihat ADR-0001 §Konsekuensi Positif).
- **Full control** atas semua requirement unik (MCP, KDS Naixer, customer display, multibahasa simultan, CMS Chinese-traditional).
- **Stack modern** (Next.js + React) → AI assistant lebih akurat membantu coding (training data lebih banyak).
- **Skema lean**: tidak ada kolom warisan Odoo/Frappe yang tidak terpakai.
- **MCP-native**: tools didesain in-process, bukan via XML-RPC layer.
- **PWA offline**: dirancang dari awal untuk offline-first POS.
- **CMS terintegrasi**: konten produk + lokasi sudah di ERP, tidak duplikasi.
- **Kustomisasi tanpa edit source**: custom field engine + permission engine database-driven (lihat SYSTEM-DESIGN §17, §11).

**Cons:**
- **Effort awal lebih besar** untuk modul akuntansi, payroll, perpajakan dari nol.
- **Risiko bug akuntansi** bila testing tidak disiplin → mitigasi: unit test + integration test wajib (SYSTEM-DESIGN §23).
- **Tidak ada community ready-made** untuk debug akuntansi spesifik Indonesia → mitigasi: dokumentasi internal yang detail (SYSTEM-DESIGN §19, §20) + ADR untuk keputusan akuntansi.
- **Maintenance jangka panjang**: tidak ada upstream upgrade — semua tanggung jawab tim. Mitigasi: stack modern dengan ekosistem aktif, librari dipelihara.

## Konsekuensi

### Positif
- Sistem **fit to purpose** — tidak membawa beban modul yang tidak terpakai.
- **Iterasi cepat** — tidak ada framework wrapper di antara kode dan logic.
- **AI-assisted development** lebih natural — stack ada banyak training data.
- **Brand consistency** — UI dan UX dibangun dari awal sesuai filosofi visual Aroadri (山水, 祥云).
- **Foundation bersih untuk pertumbuhan**: bila kelak Aroadri membuka 50 cabang atau franchise, schema kita lebih mudah dimigrasikan ke multi-tenant SaaS dibanding modifikasi Odoo.

### Negatif / Trade-off
- **Investasi waktu Phase 1 (Accounting + Reporting + Tax)** ~3–5 bulan kerja fokus. Mitigasi: phasing ketat (SoT §20).
- **Maturity gap** dengan Odoo/ERPNext untuk fitur niche (mis. budgeting, asset advanced, project costing) — mitigasi: feature ditambah saat Aroadri benar-benar membutuhkannya, tidak prematur.

### Neutral
- **Bila Aroadri membesar dan butuh Odoo-level feature breadth**: migrasi nanti mungkin (export schema standar). Tetapi keputusan ini untuk konteks **saat ini** (1 toko aktif, 4 lokasi total, ~8 staf, budget terbatas).

## Reversibility

Keputusan ini **mahal untuk dibalik** setelah Phase 2 selesai (data sales + accounting + inventory sudah masuk ke skema custom). Reversal hanya masuk akal bila:
- Aroadri merger/akuisisi yang membawa ERP eksisting.
- Budget meledak (>10x) dan butuh fitur enterprise yang sangat luas.

Re-evaluasi keputusan dijadwalkan: **akhir Phase 4** (~12 bulan setelah go-live), dengan evaluasi:
- Apakah footprint memori masih realistis?
- Apakah feature gap dengan kebutuhan bisnis sudah lebar?
- Apakah ada developer kedua yang dapat onboard?

Jika dua dari tiga di atas "ya" → buka kemungkinan migrasi parsial ke ERP open source.

## Referensi

- Yanto et al. (2017), "Improving the Compliance with Accounting Standards Without Public Accountability (SAK ETAP) by Developing Organizational Culture" — bukti bahwa SME Indonesia kesulitan dengan tools yang tidak ramah; sistem custom yang fit dengan pengguna lokal lebih efektif daripada generic ERP yang berat.
- Narsa, Widodo, & Kurnianto (2012), "Mengungkap Kesiapan UMKM dalam Implementasi PSAK-ETAP" — sistem akuntansi untuk SME Indonesia umumnya sangat sederhana, fit-to-purpose menang atas fitur lengkap.
- Sholikin & Setiawan (2018), "Kesiapan UMKM Terhadap Implementasi SAK EMKM" — kompleksitas standar yang berlebihan menghambat adopsi; relevansi untuk memilih kompleksitas yang sesuai.
- Hetika & Mahmudah (2017), "Penerapan Akuntansi dan Kesesuaiannya dengan SAK ETAP pada UMKM Kota Tegal" — studi empiris kebutuhan riil SME Indonesia yang sederhana.
- Kumar, R. (2020), "Multi-Tenant SaaS Architectures: Design Principles and Security Considerations" — referensi untuk menyiapkan kolom `tenant_id` sambil tetap operasi single-tenant (siap migrasi nanti).
- ADR-0001 (Pilihan Stack Teknologi)
- ADR-0002 (Monorepo + App Split)
- SOURCE-OF-TRUTH.md §17, §20
- SYSTEM-DESIGN.md §1 (Tujuan & Non-Goals)

## Tindak Lanjut
- [ ] Setelah Phase 1: review apakah investasi modul akuntansi sebanding dengan output (laporan SAK ETAP siap, ekspor pajak siap).
- [ ] Setiap akhir phase: dokumentasikan effort vs estimasi awal di runbook untuk kalibrasi keputusan ini.
- [ ] Akhir Phase 4: re-evaluasi seperti kriteria di "Reversibility".
