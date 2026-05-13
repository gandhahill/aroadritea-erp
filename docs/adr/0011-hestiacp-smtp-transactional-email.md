# ADR-0011: HestiaCP SMTP Untuk Email Transaksional

- **Status**: Accepted
- **Tanggal**: 2026-05-13
- **Pengambil keputusan**: Lintang Maulana Zulfan
- **Konteks bisnis**: SOURCE-OF-TRUTH §22.4, §25
- **Konteks teknis**: SYSTEM-DESIGN §30, §31.6, §38

## Konteks

ERP membutuhkan email otomatis untuk OTP member, notifikasi operasional, dan nanti slip gaji digital. Keputusan awal masih membuka opsi Resend/SES. User kemudian menetapkan bahwa email otomatis memakai email bawaan HestiaCP.

Constraint:

- VPS sudah memakai HestiaCP sebagai panel operasional.
- Credential email adalah secret, sehingga tetap disimpan di environment.
- Sistem harus tetap ringan untuk VPS 2 GB RAM.
- Tidak boleh ada provider email eksternal tambahan sebagai default production.

## Keputusan

Gunakan SMTP mailbox bawaan HestiaCP untuk email transaksional.

Konfigurasi environment:

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`
- `SMTP_FROM_NAME`

Default operasional yang direkomendasikan:

- Host: `mail.aroadritea.com`
- Port: `587`
- Secure: `false` untuk STARTTLS
- User/from: mailbox khusus seperti `noreply@aroadritea.com`

## Alternatif yang Dipertimbangkan

### Resend

- Pros: deliverability kuat, API sederhana.
- Ditolak sebagai default karena user memilih memakai email bawaan HestiaCP dan mengurangi provider eksternal.

### Amazon SES

- Pros: murah dan scalable.
- Ditolak sebagai default karena setup DNS/sandbox lebih berat untuk fase awal.

### WhatsApp OTP

- Pros: lebih cocok untuk banyak user Indonesia.
- Ditunda ke fase berikutnya karena butuh provisioning WhatsApp Business API.

## Konsekuensi

- Positif: tidak ada vendor email tambahan; satu panel HestiaCP mengelola domain dan mailbox.
- Positif: credential SMTP seragam untuk OTP member dan notifikasi worker.
- Negatif: deliverability bergantung reputasi IP/domain VPS; wajib konfigurasi SPF, DKIM, DMARC.
- Negatif: mailbox/password perlu rotation dan monitoring bounce/manual.
- Neutral: jika deliverability buruk, ADR baru dapat mengganti provider ke SES/Resend tanpa mengubah flow bisnis.

## Referensi

- `docs/CONFIGURATION.md`
- `README.md`
- `SYSTEM-DESIGN.md §31.6`
