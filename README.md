# Aroadri Tea ERP

Custom ERP untuk PT. Gandha Hill Catering Management Indonesia / Aroadri Tea.

Stack utama: Next.js 15, Drizzle ORM, managed PostgreSQL/Neon, Hono MCP, pnpm workspace, PM2, dan HestiaCP untuk reverse proxy VPS.

## 1. Struktur Aplikasi

| Path | Fungsi |
|---|---|
| `apps/site` | Public website dan member portal. |
| `apps/web` | ERP dashboard dan POS PWA. |
| `apps/mcp` | MCP server untuk automasi AI dengan permission yang sama seperti UI. |
| `apps/worker` | Cron, queue, outage monitor, backup, dan job background. |
| `packages/db` | Drizzle schema, migration, seed. |
| `packages/services` | Business logic. |
| `packages/shared` | Shared utilities, Result type, money/date/id helpers. |

## 2. Prasyarat

Local development:

- Node.js 20 atau lebih baru. Production VPS direkomendasikan memakai Node.js 22 LTS.
- pnpm 9.15.4 via Corepack.
- Git.
- PostgreSQL managed, direkomendasikan Neon.

VPS production:

- Ubuntu/Debian dengan HestiaCP.
- Node.js 20+ dan PM2.
- Minimal sesuai desain: 1 vCPU, 2 GB RAM, 60 GB disk.
- Domain mengarah ke IP VPS:
  - `aroadritea.com`
  - `www.aroadritea.com`
  - `erp.aroadritea.com`
  - MCP remote health memakai path `https://erp.aroadritea.com/mcp/healthz`. Subdomain bertingkat seperti `mcp.erp.aroadritea.com` hanya dipakai jika DNS/SSL memang mendukungnya.

## 3. Setup Local Development

1. Clone repository.

```bash
git clone <REPO_URL> aroadri-erp
cd aroadri-erp
```

2. Aktifkan pnpm.

```bash
corepack enable
corepack prepare pnpm@9.15.4 --activate
```

3. Install dependency.

```bash
pnpm install
```

4. Buat file `.env`.

```bash
cp .env.example .env
```

Di Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

5. Isi minimal `.env` local.

```env
DATABASE_URL="postgresql://..."
BETTER_AUTH_SECRET="change-this-local-secret"
BETTER_AUTH_URL="http://localhost:3001"
NEXT_PUBLIC_WEB_URL="http://localhost:3001"
NEXT_PUBLIC_SITE_URL="http://localhost:3000"
MCP_SERVER_URL="http://localhost:3002"
```

Opsional untuk membuat admin pertama saat seed:

```env
SEED_ADMIN_EMAIL="admin@aroadritea.com"
SEED_ADMIN_PASSWORD="<minimal-12-karakter>"
SEED_ADMIN_NAME="Aroadri Admin"
```

6. Generate dan jalankan migration.

```bash
pnpm db:generate
pnpm db:migrate
```

7. Seed data awal.

```bash
pnpm db:seed
```

8. Jalankan development server.

```bash
pnpm dev
```

Default port:

| App | URL |
|---|---|
| Public site | `http://localhost:3000` |
| ERP web/POS | `http://localhost:3001` |
| MCP | `http://localhost:3002` |

## 4. Konfigurasi Tanpa Edit Source

Secret dan URL deployment tetap di `.env`. Konfigurasi operasional yang tidak rahasia dikelola dari UI/DB.

| Area | Lokasi konfigurasi |
|---|---|
| POS posting, akun, channel delivery, lebar struk | `Settings -> POS Settings` |
| Naixer QR, mapping produk/modifier, ukuran label 6x4 cm dan 4x3 cm | `Settings -> Integrations -> Naixer KDS` |
| Pajak | `tax_rates`, `tax_rules` |
| Workflow approval | `Settings -> Workflow Editor` |
| Custom field | `Settings -> Custom Fields` |
| Scheduled jobs | `Settings -> Scheduled Jobs` |
| CMS website | Menu `CMS` |
| Role dan permission | Tabel IAM/permission, UI lanjutan menyusul |

Detail konfigurasi ada di `docs/CONFIGURATION.md`.

## 5. Verifikasi Sebelum Deploy

Jalankan dari root repository:

```bash
pnpm lint
pnpm typecheck
pnpm test
```

Build penuh root bisa berat di Windows karena `site` dan `web` sama-sama Next.js. Untuk diagnosis yang lebih jelas, build per app:

```bash
pnpm --filter @erp/mcp build
pnpm --filter @erp/worker build
pnpm --filter @erp/site build
pnpm --filter @erp/web build
```

Checklist hardening dan QA production ada di `docs/PRODUCTION-READINESS.md`.

## 6. Deploy Ke VPS HestiaCP

HestiaCP biasanya sudah memakai Nginx/Apache di port 80/443. Runtime production sekarang memakai PM2, bukan Docker Compose, agar lebih sederhana di VPS HestiaCP.

### 6.1 Persiapan VPS

1. Login ke VPS.

```bash
ssh root@<IP_VPS>
```

