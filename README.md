# Aroadri Tea ERP

Custom ERP untuk PT. Gandha Hill Catering Management Indonesia / Aroadri Tea.

Stack utama: Next.js 15, Drizzle ORM, managed PostgreSQL/Neon, Hono MCP, pnpm workspace, Docker, dan HestiaCP untuk reverse proxy VPS.

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

- Node.js 20 atau lebih baru. Dockerfile production memakai Node.js 22.
- pnpm 9.15.4 via Corepack.
- Git.
- PostgreSQL managed, direkomendasikan Neon.

VPS production:

- Ubuntu/Debian dengan HestiaCP.
- Docker Engine dan Docker Compose plugin.
- Minimal sesuai desain: 1 vCPU, 2 GB RAM, 60 GB disk.
- Domain mengarah ke IP VPS:
  - `aroadritea.com`
  - `www.aroadritea.com`
  - `erp.aroadritea.com`
  - `mcp.erp.aroadritea.com`

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

HestiaCP biasanya sudah memakai Nginx/Apache di port 80/443. Karena itu gunakan `docker/docker-compose.hestiacp.yml`, bukan compose default dengan Caddy.

### 6.1 Persiapan VPS

1. Login ke VPS.

```bash
ssh root@<IP_VPS>
```

2. Install Docker jika belum ada.

```bash
curl -fsSL https://get.docker.com | sh
systemctl enable --now docker
docker version
docker compose version
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
mkdir -p /opt/aroadri-erp
cd /opt/aroadri-erp
```

2. Clone atau pull repository.

```bash
git clone <REPO_URL> .
git checkout main
git pull --ff-only
```

3. Aktifkan pnpm di VPS untuk migration dan seed.

```bash
corepack enable
corepack prepare pnpm@9.15.4 --activate
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
MCP_SERVER_URL="https://mcp.erp.aroadritea.com"
```

3. Isi secret provider jika fitur terkait dipakai.

```env
NEXT_PUBLIC_TURNSTILE_SITE_KEY="..."
TURNSTILE_SECRET_KEY="..."
RESEND_API_KEY="..."
MEMBER_OTP_FROM_EMAIL="Aroadri Tea <member@aroadritea.com>"
```

4. Generate secret kuat untuk `BETTER_AUTH_SECRET`.

```bash
openssl rand -hex 32
```

Jangan commit `.env`.

### 6.4 Jalankan Migration Dan Seed

```bash
cd /opt/aroadri-erp
pnpm db:migrate
pnpm db:seed
```

Untuk deploy berikutnya, jalankan `pnpm db:migrate` sebelum restart container. Jalankan `pnpm db:seed` hanya bila ada seed idempotent baru yang perlu masuk.

### 6.5 Jalankan Container

Rekomendasi production adalah memakai image yang sudah dibuild CI/GitHub Container Registry. Jika image belum tersedia, compose dapat build di VPS, tetapi pastikan swap aktif.

Build langsung di VPS:

```bash
cd /opt/aroadri-erp
docker compose -f docker/docker-compose.hestiacp.yml --env-file .env up -d --build
```

Jika image sudah tersedia di registry:

```bash
cd /opt/aroadri-erp
docker compose -f docker/docker-compose.hestiacp.yml --env-file .env pull
docker compose -f docker/docker-compose.hestiacp.yml --env-file .env up -d
```

Lihat status container:

```bash
docker compose -f docker/docker-compose.hestiacp.yml ps
docker compose -f docker/docker-compose.hestiacp.yml logs -f --tail=100
```

### 6.6 Atur Domain Di HestiaCP

1. Buka panel HestiaCP.
2. Tambahkan domain:
   - `aroadritea.com`
   - `www.aroadritea.com`
   - `erp.aroadritea.com`
   - `mcp.erp.aroadritea.com`
3. Aktifkan SSL Let's Encrypt untuk semua domain.
4. Aktifkan proxy support.
5. Arahkan reverse proxy ke target lokal berikut.

| Domain | Target lokal |
|---|---|
| `aroadritea.com` | `http://127.0.0.1:3000` |
| `www.aroadritea.com` | `http://127.0.0.1:3000` |
| `erp.aroadritea.com` | `http://127.0.0.1:3001` |
| `mcp.erp.aroadritea.com` | `http://127.0.0.1:3002` |

Container sengaja bind ke `127.0.0.1`, jadi port 3000-3002 tidak terbuka publik.

### 6.7 Firewall

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
curl -fsS https://mcp.erp.aroadritea.com/healthz
```

Jika salah satu gagal:

```bash
docker compose -f docker/docker-compose.hestiacp.yml ps
docker compose -f docker/docker-compose.hestiacp.yml logs --tail=200 <service>
```

Nama service: `site`, `web`, `mcp`, `worker`.

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
cd /opt/aroadri-erp
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

5. Rebuild/restart container.

```bash
docker compose -f docker/docker-compose.hestiacp.yml --env-file .env up -d --build
```

6. Cek log dan health.

```bash
docker compose -f docker/docker-compose.hestiacp.yml ps
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

3. Rebuild container.

```bash
docker compose -f docker/docker-compose.hestiacp.yml --env-file .env up -d --build
```

Rollback database tidak otomatis. Jika migration sudah mengubah schema/data production, restore dari backup managed PostgreSQL/Neon sesuai prosedur provider.

## 11. Troubleshooting

Container tidak sehat:

```bash
docker compose -f docker/docker-compose.hestiacp.yml logs --tail=200 web
docker compose -f docker/docker-compose.hestiacp.yml logs --tail=200 site
docker compose -f docker/docker-compose.hestiacp.yml logs --tail=200 mcp
docker compose -f docker/docker-compose.hestiacp.yml logs --tail=200 worker
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

- Cek container berjalan.
- Cek target proxy HestiaCP mengarah ke `127.0.0.1`.
- Cek port container lokal dengan `curl http://127.0.0.1:<port>/api/healthz`.

## 12. Catatan Production

- Gunakan managed PostgreSQL/Neon agar VPS 2 GB fokus menjalankan app.
- Jangan simpan secret di repo.
- Aktifkan backup harian database dari provider.
- Untuk keamanan lebih tinggi, pasang Cloudflare proxy/WAF di depan HestiaCP.
- 2FA tidak diwajibkan sesuai requirement, tetapi akun direktur/admin sebaiknya memakai 2FA opsional saat modul tersedia.
