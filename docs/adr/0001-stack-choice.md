# ADR-0001: Pilihan Stack Teknologi

- **Status**: Accepted
- **Tanggal**: 2026-05-05
- **Pengambil keputusan**: Lintang Maulana Zulfan (PIC + developer tunggal)
- **Konteks bisnis**: SOURCE-OF-TRUTH §17 (Infrastruktur & Teknologi), §20 (Roadmap)
- **Konteks teknis**: SYSTEM-DESIGN §3 (Constraints), §5 (Stack Teknologi)

## Konteks

PT. Gandha Hill (Aroadri Tea) membutuhkan ERP custom dengan beberapa karakteristik unik:

1. **Server VPS sangat kecil**: 1 vCPU / 2 GB RAM / 60 GB disk (constraint keras dari user; tidak dapat dinaikkan dalam phase awal karena anggaran).
2. **Multi-bahasa wajib**: Indonesia, Inggris, Mandarin (Simplified) sejak hari pertama, baik UI maupun laporan keuangan.
3. **Offline-first untuk POS** karena internet toko Indibiz 50 Mbps "kadang putus".
4. **MCP server** sebagai diferensiasi — AI lokal (Gemini CLI, Claude Code, Antigravity) dapat input/edit/audit data.
5. **Custom field & permission engine** database-driven untuk fleksibilitas tanpa edit source code.
6. **Multi-cabang** sebagai dimensi (saat ini 4 lokasi, akan bertambah).
7. **PIC = developer tunggal**, kerja solo — kecepatan iterasi penting.
8. **Akses mobile** wajib via PWA; mesin POS adalah **Imin Swan 2** (Android) yang menjalankan Chrome WebView.
9. Nantinya **ada public website** + CMS + member registration (lihat ADR-0002 dan ADR-0003).

Pertanyaan: **stack apa yang paling tepat?**

## Keputusan

| Lapisan | Pilihan | Versi minimum |
|---|---|---|
| Bahasa | TypeScript (strict) | ≥ 5.5 |
| Framework | Next.js (App Router) | ≥ 15 |
| MCP framework | Hono | ≥ 4 |
| Runtime | Node.js LTS | ≥ 20 |
| ORM | **Drizzle ORM** | ≥ 0.36 |
| Database | PostgreSQL **managed — Neon** (Supabase sebagai fallback bila Neon free tier limit kena) | 15+ |
| Validation | Zod | ≥ 3.23 |
| Auth (staff) | better-auth | latest |
| i18n | next-intl | ≥ 3 |
| PWA | Serwist | ≥ 9 |
| State server | TanStack Query | ≥ 5 |
| Form | React Hook Form + Zod resolver | latest |
| UI primitives | Tailwind CSS + shadcn/ui | latest |
| Tabel | TanStack Table | ≥ 8 |
| Chart | Recharts | ≥ 2 |
| Tanggal | date-fns | ≥ 3 |
| PDF | pdfmake | ≥ 0.2 |
| Excel | ExcelJS | ≥ 4 |
| MCP SDK | `@modelcontextprotocol/sdk` | latest |
| Test | Vitest + Playwright | latest |
| Linter | Biome | ≥ 1.9 |
| Package manager | pnpm | ≥ 9 |
| Reverse proxy | Caddy 2 | latest |
| Logger | pino | ≥ 9 |

**Larangan stack**: Prisma, Bun, MongoDB, GraphQL, tRPC, Redux, Material UI/Ant Design full bundle.

## Alternatif yang Dipertimbangkan

### A. Modifikasi Odoo (Community)
- Pros: Modul akuntansi/inventory matang; community besar.
- Cons:
  - **Memori**: Odoo butuh ≥ 4 GB RAM (PostgreSQL + Werkzeug + worker pool). Tidak masuk di 1 GB.
  - Modifikasi mendalam butuh Python + XML view + ORM Odoo; learning curve tinggi untuk developer solo.
  - Multi-bahasa Mandarin di Odoo perlu paket tambahan dan polish.
  - Integrasi MCP server harus ditulis dari nol di luar Odoo.
  - Lock-in ke schema Odoo yang gemuk.
- **Ditolak** (lihat ADR-0005 untuk diskusi lengkap).

### B. Modifikasi ERPNext / Frappe
- Pros: ERPNext sudah dipakai banyak SME Indonesia; community Indonesia kuat.
- Cons:
  - Sama dengan Odoo: memori ≥ 4 GB RAM minimum.
  - Stack: Python + JS Vue + MariaDB/MySQL + Redis. Banyak komponen untuk server kecil.
  - Kustomisasi via "DocType" yang kuat tetapi kurang fleksibel untuk fitur khusus seperti MCP.
- **Ditolak** karena alasan memori.

### C. Custom Build dengan Stack Lain

#### C1. Laravel (PHP) + Inertia + Tailwind
- Pros: Ekosistem PHP matang untuk akuntansi (paket akuntansi tersedia); RAM lebih ramah.
- Cons:
  - Multi-bahasa Mandarin di template Blade kurang ergonomis dibanding React i18n.
  - PWA + offline mode di Inertia lebih ribet.
  - Developer training data AI lebih sedikit dibanding Next.js.
  - MCP SDK belum resmi untuk PHP saat ini.
- **Ditolak** karena MCP & PWA pertimbangan.

