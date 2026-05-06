# ADR-0002: Monorepo + Pemisahan Aplikasi (site / web / mcp / worker)

- **Status**: Accepted
- **Tanggal**: 2026-05-05
- **Pengambil keputusan**: Lintang Maulana Zulfan
- **Konteks bisnis**: SOURCE-OF-TRUTH §17.4 (Persyaratan Deployment), §22 (Public Website + CMS + Membership)
- **Konteks teknis**: SYSTEM-DESIGN §4 (Arsitektur Tingkat Tinggi), §6 (Repository Layout), §32 (Domain & Routing)

## Konteks

User menginginkan dua surface web utama:
1. **Website publik** di `aroadritea.com` — etalase merek, blog, lokasi, **registrasi membership online**, akun member.
2. **Sistem ERP** di `erp.aroadritea.com` — semua modul backoffice (akuntansi, inventory, POS, dll.), login wajib.

Plus surface tambahan: **MCP server** (untuk AI lokal) dan **worker** (cron + queue).

Pertanyaan: bagaimana mengorganisir kode? Pilihan:

- (A) Satu Next.js app dengan multiple route groups, satu deployable.
- (B) Monorepo dengan beberapa app terpisah (site, web, mcp, worker) berbagi `packages/services` + `packages/db`.
- (C) Repo terpisah per app.

Selain itu: ada constraint memori 2 GB RAM (lihat ADR-0001).

## Keputusan

**Memilih (B) — Monorepo dengan empat app terpisah** + shared packages:

```
apps/
├── site/      → aroadritea.com (Next.js, public)
├── web/       → erp.aroadritea.com (Next.js + PWA, ERP)
├── mcp/       → mcp.erp.aroadritea.com (Hono, MCP server)
└── worker/    → background jobs (Node)

packages/
├── db/        → Drizzle schema + migrations
├── services/  → business logic (semua modul)
├── shared/    → types, errors, money, ports
├── ui/        → shared UI components ERP
└── ui-public/ → shared UI components website publik
```

Manager workspace: **pnpm workspaces** (disk-efficient, penting di disk 60 GB).

**Aturan ketat dependency** (lihat SYSTEM-DESIGN §6.4):
- `apps/site` hanya boleh memanggil whitelist services: `cms.*`, `member.*`, `inventory.publicListProducts`, `iam.publicGetLocations`, `crm.publicLogComplaint`. Tidak bisa akses `accounting`, `pos`, `purchasing`, `payroll`, `hr`.
- `apps/site` ↔ `apps/web` **tidak ada panggilan HTTP langsung**. Komunikasi via DB / shared services.
- Semua app konsumsi `packages/services` in-process.

## Alternatif yang Dipertimbangkan

### A. Single Next.js App, Multiple Route Groups
Contoh: `aroadritea.com/` → publik, `aroadritea.com/erp` → ERP, dengan middleware switching.

- Pros:
  - Satu deploy, satu image, satu bundle.
  - Footprint memori lebih kecil (~250 MB vs ~500 MB total).
  - Tidak perlu Caddy multi-vhost.
- Cons:
  - **Surface keamanan campur**: bug di kode publik bisa mempengaruhi ERP (mis. SSR pinggiran rendering data internal).
  - **Bundle JS publik** akan termasuk kode admin yang tidak perlu (JS lebih besar untuk pelanggan).
  - **Cookie sesi sama domain**: lebih rentan terhadap CSRF antar-zona; perlu policy ketat.
  - **Cache strategy bertabrakan**: publik butuh CDN aggressive cache; ERP butuh no-cache.
  - **i18n routing**: publik butuh `/id`, `/en`, `/zh` di root; ERP routing dashboard sudah punya struktur sendiri — mempersulit.
  - **Nama domain**: tidak bisa mendapat SEO terpisah `aroadritea.com` (publik) vs `erp.aroadritea.com` (private).
- **Ditolak**, kecuali untuk fallback bila staging menunjukkan stress memori > 80% (lihat ADR-0002 fallback).

### C. Repository Terpisah per App
- Pros: Isolasi maksimal.
- Cons:
  - Sulit share `services` dan types — duplikasi atau mempublikasikan paket internal (overhead besar untuk dev solo).
  - PR lintas-repo (mis. menambah field di DB & UI) merepotkan.
  - CI/CD lebih kompleks.
- **Ditolak**.

## Konsekuensi

### Positif
- **Pemisahan keamanan**: bug di marketing site tidak menyentuh ERP.
- **Bundle terpisah**: pelanggan publik unduh JS ringan; staf ERP unduh JS lengkap.
- **Cache strategy independent**: site → SSG/ISR + Cloudflare; web → no-cache + auth.
- **Cookie isolation**: cookie member di `aroadritea.com`, cookie staff di `erp.aroadritea.com` — tidak saling terlihat.
- **Domain & SEO bersih**: marketing site memiliki domain root yang ramah SEO.
- **Iterasi paralel**: mengubah CMS tidak butuh deploy ulang ERP, dan sebaliknya.
- **Shared services in-process**: tidak ada penalti latency vs option (C).

### Negatif / Trade-off
- **Memori naik ~200–300 MB** karena 2 proses Next.js (site + web). Mitigasi: target memori per proses ditetapkan ketat di SYSTEM-DESIGN §4.3. **Fallback rule**: bila staging memori > 800 MB total, fold `apps/site` ke dalam `apps/web` (tetap di domain berbeda via Caddy proxy host-rewrite).
- **Build time meningkat**: dua Next.js build di CI. Mitigasi: cache pnpm + Next.js build cache di GitHub Actions.
- **Konfigurasi Caddy multi-vhost**: lebih banyak baris di Caddyfile. Tidak signifikan.
- **Coordinated migrations**: migrasi DB harus jalan sebelum kedua app start (pre-deploy job).

### Neutral
- **Worker dan MCP** tetap proses ringan; menambah komplexitas marginal.
- **Worktree untuk dev**: bisa pakai `pnpm dev --filter=site` atau `--filter=web` untuk fokus saat dev.

## Konsekuensi Khusus untuk AI Developer

- **Saat membuat fitur baru**: tentukan dulu — fitur ini di `apps/site`, `apps/web`, atau keduanya?
- Bila keduanya → service-nya di `packages/services/<module>`; UI dibuat di app yang sesuai.
- **Larangan**: jangan menambahkan kode service (business logic) di dalam folder `apps/*` — selalu di `packages/services/*`.
- **Larangan**: jangan menambahkan call HTTP `apps/site → apps/web` atau sebaliknya — gunakan service in-process.

## Referensi

- Trivedi & Patel (2026), "JAMstack Architecture: Benefits of Decoupled Frontend-Backend Architecture for Modern Restaurant Web Applications" — bukti empiris pemisahan front-end/back-end di domain restoran.
- Tramullas, J. (2020), "Elaboración de productos de información con JAMstack: del sistema de gestión de contenidos al web estático", *El Profesional de la Información Anuario ThinkEPI*, 14 — referensi JAMstack & static site generators.
- Katipoğlu et al. (2024), "Action Research Approach to Analysis of Teaching of Blockchain Web 3.0 Application Based on MACH Architecture" — referensi MACH (Microservices, API-first, Cloud-native, Headless).
- ADR-0001 (Pilihan Stack)
- SYSTEM-DESIGN.md §4, §6, §32

## Tindak Lanjut
- [ ] Setelah scaffolding: jalankan benchmark memori puncak per proses di staging.
- [ ] Bila memori puncak total > 800 MB → aktifkan fallback (fold site ke web).
