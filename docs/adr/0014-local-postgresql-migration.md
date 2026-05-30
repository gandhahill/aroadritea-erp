# ADR-0014: Local PostgreSQL Migration

- **Status**: Accepted
- **Tanggal**: 2026-05-30
- **Pengambil keputusan**: Lintang Maulana Zulfan (via AI assistant)
- **Konteks bisnis**: Beban database Neon mencapai limit penggunaan gratis.
- **Konteks teknis**: Migrasi dari Managed DB (Neon) ke self-hosted PostgreSQL di VPS.

## Konteks

Sesuai `ADR-0001`, pilihan awal adalah database managed dari Neon untuk menghemat penggunaan RAM pada VPS (2 GB). Namun, batas penggunaan Neon telah terpenuhi. Meng-upgrade Neon berarti biaya tambahan bulanan. Karena VPS telah di-upgrade dari 1 GB ke 2 GB RAM, opsi untuk melakukan *self-hosting* PostgreSQL menjadi lebih layak (meskipun mepet).

## Keputusan

Kita memindahkan database ke PostgreSQL yang di-install langsung secara lokal di dalam VPS (Ubuntu 24.04). Hal ini mengubah topologi database dari managed cloud ke server lokal.
Drizzle ORM diubah menggunakan konektor PostgreSQL standar (`postgres` atau `pg`) sebagai pengganti `@neondatabase/serverless`.

## Konsekuensi

### Positif
- **Biaya**: Tidak ada biaya tambahan untuk managed database cloud.
- **Latensi**: Karena database berada dalam *local host* yang sama dengan server aplikasi, latensi request antar node menjadi hampir 0 (sangat cepat).

### Negatif / Trade-off
- **Beban RAM**: PostgreSQL akan mengonsumsi RAM dari server. Perlu pengaturan (`shared_buffers = 128MB`, `work_mem = 4MB`) agar tidak memicu OOM killer dan merusak *service* PM2.
- **Operasional/Pemeliharaan**: Tanggung jawab *backup*, replikasi, dan perbaikan saat database *corrupt* kini beralih kepada developer lokal (user) sepenuhnya.

## Tindak Lanjut
- [x] Instalasi PostgreSQL lokal dengan konfigurasi memori khusus di VPS.
- [x] Migrasi dan ekspor struktur dan data dari Neon via `pg_dump`.
- [x] Update aplikasi untuk menggunakan paket `postgres` alih-alih Neon HTTP driver.
