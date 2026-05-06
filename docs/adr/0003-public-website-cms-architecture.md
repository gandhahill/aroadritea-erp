# ADR-0003: Arsitektur Public Website + CMS (Custom CMS, JAMstack ISR)

- **Status**: Accepted
- **Tanggal**: 2026-05-05
- **Pengambil keputusan**: Lintang Maulana Zulfan
- **Konteks bisnis**: SOURCE-OF-TRUTH §22 (Public Website + CMS + Membership)
- **Konteks teknis**: SYSTEM-DESIGN §31 (Public Website + CMS + Member Portal)

## Konteks

User memerlukan website publik (`aroadritea.com`) sebagai etalase merek dan kanal akuisisi member. User secara eksplisit meminta **CMS** sehingga manajemen dan tim marketing dapat memperbarui konten (halaman, blog, banner, FAQ) **tanpa edit source code** dan **tanpa deploy**.

Constraint:
- Halaman publik harus **cepat** (Lighthouse ≥ 90, LCP < 2.5 s).
- Multi-bahasa **ID/EN/ZH** sejak awal.
- SEO penting (kompetisi dengan Chagee, Molly Tea).
- **Hemat memori**: server VPS 1 GB RAM, sudah dibebani ERP + MCP + worker.
- **Tidak ada budget** untuk SaaS CMS berbayar.
- Konten produk + lokasi sudah tinggal di ERP — duplikasi ke CMS terpisah akan menimbulkan masalah konsistensi.

Pertanyaan: bagaimana mengimplementasikan website + CMS?

## Keputusan

**Custom CMS internal** yang merupakan modul ERP (`packages/services/cms`), dengan UI admin di `erp.aroadritea.com/cms` dan rendering publik di `apps/site` (Next.js JAMstack ISR).

### Karakteristik
1. **Konten disimpan di PostgreSQL yang sama** dengan ERP (schema `cms`).
2. **Apps/site** adalah Next.js dengan strategi rendering:
   - Halaman beranda, menu, tentang, lokasi, blog index → **SSG saat build** + **ISR on-demand** (revalidate via webhook saat publish).
   - Halaman blog detail → **ISR** dengan path `/blog/[slug]`.
   - Halaman member portal → **client-side rendered** (auth required).
3. **Block-based content**: setiap halaman/posting tersimpan sebagai array blok JSON (`hero`, `rich_text`, `product_grid`, `location_map`, `image`, `cta`). Tipe blok terbatas (whitelist), divalidasi dengan Zod.
4. **CMS UI di ERP**: editor blok di `apps/web /cms/`, dengan akses RBAC permission `cms.page.edit`, `cms.post.publish`, dst.
5. **Workflow editorial**: `draft → review → published → archived`, dengan opsi schedule publish dan revision history (`cms_revisions`).
6. **Multi-bahasa**: setiap field konten teks di-store sebagai `LocaleString jsonb` (`{ id, en, zh }`).
7. **Cloudflare CDN** di depan VPS untuk caching agresif halaman publik.
8. **Produk & lokasi** dibaca read-only oleh `apps/site` dari `packages/services/inventory.publicListProducts({ is_published: true })` dan `packages/services/iam.publicGetLocations()`. Tidak duplikasi data.

### Skema Tabel Inti CMS (lihat SYSTEM-DESIGN §31.2)
- `cms_pages`, `cms_posts`, `cms_banners`, `cms_faqs`, `cms_settings`, `cms_revisions`.
- Kolom audit + soft delete + tenant_id + locale-aware seperti tabel lain.

## Alternatif yang Dipertimbangkan

### A. Headless CMS Eksternal (Sanity, Strapi self-host, Payload CMS, Directus)
- Pros: Editor matang, fitur lengkap (asset DAM, role, preview).
- Cons:
  - **Sanity berbayar** untuk fitur lengkap; free tier terbatas seat & request.
  - **Strapi/Payload self-host**: butuh Node process tambahan + DB tambahan atau schema sendiri → memori +150–300 MB. Tidak masuk di VPS 1 GB.
  - **Directus** lebih ringan tapi tetap proses tambahan.
  - **Auth & RBAC duplikasi**: CMS punya user-nya sendiri, ERP punya user-nya sendiri → ribet.
  - **Konten produk duplikasi**: produk sudah di ERP, harus sync ke CMS atau pakai source-of-truth split.
- **Ditolak** karena memori dan duplikasi data.

### B. Static Site dengan Markdown + Git Editor (Astro / Eleventy)
- Pros: Sangat ringan, performa tinggi.
- Cons:
  - **User non-teknis tidak bisa edit lewat git**.
  - Tim marketing harus belajar Markdown + git workflow → friction tinggi.
  - Tidak ada workflow review/publish/schedule.
