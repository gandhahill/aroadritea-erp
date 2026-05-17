# Runbook — Reset Database Sebelum Seed

Dokumen ini menjelaskan cara me-reset database (drop semua tabel di schema
`public`) lalu menjalankan migrasi + seed dari awal. **Hanya untuk
development / staging**. Untuk produksi, ikuti seksi terakhir.

> ⚠️ Reset **menghapus seluruh data**. Backup dulu kalau ragu.

## TL;DR (development)

```bash
# Dari root repo:
CONFIRM_DB_RESET=YES pnpm --filter @erp/db db:reset:migrate:seed
```

Itu menjalankan, secara berurutan:

1. `tsx packages/db/scripts/reset.ts` → drop & re-create schema `public`.
2. `drizzle-kit migrate` → terapkan seluruh migrasi (`0000_*` … `0010_*`).
3. `tsx packages/db/seed/index.ts` → seed tenant, role, permission, CoA,
   menu, recipes, dll.

Setelah selesai, login dengan akun admin yang di-seed:

| Email | Password |
| --- | --- |
| `admin@aroadritea.com` | (env `SEED_ADMIN_PASSWORD`, default `aroadritea2026`) |

Password dipakai dari env `SEED_ADMIN_PASSWORD` waktu seed. Set sebelum
seed kalau mau ganti:

```bash
SEED_ADMIN_PASSWORD='kata-sandi-yang-kuat' \
CONFIRM_DB_RESET=YES \
pnpm --filter @erp/db db:reset:migrate:seed
```

## Detail per-langkah

### 1. Reset saja (tanpa migrate + seed)

```bash
CONFIRM_DB_RESET=YES pnpm --filter @erp/db db:reset
```

Script: [`packages/db/scripts/reset.ts`](../../packages/db/scripts/reset.ts).
Yang dilakukan secara eksplisit:

```sql
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO public;
```

Script ini **menolak jalan** kalau:

- `CONFIRM_DB_RESET` ≠ `YES` (guard 1).
- `NODE_ENV=production` dan `ALLOW_PROD_DB_RESET` ≠ `1` (guard 2).
- `DATABASE_URL` tidak ada.

Sebelum melakukan apa-apa, script print host dari `DATABASE_URL` —
periksa baris itu sebelum lanjut.

### 2. Migrate saja

```bash
pnpm --filter @erp/db db:migrate
```

Terapkan migrasi yang belum dijalankan. Aman dijalankan berkali-kali
(idempotent).

### 3. Seed saja

```bash
pnpm --filter @erp/db db:seed
```

Seed dirancang **idempotent**: aman dijalankan berkali-kali. Row yang
sudah ada di-`onConflictDoNothing`, kecuali konfigurasi UI-driven yang
sengaja tidak ditimpa supaya admin tidak kehilangan perubahan.

### 4. Generate migrasi baru (kalau habis ubah schema)

```bash
pnpm --filter @erp/db db:generate
```

Akan menulis file SQL baru di `packages/db/migrations/`. Commit file SQL
+ snapshot di `meta/` bersama-sama, lalu jalankan `db:migrate`.

## Backup dulu (recommended)

Neon: gunakan branching (instan, gratis). Branch ke `branch-pre-reset`,
reset di branch utama, kalau ada masalah switch koneksi back ke branch.

Postgres mandiri:

```bash
pg_dump "$DATABASE_URL" > backup-$(date +%Y%m%d-%H%M%S).sql
```

Restore:

```bash
psql "$DATABASE_URL" < backup-2026-05-17-1830.sql
```

## Reset di production

Jangan. Kalau benar-benar harus (mis. setelah pembersihan PoC), butuh:

1. Pengumuman maintenance window.
2. Backup penuh (`pg_dump`) dan verifikasi backup itu bisa di-restore di
   instance lain dulu.
3. Drop POS PWA cache di outlet (uninstall + install ulang) supaya
   localStorage idempotency key tidak menabrak data baru.
4. Jalankan dengan kedua flag:

   ```bash
   NODE_ENV=production \
   ALLOW_PROD_DB_RESET=1 \
   CONFIRM_DB_RESET=YES \
   pnpm --filter @erp/db db:reset:migrate:seed
   ```

5. Re-seed ulang, kemudian uji login + transaksi POS sebelum membuka
   outlet.

## Hubungannya dengan idempotency POS

Sale offline punya `idempotency_key` per outlet. Setelah reset DB, key
lama otomatis tidak punya pasangan. Hapus pending queue di POS PWA via
DevTools → Application → IndexedDB → `pos-offline` → clear, atau biarkan
worker membuangnya saat retry gagal (akan log error tapi tidak crash).

## Troubleshooting

| Gejala | Penyebab umum | Solusi |
| --- | --- | --- |
| `permission denied for schema public` | role bukan owner schema | jalankan `GRANT ALL ON SCHEMA public TO <role>;` |
| `relation already exists` saat migrate | reset gagal sebagian | re-run `db:reset` dulu, baru migrate |
| `DATABASE_URL is not set` | `.env` tidak ke-load | pastikan `.env` di root repo dan `dotenv` baca |
| login gagal setelah seed | password env beda | set `SEED_ADMIN_PASSWORD` lalu re-seed |
