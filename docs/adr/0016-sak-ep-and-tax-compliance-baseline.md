# ADR-0016: SAK EP and Tax Compliance Baseline

- **Status**: Accepted
- **Tanggal**: 2026-06-10
- **Pengambil keputusan**: Lintang Maulana Zulfan + Codex
- **Konteks bisnis**: SOURCE-OF-TRUTH §10-§11, §20.3, §21.3b
- **Konteks teknis**: SYSTEM-DESIGN §19, §20, §21.2, §25.5b, §30

## Konteks

Aroadri Tea membutuhkan modul akuntansi, pajak, dan laporan yang selaras dengan SAK Indonesia untuk Entitas Privat (SAK EP) serta regulasi pajak Indonesia yang berlaku. Dokumen desain awal masih memakai istilah SAK ETAP, sementara SAK EP berlaku efektif 1 Januari 2025 dan menggantikan SAK ETAP untuk entitas privat.

Referensi pajak internal juga masih mencampur PPh Pasal 25 dengan PPh Final UMKM 0,5%, serta menyebut ambang Rp500 juta/tahun sebagai syarat umum. Berdasarkan PMK 164/2023, PPh Final UMKM 0,5% berlaku untuk WP orang pribadi dan badan dengan peredaran bruto tidak melebihi Rp4,8 miliar per tahun; ambang Rp500 juta hanya pengecualian untuk WP orang pribadi, bukan PT/badan.

Mulai 2025, tarif PPN dalam UU adalah 12%, tetapi untuk barang/jasa non-mewah biasa memakai DPP nilai lain 11/12 sehingga tarif efektif tetap 11%. Untuk retail F&B Aroadri, keputusan ADR-0010 tetap berlaku: PBJT/PB1 10% inclusive adalah default dan PPN keluaran retail tidak diterapkan kecuali rule opt-in untuk kasus non-retail/B2B.

## Keputusan

1. Standar pelaporan keuangan proyek adalah **SAK Indonesia untuk Entitas Privat (SAK EP)**, bukan SAK ETAP.
2. Laporan wajib Phase 1 harus mencakup:
   - Laporan Posisi Keuangan.
   - Laporan Laba Rugi dan Penghasilan Komprehensif atau Laba Rugi bila tidak ada OCI.
   - Laporan Perubahan Ekuitas.
   - Laporan Arus Kas.
   - Catatan atas Laporan Keuangan (CALK).
   - Buku besar, neraca saldo, jurnal umum, dan laporan lokasi sebagai supporting reports.
3. Sistem boleh menghasilkan scaffold CALK/notes, tetapi **tidak boleh otomatis menyatakan "patuh SAK EP"** sebelum laporan lengkap, angka komparatif, klasifikasi, dan pengungkapan final direview.
4. Seed pajak memisahkan:
   - `PPH25` sebagai angsuran PPh badan yang nominalnya ditentukan dari perhitungan tahunan/estimasi, bukan tarif tetap.
   - `PPH_FINAL_UMKM` sebagai tarif final 0,5% untuk wajib pajak yang memenuhi kriteria PP 55/2022 + PMK 164/2023.
5. Seed PPN tetap memakai `rate_bps=1100` sebagai tarif efektif untuk non-mewah biasa. Dokumen desain wajib menjelaskan bahwa dari 2025 angka ini merepresentasikan 12% x DPP nilai lain 11/12.
6. Export Coretax/e-Faktur di sistem diperlakukan sebagai **scaffold yang wajib diverifikasi terhadap template Coretax aktif pada masa pajak terkait** sebelum dipakai untuk filing final.

## Alternatif yang Dipertimbangkan

- Tetap memakai SAK ETAP sampai fase implementasi laporan final.
  - Ditolak karena SAK EP sudah efektif 1 Januari 2025 dan dokumen sumber user secara eksplisit meminta SAK EP.
- Mengubah schema `tax_rates` untuk menyimpan statutory rate dan DPP ratio.
  - Ditunda. Untuk kebutuhan saat ini, `rate_bps` sebagai tarif efektif cukup dan menghindari migrasi schema yang belum diperlukan. Metadata hukum dijelaskan di SoT/SD dan dapat ditambah ke schema jika nanti perlu dukungan multi-DPP yang lebih kompleks.
- Menganggap export Coretax CSV lama sebagai format final.
  - Ditolak. Coretax dan PER-11/PJ/2025 mengubah bentuk/isi/tata cara SPT Masa PPN; file ekspor harus diverifikasi terhadap template aktif.

## Konsekuensi

- Positif: terminology dan baseline compliance konsisten dengan standar 2025.
- Positif: PPh Final UMKM tidak lagi tertukar dengan PPh 25, sehingga posting dan laporan pajak lebih aman.
- Positif: laporan SAK EP punya jalur CALK yang dapat diakses UI dan MCP.
- Negatif / trade-off: template final laporan dan Coretax tetap butuh review akuntan/konsultan pajak sebelum dipakai untuk filing resmi.
- Neutral: `rate_bps=1100` tetap dipakai sebagai tarif efektif, sehingga tidak ada migrasi data pajak sekarang.

## Referensi

- `D:\KERJA\Aroadri Tea\SAK EP.md`
- `D:\KERJA\Aroadri Tea\DDTC Tax Manual.md`
- IAI, SAK Entitas Privat: https://web.iaiglobal.or.id/SAK-IAI/Tentang%20SAK%20Entitas%20Privat%20%28EP%29
- DJP, PMK 131/2024 dan tarif efektif PPN 11%: https://www.pajak.go.id/id/artikel/pmk-1312024-tarif-ppn-sebelas-dua-belas
- JDIH Kemenkeu, PMK 164/2023 summary: https://jdih.kemenkeu.go.id/dok/pmk-164-tahun-2023/summary
- DJP, PER-11/PJ/2025 dan SPT Masa PPN Coretax: https://pajak.go.id/id/berita/gelar-edukasi-secara-daring-kpp-denbar-jelaskan-pelaporan-ppn
- ADR-0010: PPN Engine Opt-In