- **Ditolak** karena requirement "edit tanpa edit source code dan tanpa deploy".

### C. WordPress
- Pros: Familiar untuk marketing.
- Cons:
  - PHP runtime tambahan; memori +200 MB; permukaan keamanan luas (plugin vulnerable).
  - Multi-bahasa via WPML / Polylang berbayar atau ribet.
  - Tema WordPress default bukan "premium tea brand".
  - Tidak terintegrasi dengan ERP — duplikasi user, konten produk, dll.
- **Ditolak**.

### D. CMS di-bake ke `apps/web` saja (tanpa `apps/site`)
Yaitu: rendering halaman publik dari ERP itu sendiri.

- Pros: Memori lebih hemat (1 Next.js process).
- Cons:
  - ERP dan publik di domain yang sama → masalah cookie, CSP, SEO, cache.
  - Bundle JS publik membawa kode admin → halaman lambat.
- **Ditolak**, kecuali sebagai fallback memori (lihat ADR-0002).

## Konsekuensi

### Positif
- **Konsistensi data**: produk, lokasi, harga selalu sync dengan ERP — tidak ada duplikasi.
- **Auth & RBAC tunggal**: editor CMS adalah user ERP dengan permission tertentu. Tidak ada akun ganda.
- **Performa publik**: SSG/ISR + Cloudflare CDN → halaman cepat tanpa beban ke VPS untuk visit publik (cache hit dilayani CDN).
- **Hemat biaya**: tidak ada SaaS CMS berbayar.
- **Multibahasa native**: schema sudah `LocaleString`, sama dengan data master ERP.
- **Block-based** memberi fleksibilitas konten kreatif (hero, grid produk, peta lokasi) tanpa harus selalu ngoding.
- **Audit trail**: setiap edit konten masuk ke `audit_log` ERP yang sama.

### Negatif / Trade-off
- **Build awal lebih banyak**: scope CMS bertambah (editor blok, revision history, scheduling, ISR webhook). Mitigasi: phasing — Phase 5 saat publik launch.
- **Block library terbatas** (whitelist) → editor tidak bisa "copy paste HTML sembarang". Disengaja — keamanan & konsistensi visual.
- **Schedule publish** butuh worker cron yang baca `cms_pages.scheduled_at` dan trigger publish. Mitigasi: sudah ada `apps/worker` di stack.
- **ISR cache invalidation** rentan ke race condition (publish dua kali cepat). Mitigasi: queue revalidate webhook dengan idempotency.

### Neutral
- **Migrasi ke CMS eksternal kelak** (kalau brand membesar) tetap memungkinkan: schema kita standar; export ke JSON / Markdown straightforward.

## Implementasi Prioritas (Phase 5)

Urutan ketat:
1. Schema `cms_pages`, `cms_posts`, `cms_settings` + migrasi.
2. `packages/services/cms/*` (block validation, publish, revisions).
3. UI admin di `apps/web /cms/` (editor blok, list halaman/posting).
4. Permission seed: `cms.page.edit`, `cms.post.edit`, `cms.publish`, dll.
5. `apps/site` dengan halaman beranda + menu (membaca dari DB) + sitemap + robots.
6. ISR webhook + revalidate handler.
7. Schema `cms_banners`, `cms_faqs` + UI admin dan render.
8. Multi-bahasa routing `/id`, `/en`, `/zh`.
9. SEO metadata + structured data JSON-LD.

## Referensi

- Trivedi, R. & Patel, V. S. (2026), "JAMstack Architecture: Benefits of Decoupled Frontend-Backend Architecture for Modern Restaurant Web Applications" — relevansi langsung untuk web restoran/kafe.
- Tramullas, J. (2020), "Elaboración de productos de información con JAMstack: del sistema de gestión de contenidos al web estático" — bahas evolusi CMS ke static + APIs.
- Ziegler, W. (2022), "New Roles and Competencies in Technical Communication Induced by Semantics and Analytics" — referensi component content management yang menginspirasi block-based content.
- SOURCE-OF-TRUTH.md §22, §23 (Brand)
- SYSTEM-DESIGN.md §31, §32

## Tindak Lanjut
- [ ] Daftar awal block types + Zod schema masing-masing.
- [ ] Wireframe editor admin CMS (decide: drag-drop vs form-based).
- [ ] Tentukan provider Cloudflare (free plan cukup untuk awal).
- [ ] Strategi gambar: Cloudflare Images vs R2 + signed URL.
