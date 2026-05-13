# Konfigurasi Production & Kustomisasi Tanpa Edit Source

Dokumen ini menjadi referensi operasional untuk hal yang boleh berubah antar toko, channel, pajak, atau deployment. Prinsipnya: perubahan bisnis harian harus lewat database, admin UI, seed, atau environment variable, bukan edit source code.

## Prioritas Sumber Konfigurasi

1. Database: pilihan utama untuk data bisnis yang berubah rutin, seperti `tax_rates`, `accounts`, `custom_field_definitions`, `workflow_definitions`, `scheduled_jobs`, CMS, katalog, lokasi, role, permission, dan mapping integrasi.
2. Environment variable: untuk secret, URL deployment, provider eksternal, dan default operasional saat bootstrap.
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
| `PUBLIC_SITE_TENANT_ID` | Tenant yang dipakai public website untuk membaca menu/CMS. Default `default`. |

## Member Registration

| Variable | Fungsi |
|---|---|
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Site key Cloudflare Turnstile untuk form daftar member. |
| `TURNSTILE_SECRET_KEY` | Secret Turnstile untuk verifikasi server-side. Jika kosong di production, signup ditolak. |
| `RESEND_API_KEY` | API key Resend untuk kirim OTP email. Jika kosong di production, signup ditolak. |
| `MEMBER_OTP_FROM_EMAIL` | Sender email OTP, contoh `Aroadri Tea <member@aroadritea.com>`. |

Di development tanpa `TURNSTILE_SECRET_KEY`, token `dev-token` boleh dipakai. Di production fallback dev ini tidak aktif.

## POS Posting & Pajak

| Variable | Default | Fungsi |
|---|---:|---|
| `POS_PB1_TAX_CODE` | `PB1` | Kode pajak yang dicari di tabel `tax_rates`. Besaran pajak mengikuti DB, bukan angka hardcoded. |
| `POS_CASH_ACCOUNT_CODE` | `1-1030` | Kode akun kas/settlement POS. Service resolve ke `accounts.id`. |
| `POS_REVENUE_ACCOUNT_CODE` | `4-1010` | Kode akun pendapatan penjualan. |
| `POS_DONATION_TRUST_ACCOUNT_CODE` | `2-2050` | Kode akun liabilitas donasi/rounding donation. |
| `POS_DELIVERY_CHANNELS` | `gofood,grabfood,shopeefood` | Channel yang memakai net settlement fee. |
| `POS_DELIVERY_NET_BPS` | `8000` | Basis point net settlement delivery. `8000` berarti 80%. |

Untuk mengubah tarif PB1/PBJT, ubah record `tax_rates.code = POS_PB1_TAX_CODE`. Untuk mengganti akun posting, ubah COA di DB atau override variable akun di deployment.

## Area Kustomisasi DB

| Area | Tabel/UI |
|---|---|
| Custom field | `custom_field_definitions`, halaman Settings Custom Fields |
| Workflow approval | `workflow_definitions`, halaman Workflow Editor |
| Scheduled job | `scheduled_jobs`, halaman Scheduled Jobs |
| Integrasi Naixer/KDS | tabel konfigurasi Naixer, halaman Settings Integrations |
| CMS public website | tabel CMS dan halaman CMS |
| Pajak | `tax_rates`, `tax_rules` |
| Akun posting | `accounts` |
| Role & permission | tabel IAM/permission seed dan admin UI lanjutan |

Jika ada kebutuhan operasional baru yang masih memerlukan edit source, tambahkan dulu titik konfigurasi di DB atau environment lalu dokumentasikan di file ini.
