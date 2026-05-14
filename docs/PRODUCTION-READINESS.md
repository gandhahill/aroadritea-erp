# Production Readiness Checklist

Dokumen ini mencatat hasil hardening dan investigasi sebelum deploy production Aroadri Tea ERP.

## Status 2026-05-13

Status: siap staging/VPS setelah migration dijalankan dan secret production diisi.

Perubahan yang sudah diterapkan:

- Konfigurasi operasional POS tidak lagi bergantung pada `.env`; dipindahkan ke tabel `pos_settings` dan UI `Settings -> POS Settings`.
- Login dashboard dapat memilih bahasa `ID/EN/ZH` sebelum submit.
- Login diberi DB-backed rate limit dan audit attempt per email hash/IP, tanpa mewajibkan 2FA.
- Security header ditambahkan di Next.js: CSP, HSTS, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, dan `Permissions-Policy`.
- TLS production dikelola HestiaCP/Let's Encrypt; reverse proxy wajib hanya membuka 80/443 publik.
- Naixer KDS label fleksibel per lokasi/printer: 60x40 mm dan 40x30 mm landscape, dengan preview QR, pickup number, jam pesanan, dan detail produk.
- Lebar struk thermal fleksibel, default 80 mm.
- Scheduled Jobs dan Naixer settings diperketat agar tenant tidak bisa membaca/mengubah data tenant lain.
- Worker outage monitor diarahkan ke port lokal PM2 (`127.0.0.1:3000-3002`).
- Runtime production memakai PM2 dengan HestiaCP sebagai reverse proxy.
- Semua proses PM2 wajib bind loopback `127.0.0.1`, bukan `0.0.0.0`; port 3000-3002 tidak boleh terbuka langsung ke publik.
- Email otomatis memakai mailbox bawaan HestiaCP via SMTP (`SMTP_*`), bukan provider email eksternal default.

## Secret Yang Tetap Wajib `.env`

Hanya secret dan URL deployment yang tetap di environment:

- `DATABASE_URL`
- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL`
- `NEXT_PUBLIC_WEB_URL`
- `NEXT_PUBLIC_SITE_URL`
- `MCP_SERVER_URL`
- Provider secret seperti Turnstile, SMTP HestiaCP, WhatsApp/Twilio.

Setting bisnis harian wajib lewat DB/UI, bukan edit source.

## Checklist Deploy HestiaCP

1. Pull branch/release ke `/home/aroadritea/web/aroadritea.com/public_html/aroadritea-erp`.
2. Isi `.env` production berdasarkan `.env.example`.
3. Buat mailbox HestiaCP untuk email otomatis, misalnya `noreply@aroadritea.com`, lalu isi `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, dan `SMTP_FROM_NAME`.
4. Pastikan DNS email aktif: MX, SPF, DKIM, dan DMARC.
5. Jalankan `pnpm install --frozen-lockfile`.
6. Jalankan `pnpm --filter @erp/db migrate`.
7. Jalankan `pnpm --filter @erp/db seed` untuk bootstrap awal.
8. Jalankan `pnpm build`.
9. Jalankan `pm2 start ecosystem.config.cjs --env production`, `pm2 save`, dan `pm2 startup systemd -u root --hp /root`.
10. Di HestiaCP, proxy:
   - `aroadritea.com` dan `www.aroadritea.com` ke `http://127.0.0.1:3000`
   - `erp.aroadritea.com` ke `http://127.0.0.1:3001`
   - `mcp.erp.aroadritea.com` ke `http://127.0.0.1:3002`
11. Aktifkan Let's Encrypt untuk semua domain.
12. Pastikan firewall publik hanya membuka 80/443.
13. Cek health:
    - `https://aroadritea.com/api/healthz`
    - `https://erp.aroadritea.com/api/healthz`
    - `https://mcp.erp.aroadritea.com/healthz`

## Manual QA Wajib

- Login dengan bahasa ID, EN, dan ZH dari halaman login.
- Gagal login 5 kali dengan akun yang sama dan pastikan request berikutnya diblokir sementara.
- Ubah POS Settings satu lokasi, buat transaksi POS, dan pastikan journal memakai akun/pajak dari setting DB.
- Ubah lebar struk dari 80 mm ke ukuran printer lain dan lakukan test print.
- Ubah Naixer label 60x40 mm dan 40x30 mm, scan QR preview/test print di mesin Naixer.
- Toggle scheduled job dan ubah cron, pastikan hanya tenant aktif yang bisa mengubah.
- Matikan salah satu process PM2 sementara dan pastikan PM2 menghidupkannya kembali.

## Risiko Tersisa

- Belum ada WAF/rate limit global di reverse proxy HestiaCP. Rekomendasi: aktifkan Cloudflare proxy + WAF managed rules di depan domain production.
- 2FA sengaja tidak diwajibkan sesuai requirement user. Untuk akun direktur/admin, 2FA opsional tetap disarankan saat modulnya tersedia.
- Security tidak bisa diklaim absolut; hardening harus dilanjutkan dengan backup restore drill, dependency audit rutin, dan pentest ringan sebelum go-live toko.
