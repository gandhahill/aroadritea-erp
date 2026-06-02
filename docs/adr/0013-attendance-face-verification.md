# ADR-0013: Attendance Face Verification

- **Status**: Accepted
- **Tanggal**: 2026-06-02
- **Pengambil keputusan**: Lintang Maulana Zulfan
- **Konteks bisnis**: SOURCE-OF-TRUTH §12.4
- **Konteks teknis**: SYSTEM-DESIGN §9.6, §21.8, §25.2.1

## Konteks
Attendance awal memakai GPS dan shift. Saat live testing, GPS tetap diperlukan tetapi perlu lapisan tambahan agar presensi benar-benar dilakukan oleh karyawan yang bersangkutan.

Data wajah termasuk data pribadi sensitif. Sistem harus memenuhi prinsip UU PDP, tetap ringan untuk VPS 1 vCPU / 2 GB RAM, dan tidak menambah halaman enrollment baru agar flow operasional toko tidak pecah.

## Keputusan
Presensi check-in menambahkan face verification. Jika employee belum punya template wajah aktif, halaman check-in otomatis meminta enrollment wajah inline pada check-in pertama setelah fitur aktif. Enrollment dan check-in terjadi dalam alur yang sama.

Sistem menyimpan template/verifier wajah terenkripsi, bukan foto wajah mentah. Hasil verifikasi per transaksi disimpan di attendance (`is_face_verified`, `face_match_score`). Enrollment template dicatat di audit trail sebagai mutasi data sensitif.

Implementasi awal memakai template ringan yang dihitung di browser dan diverifikasi 1:1 di service layer. Tidak ada dependency face-recognition server yang berat. GPS, shift, dan permission check tetap berjalan seperti sebelumnya.

## Alternatif yang Dipertimbangkan
- Halaman enrollment khusus HR: ditolak karena user meminta tidak membuat halaman baru dan enrollment harus terjadi saat check-in pertama.
- Menyimpan foto mentah untuk dibandingkan manual: ditolak karena lebih berisiko untuk UU PDP dan tidak diperlukan untuk presensi rutin.
- Library ML face recognition server-side: ditolak untuk fase ini karena menambah footprint dan risiko runtime pada VPS kecil.

## Konsekuensi
- Positif: Flow presensi tetap satu halaman, data biometrik lebih terkendali, dan server tetap ringan.
- Negatif / trade-off: Template ringan bukan pengganti liveness detection atau model biometrik profesional; peningkatan anti-spoofing bisa menjadi fase lanjutan.
- Neutral: Jika kelak memakai provider biometrik khusus, schema template tetap dapat dipakai sebagai metadata enrollment dan migrasi provider.

## Referensi
- SOURCE-OF-TRUTH §12.4
- SYSTEM-DESIGN §21.8
- SYSTEM-DESIGN §25.2.1
