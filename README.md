# Aroadri Tea ERP

Custom ERP untuk PT. Gandha Hill Catering Management Indonesia / Aroadri Tea.

## Ringkas Arsitektur

- `apps/site`: public website + member portal.
- `apps/web`: ERP dashboard + POS PWA.
- `apps/mcp`: MCP server untuk automasi AI dengan permission yang sama seperti UI.
- `apps/worker`: cron, queue, backup, dan pekerjaan background.
- `packages/db`: Drizzle schema, migration, seed.
- `packages/services`: business logic.

Stack utama: Next.js 15, Drizzle, managed PostgreSQL/Neon, Hono MCP, pnpm workspace, Docker.

## Konfigurasi

Secret dan URL deployment tetap di `.env`. Konfigurasi operasional yang tidak rahasia dikelola dari UI/DB:

- POS posting, akun, channel delivery, dan lebar struk: `Settings → POS Settings`.
- Naixer QR, mapping produk/modifier, dan ukuran label 6x4 cm / 4x3 cm: `Settings → Integrations → Naixer KDS`.
- Pajak: `tax_rates` dan `tax_rules`.
- Workflow, custom field, scheduled job, CMS: halaman Settings/CMS terkait.

Contoh environment ada di `.env.example`.

## Development

```bash
pnpm install
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Verifikasi sebelum deploy:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Checklist hardening dan QA deploy ada di `docs/PRODUCTION-READINESS.md`.

## Deployment VPS HestiaCP

HestiaCP biasanya sudah memakai Nginx/Apache di port 80/443. Karena itu, untuk server HestiaCP gunakan compose khusus tanpa container Caddy:

```bash
cd /opt/aroadri-erp/docker
docker compose -f docker-compose.hestiacp.yml --env-file ../.env up -d --build
```

Port lokal yang perlu diproxy dari HestiaCP:

| Domain | Target lokal |
|---|---|
| `aroadritea.com`, `www.aroadritea.com` | `http://127.0.0.1:3000` |
| `erp.aroadritea.com` | `http://127.0.0.1:3001` |
| `mcp.erp.aroadritea.com` | `http://127.0.0.1:3002` |

Langkah HestiaCP:

1. Tambahkan tiga domain di panel HestiaCP.
2. Aktifkan SSL Let's Encrypt untuk semua domain.
3. Aktifkan proxy support dan arahkan tiap domain ke target lokal di tabel.
4. Pastikan firewall hanya membuka 80/443 publik; port 3000-3002 bind ke `127.0.0.1`.
5. Jalankan migration sebelum restart aplikasi:

```bash
cd /opt/aroadri-erp
pnpm --filter @erp/db migrate
```

Jika VPS tidak memakai HestiaCP dan port 80/443 kosong, compose default `docker/docker-compose.yml` dapat dipakai dengan Caddy.

## Health Check

- Public site: `/api/healthz`
- ERP web: `/api/healthz`
- MCP: `/healthz`

Container memakai restart policy dan memory limit sesuai desain 1 vCPU / 2 GB RAM.
