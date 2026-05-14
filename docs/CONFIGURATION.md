# Konfigurasi Production & Kustomisasi Tanpa Edit Source

Dokumen ini menjadi referensi operasional untuk hal yang boleh berubah antar toko, channel, pajak, atau deployment. Prinsipnya: perubahan bisnis harian harus lewat database, admin UI, atau seed, bukan edit source code.

## Prioritas Sumber Konfigurasi

1. Database: pilihan utama untuk data bisnis yang berubah rutin, seperti `tax_rates`, `accounts`, `custom_field_definitions`, `workflow_definitions`, `scheduled_jobs`, CMS, katalog, lokasi, role, permission, dan mapping integrasi.
2. Environment variable: untuk secret, URL deployment, provider eksternal, dan default bootstrap yang jarang berubah.
3. Source code: hanya untuk schema, validasi kontrak, dan default fallback yang aman untuk development.

## Environment Wajib Production

| Variable | Fungsi |
|---|---|
| `DATABASE_URL` | Koneksi PostgreSQL/Neon. Wajib untuk semua app server, worker, dan MCP. |
| `BETTER_AUTH_SECRET` | Secret Better Auth. Wajib unik dan kuat di production. |
| `BETTER_AUTH_URL` | Base URL dashboard internal, contoh `https://erp.aroadritea.com`. |
| `NEXT_PUBLIC_WEB_URL` | URL publik dashboard/PWA. |
| `NEXT_PUBLIC_SITE_URL` | URL public website/member portal. |
| `MCP_SERVER_URL` | URL MCP HTTP server bila dipakai dari client/tool eksternal. |

## Member Registration

| Variable | Fungsi |
|---|---|
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Site key Cloudflare Turnstile untuk form daftar member. |
| `TURNSTILE_SECRET_KEY` | Secret Turnstile untuk verifikasi server-side. Jika kosong di production, signup ditolak. |

Di development tanpa `TURNSTILE_SECRET_KEY`, token `dev-token` boleh dipakai. Di production fallback dev ini tidak aktif.

## Email Otomatis via HestiaCP

Email otomatis memakai SMTP mailbox bawaan HestiaCP, bukan Resend/SES. Credential SMTP tetap di `.env` karena rahasia.

| Variable | Contoh | Fungsi |
|---|---|---|
| `SMTP_HOST` | `mail.aroadritea.com` | Host SMTP HestiaCP. |
| `SMTP_PORT` | `587` | Port SMTP. Gunakan `587` STARTTLS atau `465` SMTPS. |
| `SMTP_SECURE` | `false` | `true` hanya untuk port 465. |
| `SMTP_USER` | `noreply@aroadritea.com` | Mailbox HestiaCP untuk kirim email otomatis. |
| `SMTP_PASS` | `(secret)` | Password mailbox HestiaCP. |
| `SMTP_FROM` | `noreply@aroadritea.com` | Sender email. |
| `SMTP_FROM_NAME` | `Aroadri Tea` | Nama sender yang tampil di inbox. |

## Health Monitoring

Worker outage monitor memakai URL default lokal PM2. Override hanya diperlukan bila topology deploy berubah.

| Variable | Default | Fungsi |
|---|---|---|
| `SITE_HEALTH_URL` | `http://127.0.0.1:3000/api/healthz` | Health check public site. |
| `WEB_HEALTH_URL` | `http://127.0.0.1:3001/api/healthz` | Health check ERP web. |
| `MCP_HEALTH_URL` | `http://127.0.0.1:3002/healthz` | Health check MCP server. |
| `MCP_HTTP_HOST` | `127.0.0.1` | Bind host MCP health server di PM2. Jangan ubah ke `0.0.0.0` di production. |

## POS Posting, Pajak, dan Printer

POS menggunakan tabel `pos_settings` dan halaman `Settings → POS Settings`.

| Field | Default | Fungsi |
|---|---:|---|
| `pb1_tax_code` | `PB1` | Kode pajak yang dicari di tabel `tax_rates`. Besaran pajak mengikuti DB. |
| `cash_account_code` | `1-1030` | Kode akun kas/settlement POS. Service resolve ke `accounts.id`. |
| `revenue_account_code` | `4-1010` | Kode akun pendapatan penjualan. |
| `donation_trust_account_code` | `2-2050` | Kode akun liabilitas donasi/rounding donation. |
| `delivery_channels_json` | `gofood,grabfood,shopeefood` | Channel yang memakai net settlement fee. |
| `delivery_net_bps` | `8000` | Basis point net settlement delivery. `8000` berarti 80%. |
| `receipt_width_mm` | `80` | Lebar struk thermal. Default 80 mm / 8 cm, bisa disesuaikan printer. |

Untuk mengubah tarif PB1/PBJT, ubah record `tax_rates`. Untuk mengganti akun posting, ubah COA dan pilih kode akun di UI POS Settings.

## Area Kustomisasi DB

| Area | Tabel/UI |
|---|---|
| Custom field | `custom_field_definitions`, halaman Settings Custom Fields |
| Workflow approval | `workflow_definitions`, halaman Workflow Editor |
| Scheduled job | `scheduled_jobs`, halaman Scheduled Jobs |
| Integrasi Naixer/KDS | tabel konfigurasi Naixer, halaman Settings Integrations |
| Ukuran label Naixer | `naixer_qr_format_config.label_width_mm`, `label_height_mm` via Settings → Integrations → Naixer KDS |
| CMS public website | tabel CMS dan halaman CMS |
| Pajak | `tax_rates`, `tax_rules` |
| Akun posting | `accounts` |
| Role & permission | tabel IAM/permission seed dan admin UI lanjutan |

Jika ada kebutuhan operasional baru yang masih memerlukan edit source, tambahkan dulu titik konfigurasi di DB/UI lalu dokumentasikan di file ini.