#### C2. SvelteKit + Drizzle + Postgres
- Pros: Bundle lebih kecil; runtime ringan.
- Cons:
  - Ekosistem lebih kecil dibanding Next.js (component library, training data AI).
  - Kurang banyak template ERP / dashboard reference.
  - shadcn-svelte belum semapan shadcn (React).
- **Ditolak** karena kecepatan iteration sebagai dev solo lebih penting daripada efisiensi runtime marginal.

#### C3. Bun + Hono + React (full Bun stack)
- Pros: Cepat, ringan, runtime menarik.
- Cons:
  - Ekosistem belum semua compatible (beberapa native binding masih bermasalah).
  - Ecosystem maturity untuk production ERP belum cukup teruji.
  - AI training data untuk Bun lebih sedikit (dev solo perlu support AI tinggi).
- **Ditolak** sebagai default; **dipertimbangkan ulang** kelak bila Bun matang.

### D. Prisma sebagai ORM
- Pros: Developer experience baik, populer.
- Cons:
  - Engine binary boros memori (~200 MB tambahan saat startup).
  - Cold start lambat di Next.js standalone build.
  - Cocok untuk server besar; tidak cocok untuk 2 GB RAM kita.
- **Ditolak**, pakai Drizzle (lebih ringan, cold start cepat, type-safe).

## Konsekuensi

### Positif
- **Footprint memori realistis**: Next.js standalone (~200–300 MB) + Hono MCP (~80–120 MB) + Worker (~80 MB) + Caddy (~30 MB) muat di 1 GB dengan buffer.
- **Type-safety end-to-end** (TypeScript + Drizzle + Zod).
- **AI-friendly**: ekosistem Next.js + React + Drizzle punya training data terbanyak → AI assistant (Claude Code/Gemini CLI) lebih akurat saat coding.
- **Multi-bahasa native** via `next-intl` + JSON messages per locale.
- **PWA siap pakai** via Serwist untuk POS offline.
- **Database managed** (Neon free tier) → menghindari beban memory PostgreSQL di VPS.

### Negatif / Trade-off
- **Vendor risk Neon** (free tier kebijakan dapat berubah). Mitigasi: skema mudah migrasikan ke Supabase / RDS PostgreSQL.
- **Kustomisasi MCP perlu effort awal** (vs Odoo yang sudah punya XML-RPC gratis). Mitigasi: design pattern di SYSTEM-DESIGN §16; tools dapat ditambah inkremental per modul.
- **Akuntansi from scratch**: tidak ada "modul akuntansi siap pakai" → perlu disiplin testing untuk balance check, period close, posting rules. Mitigasi: SYSTEM-DESIGN §20 (Accounting Engine) detail.
- **Belajar Drizzle**: AI dev mungkin lebih familiar dengan Prisma — perlu dokumentasi lokal (di SYSTEM-DESIGN) tentang pola Drizzle yang dipakai.

### Neutral
- **Roadmap upgrade**: bila volume membesar dan VPS naik ke 4 GB+, opsi tambahan terbuka (mis. self-host PostgreSQL, runtime monitoring agent).
- **Lock-in**: stack ini lock-in ke ekosistem Vercel/Next.js, tetapi standalone build dapat di-deploy di mana saja (Caddy + Docker).

## Referensi

- Trivedi & Patel (2026), "JAMstack Architecture: Benefits of Decoupled Frontend-Backend Architecture for Modern Restaurant Web Applications", *International Journal for Multidisciplinary Research*, 10(04), 1–9 — untuk justifikasi pemisahan front/back-end di restaurant.
- Shivateja, G. (2026), "A Survey on Progressive Web Applications for Decentralized Systems", Preprints — untuk konfirmasi PWA adalah paradigma matang untuk web aplikasi seperti aplikasi.
- Kumar, R. (2020), "Multi-Tenant SaaS Architectures: Design Principles and Security Considerations", *International Journal of Computer Science*, 6(5), 28–41 — referensi untuk meninggalkan kolom `tenant_id` (siap multi-tenant) sambil tetap mengoperasikan single-tenant.
- Yanto et al. (2017), "Improving the Compliance with Accounting Standards Without Public Accountability (SAK ETAP) by Developing Organizational Culture: A Case of Indonesian SMEs", *Journal of Applied Business Research*, 33(5), 929–940 — konfirmasi SAK ETAP relevan untuk SME Indonesia, sistem perlu ramah pengisian.
- SOURCE-OF-TRUTH.md §17 (Infrastruktur)
- SYSTEM-DESIGN.md §3 (Constraints), §5 (Stack)

## Tindak Lanjut
- [x] **Pilihan DB managed: Neon** (decided 2026-05-05). Alasan: pure Postgres focus, branching DB untuk migrasi aman, latency baik dari Singapore region (terdekat ke Indonesia), serverless billing free tier 0.5 GB cukup untuk Phase 1. Supabase tetap sebagai fallback bila kebutuhan storage/realtime muncul kelak.
- [x] **Auth library: better-auth** (decided 2026-05-05). Alasan: actively maintained, plugin system mendukung dual-stack auth (staff ERP + member portal yang sesi-nya terpisah, lihat ADR-0004), email-password native, OAuth/MFA tersedia bila Phase 2 butuh. Lucia v3 yang tadinya dipertimbangkan kini dalam fase wind-down dari maintainer-nya — risiko bertahan dengan library yang tidak dipelihara.
- [ ] Validasi memori di staging dengan stack lengkap aktif sebelum production cut-over.