2. Install Node.js 22 LTS, pnpm, dan PM2 jika belum ada.

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs
corepack enable
corepack prepare pnpm@9.15.4 --activate
npm install -g pm2
node -v
pnpm -v
pm2 -v
```

3. Untuk VPS 2 GB RAM, aktifkan swap jika belum ada.

```bash
swapon --show
fallocate -l 4G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

Lewati pembuatan swap jika `swapon --show` sudah menampilkan swap aktif.

### 6.2 Ambil Source Code

1. Buat folder aplikasi.

```bash
mkdir -p /home/aroadritea/web/aroadritea.com/public_html/aroadritea-erp
cd /home/aroadritea/web/aroadritea.com/public_html/aroadritea-erp
```

2. Clone atau pull repository.

```bash
git clone <REPO_URL> .
git checkout main
git pull --ff-only
```

3. Install dependency.

```bash
pnpm install --frozen-lockfile
```

### 6.3 Buat `.env` Production

1. Salin template.

```bash
cp .env.example .env
nano .env
```

2. Isi variable wajib.

```env
DATABASE_URL="postgresql://..."
BETTER_AUTH_SECRET="<random-secret-strong>"
BETTER_AUTH_URL="https://erp.aroadritea.com"
NEXT_PUBLIC_WEB_URL="https://erp.aroadritea.com"
NEXT_PUBLIC_SITE_URL="https://aroadritea.com"
MCP_SERVER_URL="https://erp.aroadritea.com/mcp"
```

3. Isi secret provider jika fitur terkait dipakai.

```env
NEXT_PUBLIC_TURNSTILE_SITE_KEY="..."
TURNSTILE_SECRET_KEY="..."
SMTP_HOST="mail.aroadritea.com"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="noreply@aroadritea.com"
SMTP_PASS="<password-mailbox-hestiacp>"
SMTP_FROM="noreply@aroadritea.com"
SMTP_FROM_NAME="Aroadri Tea"
```

Jika production belum punya user admin, isi sementara `SEED_ADMIN_PASSWORD` sebelum `pnpm db:seed`, lalu hapus/kosongkan lagi setelah admin berhasil login dan password diganti.

4. Generate secret kuat untuk `BETTER_AUTH_SECRET`.

```bash
openssl rand -hex 32
```

Jangan commit `.env`.

### 6.4 Buat Mailbox HestiaCP Untuk Email Otomatis

Email otomatis seperti OTP member dan notifikasi outage memakai mailbox bawaan HestiaCP via SMTP.

1. Buka panel HestiaCP.
2. Masuk ke menu `Mail`.
3. Tambahkan mail domain `aroadritea.com` jika belum ada.
4. Buat mailbox khusus, misalnya `noreply@aroadritea.com`.
5. Simpan password mailbox ke `.env` sebagai `SMTP_PASS`.
6. Gunakan SMTP berikut:
   - Host: `mail.aroadritea.com`
   - Port: `587`
   - Secure: `false` untuk STARTTLS
   - User: alamat mailbox lengkap, contoh `noreply@aroadritea.com`
7. Pastikan DNS email domain aktif:
   - MX mengarah ke mail server HestiaCP.
   - SPF mengizinkan server HestiaCP mengirim email.
   - DKIM aktif dari HestiaCP.
   - DMARC minimal `p=none` saat awal, lalu naikkan setelah deliverability stabil.

### 6.5 Jalankan Migration Dan Seed

```bash
cd /home/aroadritea/web/aroadritea.com/public_html/aroadritea-erp
pnpm db:migrate
pnpm db:seed
```

Untuk deploy berikutnya, jalankan `pnpm db:migrate` sebelum reload PM2. Jalankan `pnpm db:seed` hanya bila ada seed idempotent baru yang perlu masuk.

### 6.6 Build Dan Jalankan PM2

Build semua app:

```bash
cd /home/aroadritea/web/aroadritea.com/public_html/aroadritea-erp
pnpm build
```

Jalankan proses via PM2:

```bash
pm2 start ecosystem.config.cjs --env production
pm2 save
pm2 startup systemd -u root --hp /root
```

Jika output `pm2 startup` menampilkan command tambahan, jalankan command tersebut sekali.

Lihat status proses:

```bash
pm2 status
pm2 logs --lines 100
```

### 6.7 Atur Domain Di HestiaCP

1. Buka panel HestiaCP.
2. Tambahkan domain:
   - `aroadritea.com`
   - `www.aroadritea.com`
   - `erp.aroadritea.com`
3. Aktifkan SSL Let's Encrypt untuk semua domain.
4. Aktifkan proxy support.
5. Arahkan reverse proxy ke target lokal berikut.

| Domain / path | Target lokal |
|---|---|
| `aroadritea.com` | `http://127.0.0.1:3000` |
| `www.aroadritea.com` | `http://127.0.0.1:3000` |
| `erp.aroadritea.com` | `http://127.0.0.1:3001` |
| `erp.aroadritea.com/mcp/` | `http://127.0.0.1:3002/` |

PM2 wajib bind ke loopback `127.0.0.1` untuk port 3000-3002. Jangan bind ke `0.0.0.0` dan jangan buka port tersebut ke publik; akses luar tetap lewat reverse proxy HestiaCP.

Reverse proxy harus meneruskan host publik agar redirect Next.js tidak berubah menjadi `localhost`:

```nginx
proxy_set_header Host $host;
proxy_set_header X-Forwarded-Host $host;
proxy_set_header X-Forwarded-Proto $scheme;
proxy_set_header X-Forwarded-Port 443;
```

Catatan Cloudflare: Universal SSL wildcard `*.aroadritea.com` tidak mencakup subdomain bertingkat `mcp.erp.aroadritea.com`. Gunakan path `/mcp/` di `erp.aroadritea.com`, atau buat `mcp.aroadritea.com`, atau aktifkan Advanced Certificate/DNS-only bila ingin subdomain MCP terpisah.

### 6.8 Firewall

Pastikan hanya port publik yang diperlukan terbuka.

```bash
ufw status
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 22/tcp
ufw enable
```

Jangan buka port 3000, 3001, atau 3002 ke publik.

## 7. Health Check Setelah Deploy

Tes dari VPS:

```bash
curl -fsS http://127.0.0.1:3000/api/healthz
curl -fsS http://127.0.0.1:3001/api/healthz
curl -fsS http://127.0.0.1:3002/healthz
```

Tes dari internet:

```bash
curl -fsS https://aroadritea.com/api/healthz
curl -fsS https://erp.aroadritea.com/api/healthz
curl -fsS https://erp.aroadritea.com/mcp/healthz
```

Jika salah satu gagal:

```bash
pm2 status
pm2 logs <service> --lines 200
```

Nama service: `aroadri-site`, `aroadri-web`, `aroadri-mcp`, `aroadri-worker`.

## 8. Setup Awal Setelah Login

1. Login ke `https://erp.aroadritea.com`.
2. Pilih bahasa di halaman login.
3. Buka `Settings -> POS Settings`.
4. Cek akun posting, channel delivery, PB1/PBJT, dan lebar struk. Default lebar struk adalah 80 mm.
5. Buka `Settings -> Integrations -> Naixer KDS`.
6. Pilih ukuran label per lokasi/printer:
   - 60x40 mm untuk label 6x4 cm.
   - 40x30 mm untuk label 4x3 cm.
7. Test print label dan scan QR di mesin Naixer.
8. Buka `Settings -> Scheduled Jobs` dan pastikan job penting aktif.
9. Buka CMS untuk isi konten public website.

## 9. Update Aplikasi Production

1. Masuk ke folder aplikasi.

```bash
cd /home/aroadritea/web/aroadritea.com/public_html/aroadritea-erp
```

2. Ambil perubahan terbaru.

```bash
git fetch origin
git checkout main
git pull --ff-only
```

3. Install dependency jika lockfile berubah.

```bash
pnpm install --frozen-lockfile
```

4. Jalankan migration.

```bash
pnpm db:migrate
```

5. Build ulang dan reload PM2.

```bash
pnpm build
pm2 reload ecosystem.config.cjs --env production --update-env
pm2 save
```

6. Cek log dan health.

```bash
pm2 status
curl -fsS https://erp.aroadritea.com/api/healthz
```

## 10. Rollback Singkat

1. Cari commit terakhir yang stabil.

```bash
git log --oneline -10
```

2. Checkout commit stabil.

```bash
git checkout <COMMIT_STABIL>
```

3. Build ulang dan reload PM2.

```bash
pnpm build
pm2 reload ecosystem.config.cjs --env production --update-env
```

Rollback database tidak otomatis. Jika migration sudah mengubah schema/data production, restore dari backup managed PostgreSQL/Neon sesuai prosedur provider.

## 11. Troubleshooting

PM2 process tidak sehat:

```bash
pm2 status
pm2 logs aroadri-web --lines 200
pm2 logs aroadri-site --lines 200
pm2 logs aroadri-mcp --lines 200
pm2 logs aroadri-worker --lines 200
```

Migration gagal:

```bash
pnpm --filter @erp/db migrate
```

Periksa `DATABASE_URL`, koneksi Neon, dan apakah migration sudah pernah dijalankan.

Login bermasalah:

- Pastikan `BETTER_AUTH_SECRET` terisi dan tidak berubah antar restart.
- Pastikan `BETTER_AUTH_URL=https://erp.aroadritea.com`.
- Pastikan cookie production dikirim via HTTPS.

Public site atau ERP 502 dari HestiaCP:

- Cek proses PM2 berjalan.
- Cek target proxy HestiaCP mengarah ke `127.0.0.1`.
- Cek port lokal dengan `curl http://127.0.0.1:<port>/api/healthz`.

## 12. Catatan Production

- Gunakan managed PostgreSQL/Neon agar VPS 2 GB fokus menjalankan app.
- Jangan simpan secret di repo.
- Aktifkan backup harian database dari provider.
- Untuk keamanan lebih tinggi, pasang Cloudflare proxy/WAF di depan HestiaCP.
- 2FA tidak diwajibkan sesuai requirement, tetapi akun direktur/admin sebaiknya memakai 2FA opsional saat modul tersedia.
