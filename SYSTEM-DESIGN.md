# SYSTEM DESIGN — Sistem ERP Aroadri Tea

> **Audiens dokumen ini adalah AI developer** (Claude Code, Gemini CLI, Antigravity, Codex, dll.) yang akan menulis kode untuk repository ini. Dokumen ditulis eksplisit, deterministik, dan minim ambiguitas. Setiap aturan dirumuskan agar AI dapat mengeksekusi tanpa harus menebak.
>
> **Pasangan dokumen**:
> - `SOURCE-OF-TRUTH.md` → kebutuhan **bisnis** (apa). Selalu otoritatif untuk pertanyaan "apakah fitur X harus ada?".
> - `SYSTEM-DESIGN.md` (file ini) → keputusan **teknis** (bagaimana). Otoritatif untuk pertanyaan "bagaimana struktur kode/data/protokol?".
> - `CLAUDE.md` → ringkasan operasional + larangan harian.
>
> Bila ada konflik: SOURCE-OF-TRUTH menang untuk requirement bisnis; SYSTEM-DESIGN menang untuk implementasi teknis.
>
> **Versi**: 1.7 — 2026-05-12
> **Owner**: Lintang Maulana Zulfan

---

## Daftar Isi

1. [Tujuan, Cakupan, Non-Goals](#1-tujuan-cakupan-non-goals)
2. [Prinsip Desain](#2-prinsip-desain)
3. [Constraints Keras](#3-constraints-keras)
4. [Arsitektur Tingkat Tinggi](#4-arsitektur-tingkat-tinggi)
5. [Stack Teknologi](#5-stack-teknologi)
6. [Repository Layout](#6-repository-layout)
7. [Konvensi Penamaan & Coding](#7-konvensi-penamaan--coding)
8. [Data Model — Aturan Umum](#8-data-model--aturan-umum)
9. [Skema Inti Database](#9-skema-inti-database)
10. [API Design](#10-api-design)
11. [Authentication & Authorization](#11-authentication--authorization)
12. [Multi-Lokasi (Branch Dimension)](#12-multi-lokasi-branch-dimension)
13. [Internationalization](#13-internationalization)
14. [Offline-First POS (PWA)](#14-offline-first-pos-pwa)
15. [Audit Log](#15-audit-log)
16. [MCP Server Design](#16-mcp-server-design)
17. [Custom Field Engine](#17-custom-field-engine)
18. [Workflow / Approval Engine](#18-workflow--approval-engine)
19. [Tax Engine](#19-tax-engine)
20. [Accounting Engine](#20-accounting-engine)
21. [Spesifikasi Modul](#21-spesifikasi-modul)
22. [Error Handling & Logging](#22-error-handling--logging)
23. [Testing Strategy](#23-testing-strategy)
24. [Performance & Memory Discipline](#24-performance--memory-discipline)
25. [Security Checklist — Military Level](#25-security-checklist)
25a. [§25.2 — Enkripsi Data-at-Rest](#252-enkripsi-data-at-rest-field-level)
25b. [§25.3 — Ekspor XLSX di Semua Modul](#253-ekspor-xlsx-di-semua-modul)
25c. [§25.4 — Sistem Dokumentasi Komprehensif](#254-sistem-dokumentasi-komprehensif)
25d. [§25.5 — Laporan Harian Summary](#255-laporan-harian-summary)
25.5b. [Â§25.5b â€” Omzet Harian Export (PB1 + Koreksi Fiskal)](#255b-omzet-harian-export--pb1-exclusive--koreksi-fiskal-sot-213b)
25e. [§25.6 — Hourly Sales Report](#256-hourly-sales-report)
25f. [§25.7 — Petty Cash](#257-petty-cash)
25g. [§25.8 — Reimbursement](#258-reimbursement)
25h. [§25.9 — Stock Opname & Variance](#259-stock-opname--variance)
25i. [§25.10 — Journal Attachments (MCP Audit)](#2510-journal-attachments-mcp-audit)
25j. [§25.11 — Donasi / Rounding Donation](#2511-donasi--rounding-donation)
26. [CI/CD & Deployment](#26-cicd--deployment)
27. [Backup, Restore, DR](#27-backup-restore-dr)
28. [Observability](#28-observability)
29. [Workflow untuk AI Developer](#29-workflow-untuk-ai-developer)
30. [Open Decisions / ADR Pointers](#30-open-decisions--adr-pointers)
31. [Public Website + CMS + Member Portal](#31-public-website--cms--member-portal)
32. [Domain & Routing Strategy](#32-domain--routing-strategy)
33. [Naixer KDS Integration (QR-only)](#33-naixer-kds-integration-qr-only)
34. [POS Demo / Training Mode](#34-pos-demo--training-mode)
35. [Resilience & Auto-Recovery](#35-resilience--auto-recovery)
36. [Design System (Anti-Generic UI)](#36-design-system-anti-generic-ui)
37. [TASK.md Workflow untuk AI Multi-Sesi](#37-taskmd-workflow-untuk-ai-multi-sesi)
38. [Konfigurasi & Kustomisasi Tanpa Edit Source](#38-konfigurasi--kustomisasi-tanpa-edit-source)

---

## 1. Tujuan, Cakupan, Non-Goals

### 1.1 Tujuan
Membangun sistem ERP web-based + PWA untuk PT. Gandha Hill Catering Management Indonesia (Aroadri Tea) yang:
- Menangani 9 modul (lihat SOURCE-OF-TRUTH §20.2): Accounting, Reporting, Tax, POS, Inventory, Purchasing, Kitchen, HR & Payroll, CRM.
- Berjalan stabil pada 1 vCPU / 2 GB RAM / 60 GB disk.
- Mendukung offline-first POS karena internet toko sering putus.
- Multi-bahasa Indonesia / Inggris / Mandarin sejak hari pertama.
- Mengekspos antarmuka MCP agar AI lokal bisa input/edit/audit data.
- Dapat dikustomisasi (tambah peran, izin, field, modul) **tanpa edit source code**.

### 1.2 Cakupan Awal (Phase 1)
- Modul Akuntansi (COA, Jurnal, GL, AP/AR sederhana, Periode)
- Modul Reporting (Neraca, L/R, Arus Kas, Buku Besar, dst.)
- Modul Tax (PB1/PBJT, PPN keluaran/masukan, PPh 21/23/25, export Coretax)
- Authentication + RBAC + Permission engine
- Multi-lokasi dimension
- i18n shell
- Audit log
- MCP server skeleton

### 1.3 Non-Goals (jangan dibangun kecuali diminta eksplisit)
- ❌ Multi-tenant SaaS untuk perusahaan lain (single-tenant fokus dulu, namun **siapkan kolom `tenant_id`** untuk migrasi mudah)
- ❌ Mobile native app (Android/iOS native) — PWA cukup
- ❌ Microservices terpisah — monorepo, modular monolith
- ❌ Server-side rendering kompleks untuk SEO (ERP internal, tidak butuh)
- ❌ Real-time collaboration (mis. dua user edit dokumen sama bersamaan)
- ❌ Integrasi DJP Online API (export CSV ke Coretax sudah cukup — lihat SoT §11)
- ❌ Integrasi internet banking API (rekonsiliasi manual cukup — lihat SoT §10.2)
- ❌ Notifikasi push WA/SMS/Email blast (lihat SoT §13.3)
- ❌ Email/SMS marketing engine
- ❌ Payment gateway online (kecuali sebagai pencatatan QRIS/EDC)

### 1.4 Reversal Rule
Setiap kali AI hendak menambah dependency baru, fitur baru, atau optimisasi yang **tidak** secara eksplisit diminta di dokumen ini atau SOURCE-OF-TRUTH, **berhenti dan tanya user dulu**. Default: **jangan tambahkan**.

---

## 2. Prinsip Desain

| # | Prinsip | Operasionalisasi |
|---|---------|------------------|
| P1 | **Audit semuanya** | Setiap mutasi data → ada baris di `audit_log`. Tidak ada update silent. |
| P2 | **Akuntansi double-entry yang ketat** | Debit total = kredit total per jurnal. Validasi server-side; reject jika tidak balance. |
| P3 | **Database-driven config** | Role, permission, custom field, workflow rule, tax rate, COA seeding → di DB, bukan di kode. |
| P4 | **Modul ramping (modular monolith)** | Satu deployable. Modul terpisah secara folder + dependency rules. |
| P5 | **Service layer murni** | Business logic ada di `packages/services/*`. UI dan MCP hanya transport. Service tidak tahu tentang HTTP / Next.js. |
| P6 | **Idempotent & retry-safe** | Setiap mutation API menerima `Idempotency-Key`. Sinkronisasi POS offline aman dari duplikasi. |
| P7 | **Money sebagai integer** | Simpan rupiah dalam `bigint` (satuan: rupiah, **tanpa desimal**). Tidak ada `float` untuk uang. |
| P8 | **UTC di DB, locale di UI** | Semua `timestamp` di DB UTC. Konversi di edge. Zona toko: `Asia/Jakarta` (WIB) / `Asia/Pontianak` / dst. — disimpan di tabel `location.timezone`. |
| P9 | **Soft delete default** | Kolom `deleted_at`. Hard delete hanya via job admin. |
| P10 | **Fail loud, fail fast** | Jangan swallow error. Validasi input dengan Zod. Throw `AppError` dengan code & message. |
| P11 | **Setiap fitur UI punya tool MCP yang setara** | Saat menambah UI baru, tambah tool MCP yang melakukan operasi sama. |
| P12 | **PWA-first untuk POS** | POS harus berfungsi offline. Modul lain boleh online-only. |
| P13 | **i18n by default** | Semua label UI via key i18n. Data master dengan kolom multi-bahasa. |
| P14 | **Tidak ada hardcode role check** | `if (user.role === 'admin')` **dilarang**. Pakai `if (await user.can('action:resource'))`. |
| P15 | **Migrasi versionable** | Setiap perubahan skema lewat file migrasi (Drizzle). Tidak ada `db.execute(ALTER TABLE)` ad-hoc. |
| P16 | **Lean dependencies** | Tambah library hanya jika tidak ada implementasi internal yang cukup dalam ≤ 100 baris. |

---

## 3. Constraints Keras

| Aspek | Nilai | Implikasi |
|-------|-------|-----------|
| RAM server VPS | **2 GB** (upgraded dari 1 GB pada 2026-05-05) | Tetap ketat. Hindari proses node yang heavy (Prisma engine, dll.). Pakai Drizzle. Odoo/ERPNext (≥4 GB) tetap **tidak masuk**. |
| CPU | **1 vCPU** | Hindari heavy CPU job sinkron di request path. Worker terpisah untuk PDF, Excel, payroll calc batch. |
| Disk | **60 GB** | Backup harian rolling 7 hari → off-site. Database **tidak di disk lokal** (Neon/Supabase managed). |
| Internet di toko | tidak stabil | POS offline-first. Idempotent sync. **Layanan tetap berjalan saat server down** (lihat §35). |
| Bahasa | ID / EN / ZH | i18n sejak hari pertama. |
| Browser target | Chromium-based modern + Safari iOS 14+ | Mesin kasir Imin Swan 2 (Android). PWA harus jalan di Android Chrome WebView. |
| Pajak | SAK ETAP, PB1 10% inclusive | Engine pajak fleksibel di tabel. |
| Recovery | RTO ≤ 2 menit, RPO = 0 utk POS | Auto-restart PM2, outbox client, idempotent sync. |
| Naixer KDS | QR-only (tanpa API) | Generator QR pluggable. Lihat §33. |
| Demo POS | Wajib | Client-side IndexedDB only. Lihat §34. |
| UI/UX | **Wajib distinctive — bukan default shadcn** | Tokenize brand, custom variants. Lihat §36. |

---

## 4. Arsitektur Tingkat Tinggi

```
                     ┌──────────────────────────────────────────────┐
                     │           Public Internet (Cloudflare)       │
                     │  aroadritea.com  │  erp.aroadritea.com       │
                     │  display.aroadritea.com (opsional)           │
                     └──────┬─────────────────────────┬─────────────┘
                            │                          │
                  ┌─────────▼─────────┐    ┌───────────▼───────────┐
                  │ Browser publik /   │    │ Browser staf / PWA    │
                  │ pelanggan (mobile) │    │ POS (Imin Swan 2)     │
                  └─────────┬─────────┘    └───────────┬───────────┘
                            │ HTTPS                    │ HTTPS + SW + IDB
┌───────────────────────────▼───────────┐  ┌───────────▼─────────────────────┐
│ apps/site (Next.js 15)                │  │ apps/web (Next.js 15 + PWA)     │
│ aroadritea.com                        │  │ erp.aroadritea.com              │
│ - SSG/ISR halaman publik              │  │ - Server Actions ERP            │
│ - CMS-rendered pages                  │  │ - PWA + offline outbox (POS)    │
│ - Member signup + member portal       │  │ - Module dashboards             │
│ - Konsumsi services via in-proc call  │  │ - CMS admin UI (di /admin/cms)  │
└──────────────────┬────────────────────┘  └────────────────┬────────────────┘
                   │                                          │
                   └──────────┬──────────────┬────────────────┘
                              │ in-process function calls
                              ▼
┌────────────────────────────────────────────────────────────────────┐
│               packages/services/*  (business logic)                │
│  accounting / inventory / pos / purchasing / hr / payroll / crm /  │
│  kitchen / tax / reporting / customfield / workflow / audit /      │
│  auth / iam / notification / customer-display / cms / member       │
│                                                                    │
│  Pure functions returning Result<T, AppError>. No HTTP.            │
└──────┬──────────────────────────────┬──────────────────────────────┘
       │                              │
┌──────▼──────────┐   ┌────────────────▼───────────────┐  ┌─────────────────┐
│ packages/db     │   │ apps/mcp (Hono)                │  │ apps/worker     │
│ (Drizzle ORM)   │   │ MCP server — AI lokal          │  │ Cron + queue    │
│                 │   │ via stdio/SSE                  │  │ payroll, PDF,   │
│                 │   │                                │  │ backup, sync    │
└──────┬──────────┘   └────────────────────────────────┘  └─────────────────┘
       │
┌──────▼─────────────────────────────────────────────────────────────┐
│            PostgreSQL (Neon / Supabase free tier)                  │
│   - Schema: public (app), cms (content), audit, archive            │
│   - Daily backup → off-site (S3/R2)                                │
└────────────────────────────────────────────────────────────────────┘
```

### 4.1 Empat Surface Eksternal
1. **Public Website (`apps/site`)** — `aroadritea.com` — marketing + member portal + CMS-rendered konten. Tanpa login untuk halaman publik; login member untuk `/member/akun`.
2. **ERP Web (`apps/web`)** — `erp.aroadritea.com` — semua interaksi staf, dengan PWA offline untuk POS. Login wajib dengan RBAC.
3. **MCP (`apps/mcp`)** — path `erp.aroadritea.com/mcp` (atau subdomain satu tingkat bila SSL mendukung) — surface untuk AI lokal.
4. **REST API minimal** — di kedua app web, hanya untuk:
   - `apps/web /api/sync/pos` — sinkronisasi PWA offline
   - `apps/web /api/files/*` — upload/download
   - `apps/site /api/member/*` — signup, OTP verify, login member
   - Webhook eksternal bila ada

### 4.2 Komunikasi Antar-Layer
- **Site / Web → Service**: import langsung function service (in-process, tanpa HTTP).
- **MCP → Service**: import langsung function service (in-process).
- **Service → DB**: via Drizzle ORM dari `packages/db`.
- **Service ↔ Service**: import allowed sesuai dependency rule (lihat §6.4).
- **Site ↔ Web** (cross-app): **tidak ada call langsung**. Komunikasi via DB / via service yang sama (mis. data produk dibaca site-cms dari `packages/services/inventory`).

### 4.3 Memori Footprint per Proses (target — server 2 GB)
| Proses | Tipe | Target memori | Hard limit (PM2) |
|---|---|---|---|
| `apps/site` | Next.js standalone (publik, mostly SSG/ISR) | ≤ 250 MB | 384 MB |
| `apps/web` | Next.js standalone (ERP) | ≤ 450 MB | 640 MB |
| `apps/mcp` | Hono | ≤ 120 MB | 192 MB |
| `apps/worker` | Node + queue | ≤ 150 MB | 256 MB |
| HestiaCP reverse proxy | — | ≤ 60 MB | 96 MB |
| OS + buffer | — | ~ 250 MB | — |
| **Total target** | | **≤ 1280 MB** | **≤ 1568 MB hard limit** |
| **Buffer untuk spike & OS** | | **~ 720 MB** | **~ 432 MB** |

> Tetap konservatif. Jika gabungan melebihi target, **fold** `apps/site` ke dalam `apps/web` (Next.js single app dengan multiple route groups) sebagai mitigasi terakhir. Lihat ADR-0002.

**Setiap proses Node wajib pasang `--max-old-space-size=<nilai sesuai limit PM2>`** (mis. `--max-old-space-size=512` untuk apps/web) agar OOM restart terprediksi dan PM2 dapat me-restart.

---

## 5. Stack Teknologi

> Versi yang disebutkan adalah **minimum**. Pilih versi LTS terbaru saat scaffolding.

| Lapisan | Pilihan | Versi | Alasan |
|--------|---------|-------|--------|
| **Bahasa** | TypeScript | ≥ 5.5 (strict) | Type-safe, ekosistem ERP banyak di TS |
| **Framework Web** | Next.js (App Router) | ≥ 15.0 | PWA + RSC + Server Actions matang |
| **Framework MCP** | Hono | ≥ 4.0 | Ringan, edge-compatible, sederhana |
| **Runtime** | Node.js | ≥ 20 LTS | Stabil; **bukan Bun** (ekosistem belum cukup matang untuk ERP) |
| **ORM** | Drizzle ORM | ≥ 0.36 | Lightweight, cold start cepat, cocok 1 GB RAM |
| **Database** | PostgreSQL **managed — Neon** | 15+ | Neon free tier 0.5 GB Phase 1; Supabase fallback bila storage/realtime perlu kelak (lihat ADR-0001 §Tindak Lanjut) |
| **Validation** | Zod | ≥ 3.23 | Schema validation universal |
| **Auth** | **better-auth** | latest | Password + session di DB; plugin system mendukung dual-stack staff/member; tidak overhead JWT bila tidak perlu (lihat ADR-0001 §Tindak Lanjut) |
| **i18n** | next-intl | ≥ 3.0 | App Router-native, pesan JSON per locale |
| **PWA** | Serwist (next-pwa successor) | ≥ 9 | Workbox-based, App Router-friendly |
| **State server** | TanStack Query | ≥ 5 | Cache + sinkronisasi |
| **State client** | Zustand | ≥ 4 (opsional) | Hanya bila perlu cross-component state |
| **Form** | React Hook Form + Zod resolver | latest | Form besar (jurnal, payroll) butuh ini |
| **UI** | Tailwind CSS + shadcn/ui | latest | Headless, accessible, mudah i18n |
| **Tabel data** | TanStack Table | ≥ 8 | Tabel kompleks (laporan, ledger) |
| **Chart** | Recharts | ≥ 2 | Lightweight |
| **Tanggal** | date-fns | ≥ 3 | Tree-shakable (vs moment) |
| **PDF** | pdfmake | ≥ 0.2 | Cetak struk + laporan |
| **Excel** | ExcelJS | ≥ 4 | Export Coretax + laporan |
| **MCP SDK** | `@modelcontextprotocol/sdk` | latest | Resmi |
| **Test** | Vitest + Playwright | latest | Unit + E2E |
| **Linter** | Biome | ≥ 1.9 | Lebih cepat & terpadu vs ESLint+Prettier |
| **Package mgr** | pnpm | ≥ 9 | Disk-efficient (penting di server 60 GB) |
| **Deployment** | PM2 + HestiaCP reverse proxy | latest | Single VPS HestiaCP; runtime ringan tanpa Docker |
| **CI** | GitHub Actions | — | Build, test, deploy |
| **Backup** | rclone | ≥ 1.66 | Sync ke S3/R2 |
| **Logger** | pino | ≥ 9 | Cepat, JSON struktural |
| **Error tracking** | Sentry self-hosted (opsional) atau Glitchtip | — | Skip dulu jika RAM tidak cukup |

### 5.1 Larangan Stack
- ❌ **Prisma** — engine binary memakan RAM, slow cold start.
- ❌ **Bun** — ekosistem belum semua compatible.
- ❌ **MongoDB / Firestore** — akuntansi butuh transaksi ACID.
- ❌ **GraphQL** — overkill untuk single-team ERP; pakai server actions + REST minimal.
- ❌ **tRPC** — untuk MCP perlu surface eksplisit, tRPC menambah lapisan tanpa benefit di sini.
- ❌ **Redux** — Zustand cukup.
- ❌ **Moment.js** — ganti date-fns.
- ❌ **Lodash** monolitik — pakai modul-spesifik atau utilitas internal.
- ❌ Heavy UI library (Material UI full, Ant Design full) — bundle terlalu besar.

---

## 6. Repository Layout

```
ERP/
├── apps/
│   ├── site/                      # Next.js — public website (aroadritea.com)
│   │   ├── app/
│   │   │   ├── (public)/          # halaman publik SSG/ISR
│   │   │   │   ├── page.tsx       # beranda
│   │   │   │   ├── menu/
│   │   │   │   ├── tentang/
│   │   │   │   ├── lokasi/
│   │   │   │   ├── blog/[slug]/
│   │   │   │   └── kontak/
│   │   │   ├── (member)/          # member portal
│   │   │   │   ├── daftar/
│   │   │   │   ├── verifikasi-otp/
│   │   │   │   ├── masuk/
│   │   │   │   └── akun/
│   │   │   ├── api/
│   │   │   │   ├── member/        # signup, login member, OTP
│   │   │   │   └── revalidate/    # ISR webhook dari CMS
│   │   │   └── [locale]/          # /id, /en, /zh routes
│   │   ├── components/
│   │   ├── messages/              # i18n public: id.json, en.json, zh.json
│   │   ├── public/                # robots.txt, sitemap.xml, og-images
│   │   └── next.config.ts
│   ├── web/                       # Next.js — ERP (erp.aroadritea.com)
│   │   ├── app/
│   │   │   ├── (auth)/login/
│   │   │   ├── (dash)/
│   │   │   │   ├── accounting/
│   │   │   │   ├── inventory/
│   │   │   │   ├── pos/
│   │   │   │   ├── purchasing/
│   │   │   │   ├── hr/
│   │   │   │   ├── crm/
│   │   │   │   ├── kitchen/
│   │   │   │   ├── reporting/
│   │   │   │   ├── tax/
│   │   │   │   ├── cms/           # CMS admin UI (untuk site)
│   │   │   │   └── settings/
│   │   │   ├── display/           # customer-facing display per location
│   │   │   ├── api/               # REST minimal: webhooks, sync, files
│   │   │   └── layout.tsx
│   │   ├── components/
│   │   ├── lib/
│   │   ├── messages/              # i18n ERP: id.json, en.json, zh.json
│   │   ├── public/
│   │   ├── service-worker/        # Serwist (PWA offline POS)
│   │   └── next.config.ts
│   ├── mcp/                       # MCP server (Hono)
│   │   ├── src/
│   │   │   ├── tools/             # 1 file per tool
│   │   │   ├── auth.ts
│   │   │   └── server.ts
│   │   └── package.json
│   └── worker/                    # Cron + background jobs
│       └── src/
│           ├── jobs/
│           │   ├── backup.ts
│           │   ├── payroll-batch.ts
│           │   ├── stock-low-alert.ts
│           │   └── isr-revalidate.ts   # invalidasi cache site saat CMS publish
│           └── index.ts
├── packages/
│   ├── db/                        # Drizzle schema + migrations
│   │   ├── schema/
│   │   │   ├── auth.ts
│   │   │   ├── accounting.ts
│   │   │   ├── inventory.ts
│   │   │   ├── cms.ts             # cms_pages, cms_posts, cms_banners, …
│   │   │   ├── member.ts          # member_signup_attempts, member_sessions
│   │   │   ├── ...
│   │   │   └── audit.ts
│   │   ├── migrations/
│   │   ├── seed/
│   │   │   ├── coa.ts            # seed COA dari SOURCE-OF-TRUTH Lampiran A
│   │   │   ├── permissions.ts
│   │   │   ├── tax-rates.ts
│   │   │   └── cms-default-pages.ts   # halaman default (Beranda, Tentang, …)
│   │   ├── client.ts
│   │   └── index.ts
│   ├── services/                  # business logic per modul
│   │   ├── accounting/
│   │   ├── inventory/
│   │   ├── pos/
│   │   ├── purchasing/
│   │   ├── hr/
│   │   ├── payroll/
│   │   ├── crm/
│   │   ├── kitchen/
│   │   ├── reporting/
│   │   ├── tax/
│   │   ├── cms/                   # halaman, posting, banner, FAQ
│   │   ├── member/                # signup OTP, member auth, lookup telepon POS
│   │   ├── customfield/
│   │   ├── workflow/
│   │   ├── audit/
│   │   ├── auth/
│   │   ├── iam/
│   │   └── notification/
│   ├── shared/
│   │   ├── types/                 # shared types (Money, LocaleString, …)
│   │   ├── ports/                 # interface antar-modul
│   │   ├── errors/
│   │   ├── result/
│   │   ├── money/
│   │   ├── date/
│   │   ├── i18n-keys/
│   │   └── id/
│   ├── ui/                        # shared components ERP (admin)
│   └── ui-public/                 # shared components publik (marketing)
├── brand-assets/                  # logo, palet, tipografi
│   ├── BRAND.md
│   ├── logo-primary.png
│   ├── logo-monochrome.png
│   └── logo-favicon.svg
├── docs/
│   ├── adr/                       # Architecture Decision Records
│   │   ├── README.md              # index
│   │   ├── 0001-stack-choice.md
│   │   ├── 0002-monorepo-and-app-split.md
│   │   ├── 0003-public-website-cms-architecture.md
│   │   ├── 0004-member-registration-and-auth.md
│   │   └── 0005-build-vs-modify-existing-erp.md
│   └── runbook/
├── scripts/
│   ├── seed.ts
│   └── reset-dev-db.ts
├── docker/
│   ├── Caddyfile
│   ├── docker-compose.yml
│   └── Dockerfile                 # legacy/staging option; production VPS uses PM2
├── .github/workflows/
│   ├── ci.yml
│   └── deploy.yml
├── .env.example
├── ecosystem.config.cjs           # PM2 production runtime config
├── biome.json
├── package.json                   # pnpm workspace root
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── README.md
├── CLAUDE.md
├── SOURCE-OF-TRUTH.md
└── SYSTEM-DESIGN.md               # this file
```

### 6.4 Dependency Rule (Wajib)

```
apps/site  →  packages/services (cms, member, inventory READ-ONLY, locations READ-ONLY),
              packages/shared, packages/ui-public, packages/db (typed)
              ↳ TIDAK BOLEH panggil services yang melakukan posting jurnal / mutasi stok
                kecuali via boundary kontrol member (signup, profile update)

apps/web   →  packages/services (semua), packages/shared, packages/ui, packages/db

apps/mcp   →  packages/services (semua), packages/shared, packages/db

apps/worker→  packages/services, packages/shared, packages/db

packages/services/<module>  →  packages/db, packages/shared
                            →  TIDAK BOLEH import packages/services/<module-lain> kecuali
                              via port di packages/shared/ports/
                            →  TIDAK BOLEH import dari apps/*

packages/ui         →  packages/shared (types, i18n keys)
packages/ui-public  →  packages/shared
                     →  TIDAK BOLEH import dari packages/services atau packages/db

packages/db  →  packages/shared
              →  TIDAK BOLEH import dari packages/services
```

**Khusus `apps/site`**: hanya boleh memanggil **whitelist services** berikut:
- `cms.*` (full akses)
- `member.signup`, `member.verifyOtp`, `member.login`, `member.getProfile`, `member.updateProfile`, `member.requestErasure`
- `inventory.publicListProducts`, `inventory.publicGetProduct` (versi publik yang sudah filter `is_published`)
- `iam.publicGetLocations` (lokasi yang `status='active'` saja)
- `crm.publicLogComplaint` (form kontak, dengan rate-limit + captcha)

Tidak ada akses langsung ke `accounting`, `pos`, `purchasing`, `payroll`, `hr` dari `apps/site`.

Dependency loop antar service **dilarang**. Bila modul A butuh modul B, definisikan **port/interface** di `packages/shared/ports/` dan inject implementasinya.

Contoh: modul `pos` butuh `inventory.deduct(...)`. Buat interface `InventoryPort` di `packages/shared/ports/inventory.ts`. `pos` bergantung pada port, bukan pada `services/inventory` langsung. `apps/web` melakukan wiring.

---

## 7. Konvensi Penamaan & Coding

### 7.1 Identifier
| Element | Konvensi | Contoh |
|---------|----------|--------|
| Variable, function | `camelCase` | `createJournalEntry` |
| Type, interface, class | `PascalCase` | `JournalEntry` |
| Constant top-level | `SCREAMING_SNAKE` | `DEFAULT_CURRENCY` |
| File TS | `kebab-case` | `journal-entry.service.ts` |
| Folder | `kebab-case` | `accounting/` |
| DB table | `snake_case` plural | `journal_entries` |
| DB column | `snake_case` | `posted_at` |
| Enum value DB | `snake_case` | `'partially_paid'` |
| i18n key | `module.section.label` | `accounting.journal.post` |

### 7.2 File Header
Tidak wajib. Tapi setiap file service harus expose default export `null` dan named exports berfungsi (treeshakable).

### 7.3 Komentar
- Tidak wajib. Hanya tulis bila *why* tidak jelas dari kode.
- Bila ada referensi ke SoT atau aturan pajak, tulis pointer: `// rule: SOURCE-OF-TRUTH §6.5 PB1 inclusive`.

### 7.4 Import Order (Biome akan auto-sort)
1. Built-in Node (`node:fs`)
2. Third-party (`zod`, `next`)
3. Workspace packages (`@erp/db`, `@erp/services/...`)
4. Relative

### 7.5 No-`any`
Strict mode aktif. `any` dilarang kecuali untuk interop library tanpa types — selalu gunakan `unknown` lalu narrow.

### 7.6 `Result<T, E>` Pattern
Semua function service **wajib** mengembalikan `Result<T, AppError>` (success/failure), **bukan throw**. Throw hanya untuk programmer error (assert).

```ts
// packages/shared/result/result.ts
export type Result<T, E = AppError> = { ok: true; value: T } | { ok: false; error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });
```

### 7.7 `AppError` Taxonomy

```ts
// packages/shared/errors/app-error.ts
export class AppError extends Error {
  constructor(
    public readonly code: AppErrorCode,
    public readonly messageKey: string,    // i18n key
    public readonly details?: unknown,
    public readonly cause?: unknown,
  ) { super(messageKey); }
}

export type AppErrorCode =
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION_FAILED'
  | 'CONFLICT'              // versi mismatch, duplicate key
  | 'BUSINESS_RULE'         // jurnal tidak balance, periode ditutup
  | 'EXTERNAL_DEPENDENCY'   // tax api / printer
  | 'INTERNAL';
```

UI menerjemahkan `code + messageKey` ke pesan user via i18n.

### 7.8 Money
**Selalu** gunakan tipe `Money` (bigint dalam rupiah, tanpa desimal). Jangan pernah pakai `number` untuk uang.

```ts
// packages/shared/money/money.ts
export type Money = bigint;
export const rupiah = (n: number | string): Money => BigInt(typeof n === 'string' ? n.replace(/\D/g, '') : Math.round(n));
export const formatRupiah = (m: Money, locale = 'id-ID'): string =>
  new Intl.NumberFormat(locale, { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(m));
```

DB column type: `bigint NOT NULL`. **Tidak pernah** pakai `numeric/decimal` untuk uang IDR (rupiah tidak punya sub-unit yang dipakai sehari-hari).

### 7.9 LocaleString
Untuk field multi-bahasa data master:
```ts
export type LocaleString = { id: string; en: string; zh: string };
```
DB column type: `jsonb NOT NULL`. Ada constraint `CHECK (data ? 'id' AND data ? 'en' AND data ? 'zh')`.

### 7.10 ID
- Primary key: **ULID** (string 26 chars, lexicographically sortable). Generate dengan `id()` helper di `packages/shared/id`.
- DB column: `text PRIMARY KEY` (bukan UUID native — ULID memberi index ordering yang bagus dan portable).
- **Jangan** pakai auto-increment integer (mempersulit replikasi & menebak count).

---

## 8. Data Model — Aturan Umum

### 8.1 Kolom Wajib di Setiap Tabel Transaksional
Setiap tabel transaksional (bukan lookup) **wajib** memiliki:

| Kolom | Tipe | Catatan |
|-------|------|---------|
| `id` | `text` (ULID) | PK |
| `tenant_id` | `text` (default tenant) | Multi-tenant ready, default `'default'` |
| `location_id` | `text` (FK locations) | Kecuali tabel lookup global |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | |
| `updated_at` | `timestamptz NOT NULL DEFAULT now()` | Auto-bumped via trigger |
| `deleted_at` | `timestamptz NULL` | Soft delete |
| `created_by` | `text` (FK users) | NULL hanya untuk seed |
| `updated_by` | `text` (FK users) | |
| `version` | `integer NOT NULL DEFAULT 1` | Optimistic concurrency |

Untuk **tabel master** (currency, country) yang non-tenant: tidak wajib `tenant_id`/`location_id`.

### 8.2 Indexing Default
- Index `(tenant_id, location_id)` di setiap tabel transaksional.
- Index pada FK eksplisit (Drizzle tidak auto-index FK di Postgres).
- Index pada kolom yang sering di-filter di laporan: `posting_date`, `status`, `category_id`.

### 8.3 Soft Delete
- View `*_active` di setiap tabel: `WHERE deleted_at IS NULL`.
- Service layer **wajib** memfilter `deleted_at IS NULL` kecuali untuk export/audit.
- Hard delete hanya melalui job admin (`scripts/purge-soft-deleted.ts`) setelah retensi 1 tahun.

### 8.4 Optimistic Locking
- Setiap update mengirim `version` lama; UPDATE dengan `WHERE id = ? AND version = ? RETURNING ...`. Jika 0 rows → throw `CONFLICT`.

### 8.5 Trigger Auto `updated_at`
Migration awal seed trigger PostgreSQL global `set_updated_at` untuk semua tabel transaksional.

### 8.6 Multi-Bahasa Data Master
Kolom `name jsonb NOT NULL` dengan validasi schema-level (CHECK constraint memaksa adanya kunci `id`, `en`, `zh`). Contoh:
```sql
CHECK (
  jsonb_typeof(name -> 'id') = 'string' AND
  jsonb_typeof(name -> 'en') = 'string' AND
  jsonb_typeof(name -> 'zh') = 'string'
)
```

### 8.7 Pajak / Diskon — pisah tabel
Per dokumen transaksional: `*_tax_lines` dan `*_discount_lines` agar audit pajak per dokumen jelas.

### 8.8 Aturan Penamaan Status / Enum
Enum disimpan sebagai `text CHECK (col IN (...))` (bukan native `CREATE TYPE`) — lebih mudah migrasi.

---

## 9. Skema Inti Database

> Notasi: `🔑` PK, `🔗` FK, `*` wajib, `~` opsional. Lihat `packages/db/schema/*.ts` untuk versi otoritatif.

### 9.1 Identity & IAM

#### `tenants`
| Field | Tipe | Catatan |
|-------|------|---------|
| 🔑 `id` | text | ULID |
| `*name` | text | "Aroadri Tea (default)" |
| `*locale_default` | text | `'id'` |

#### `locations`
Mewakili cabang fisik / kantor (lihat SoT §15).
| Field | Tipe | Catatan |
|-------|------|---------|
| 🔑 `id` | text | ULID |
| `*tenant_id` | text 🔗 tenants | |
| `*code` | text | `MLB`, `JKT-OFC`, dll. |
| `*name` | jsonb | LocaleString |
| `*type` | text CHECK | `'store' \| 'office' \| 'warehouse'` |
| `*timezone` | text | `'Asia/Jakarta'` |
| `*currency` | text | `'IDR'` |
| `~address` | text | |
| `*status` | text CHECK | `'active' \| 'inactive'` |

#### `users`
| Field | Tipe | Catatan |
|-------|------|---------|
| 🔑 `id` | text | ULID |
| `*tenant_id` | text 🔗 | |
| `*email` | text UNIQUE | Login |
| `*password_hash` | text | argon2id |
| `*display_name` | text | |
| `~phone` | text encrypted | |
| `*locale` | text | `'id' \| 'en' \| 'zh'` |
| `*status` | text CHECK | `'active' \| 'suspended'` |
| `~last_login_at` | timestamptz | |

#### `roles`
| Field | Tipe | Catatan |
|-------|------|---------|
| 🔑 `id` | text | ULID |
| `*tenant_id` | text 🔗 | |
| `*code` | text | `director`, `cashier`, ... |
| `*name` | jsonb | LocaleString |
| `~description` | jsonb | |

#### `permissions`
Daftar permission atomik di sistem. Diisi via seed + saat menambah modul.
| Field | Tipe | Catatan |
|-------|------|---------|
| 🔑 `id` | text | ULID |
| `*code` | text UNIQUE | `journal.create`, `pos.refund`, `inventory.adjust` |
| `*module` | text | `accounting`, `pos`, `inventory` |
| `~description` | jsonb | |

#### `role_permissions`
Banyak-ke-banyak.
| Field | Tipe | Catatan |
|-------|------|---------|
| `*role_id` | text 🔗 | |
| `*permission_id` | text 🔗 | |
| PK | (role_id, permission_id) | |

#### `user_roles`
Banyak-ke-banyak. Mendukung kerangkap jabatan (SoT §3.2).
| Field | Tipe | Catatan |
|-------|------|---------|
| `*user_id` | text 🔗 | |
| `*role_id` | text 🔗 | |
| `~location_id` | text 🔗 | NULL = global; kalau ada, role hanya berlaku di lokasi itu |
| PK | (user_id, role_id, location_id NULL → "global") | |

#### `sessions`
Session DB-backed (better-auth style).

### 9.2 Accounting

#### `accounting_periods`
| Field | Tipe | Catatan |
|-------|------|---------|
| 🔑 `id` | text | |
| `*tenant_id` | text 🔗 | |
| `*code` | text | `2026-05` |
| `*start_date` | date | |
| `*end_date` | date | |
| `*status` | text CHECK | `'open' \| 'closing' \| 'closed'` |
| `~closed_at` | timestamptz | |
| `~closed_by` | text 🔗 users | |

#### `accounts` (COA)
| Field | Tipe | Catatan |
|-------|------|---------|
| 🔑 `id` | text | |
| `*tenant_id` | text 🔗 | |
| `*code` | text | `1-1010`, `4-1000` |
| `*name` | jsonb | LocaleString |
| `*type` | text CHECK | `'asset' \| 'liability' \| 'equity' \| 'income' \| 'cogs' \| 'expense'` |
| `*subtype` | text | `'current_asset', 'fixed_asset', 'contra_asset', ...` |
| `~parent_id` | text 🔗 self | Hierarchy |
| `*normal_balance` | text CHECK | `'debit' \| 'credit'` |
| `*is_postable` | boolean | TRUE = boleh post jurnal langsung; FALSE = parent header |
| `~tax_code` | text | bila akun pajak |
| `*is_active` | boolean | |

> Seed script `packages/db/seed/coa.ts` **wajib** memuat semua akun di SOURCE-OF-TRUTH.md Lampiran A.

#### `journal_entries`
| Field | Tipe | Catatan |
|-------|------|---------|
| 🔑 `id` | text | |
| `*tenant_id` | text 🔗 | |
| `*location_id` | text 🔗 | Dimensi lokasi |
| `*period_id` | text 🔗 | |
| `*posting_date` | date | |
| `*number` | text | Auto: `JE-2026-05-0001` |
| `*description` | text | |
| `~reference_type` | text | `'sales' \| 'purchase' \| 'payroll' \| 'manual' \| ...` |
| `~reference_id` | text | FK polymorphic (validasi di service) |
| `*status` | text CHECK | `'draft' \| 'posted' \| 'reversed'` |
| `~posted_at` | timestamptz | |
| `~posted_by` | text 🔗 | |
| `~reversed_by_je_id` | text 🔗 self | jika dibalik |
| `*total_debit` | bigint | total dalam rupiah |
| `*total_credit` | bigint | sama dengan total_debit |

CHECK: `total_debit = total_credit`.

#### `journal_lines`
| Field | Tipe | Catatan |
|-------|------|---------|
| 🔑 `id` | text | |
| `*journal_entry_id` | text 🔗 | |
| `*line_no` | int | urut di entry |
| `*account_id` | text 🔗 accounts | |
| `*location_id` | text 🔗 | dimensi tambahan (boleh beda dari header bila lintas lokasi) |
| `~description` | text | |
| `*debit` | bigint | salah satu debit/credit > 0 |
| `*credit` | bigint | |
| `~tax_code` | text | |
| `~partner_id` | text | FK ke supplier/customer/employee |

CHECK: `(debit > 0 AND credit = 0) OR (debit = 0 AND credit > 0)`.

#### `customers` & `suppliers` & `partners`
Pakai satu tabel `partners` dengan `kind` (`'customer' \| 'supplier' \| 'employee' \| 'other'`) untuk kemudahan.

```
partners
- id, tenant_id, kind, name, name_localized jsonb, npwp, email, phone (encrypted), address, is_pkp boolean, payment_terms_days int, ...
```

#### `tax_rates`
| Field | Tipe | Catatan |
|-------|------|---------|
| 🔑 `id` | text | |
| `*code` | text UNIQUE | `'PB1', 'PPN_OUT', 'PPN_IN', 'PPH21', 'PPH23'` |
| `*name` | jsonb | |
| `*rate_bps` | int | basis poin (PB1 10% = 1000) |
| `*calculation` | text CHECK | `'inclusive' \| 'exclusive'` |
| `*posting_account_id` | text 🔗 accounts | akun yang di-post (PB1 Payable, dll.) |
| `*is_active` | boolean | |
| `*effective_from` | date | tarif berubah → buat baris baru, jangan overwrite |
| `~effective_until` | date | NULL = berlaku selamanya |

#### `tax_rules` (decided ADR-0010)
Menentukan tarif yang berlaku per kombinasi channel/customer/category — lihat §19.3.

| Field | Tipe | Catatan |
|-------|------|---------|
| 🔑 `id` | text | |
| `*tenant_id` | text 🔗 | |
| `*scope_kind` | text CHECK | `'channel' \| 'customer_segment' \| 'product_category' \| 'global_default'` |
| `~scope_id` | text | nullable bila global |
| `*tax_code` | text 🔗 tax_rates.code | |
| `*is_applied_default` | boolean | TRUE = otomatis di-apply saat dokumen dibuat |
| `*priority` | int | resolusi konflik (semakin besar = lebih spesifik) |
| `*effective_from` | date | |
| `~effective_until` | date | |

### 9.3 Inventory

#### `products`
| Field | Tipe | Catatan |
|-------|------|---------|
| 🔑 `id` | text | |
| `*tenant_id` | text 🔗 | |
| `*sku` | text UNIQUE per tenant | |
| `*name` | jsonb | LocaleString |
| `*category_id` | text 🔗 product_categories | |
| `*kind` | text CHECK | `'finished_good' \| 'raw_material' \| 'merchandise' \| 'consumable' \| 'service'` |
| `*uom` | text | `pcs`, `kg`, `liter`, `g`, `ml` |
| `*is_sellable` | boolean | |
| `*is_purchasable` | boolean | |
| `*track_batch` | boolean | krimer = TRUE |
| `*track_expiry` | boolean | krimer, lemon, egg tart = TRUE |
| `~shelf_life_days` | int | |
| `~min_stock` | numeric(14,3) | per lokasi via `stock_levels.min_stock` |

#### `product_variants`
Untuk varian Regular/Large × Hot/Cold.

#### `product_modifiers`
Sugar level, ice level, topping. Topping juga sebagai produk (untuk BOM).

#### `boms` (Bill of Materials)
| Field | Tipe | Catatan |
|-------|------|---------|
| 🔑 `id` | text | |
| `*tenant_id` | text 🔗 | |
| `*product_id` | text 🔗 products | |
| `~variant_id` | text 🔗 product_variants | NULL = berlaku semua varian |
| `*version` | int | versi resep |
| `*is_active` | boolean | |

#### `bom_lines`
| Field | Tipe | Catatan |
|-------|------|---------|
| `*bom_id` | text 🔗 | |
| `*line_no` | int | |
| `*ingredient_id` | text 🔗 products | bahan baku |
| `*qty` | numeric(14,4) | jumlah per 1 unit produk |
| `*uom` | text | harus konversibel dengan ingredient.uom |
| `*is_optional` | boolean | mis. topping |

#### `bom_substitutes`
Untuk substitusi (creamer brand A ↔ B).

#### `stock_locations`
Sub-lokasi di dalam location (rak, freezer, kitchen counter).

#### `stock_levels`
Snapshot quantity per (product, location, batch). **Hitung ulang dari `stock_movements`** kalau ragu — `stock_levels` adalah cache materialized.

#### `stock_movements`
Append-only log pergerakan stok.
| Field | Tipe | Catatan |
|-------|------|---------|
| 🔑 `id` | text | |
| `*tenant_id` | text 🔗 | |
| `*occurred_at` | timestamptz | |
| `*location_id` | text 🔗 | |
| `~stock_location_id` | text 🔗 | |
| `*product_id` | text 🔗 | |
| `~variant_id` | text 🔗 | |
| `~batch_no` | text | |
| `~expiry_date` | date | |
| `*qty_delta` | numeric(14,3) | + masuk, − keluar |
| `*uom` | text | |
| `*reason` | text CHECK | `'purchase' \| 'sale' \| 'transfer_in' \| 'transfer_out' \| 'adjustment' \| 'production' \| 'waste' \| 'opening'` |
| `~reference_type` | text | |
| `~reference_id` | text | |
| `~unit_cost` | bigint | rupiah per UOM (untuk FIFO valuation) |

#### `stock_adjustments`, `stock_transfers`, `stock_takes`
Satu tabel "header" per jenis koreksi, dengan baris pergerakan terkait di `stock_movements`.

### 9.4 Purchasing

#### `purchase_orders`
Header PO. Status: `'draft' \| 'submitted' \| 'approved' \| 'partial' \| 'received' \| 'closed' \| 'cancelled'`.

#### `purchase_order_lines`
Item PO.

#### `goods_receipt_notes`
GRN per kedatangan (≥ 1 GRN per PO).

#### `purchase_invoices`
Faktur dari supplier; link ke GRN. Memicu jurnal AP / payment.

### 9.5 POS / Sales

#### `sales_orders` (POS order)
| Field | Tipe | Catatan |
|-------|------|---------|
| 🔑 `id` | text | |
| `*tenant_id` | text 🔗 | |
| `*location_id` | text 🔗 | toko |
| `*number` | text | `T01-2026-05-0001` |
| `*shift_id` | text 🔗 shifts | |
| `*cashier_id` | text 🔗 users | |
| `*channel` | text CHECK | `'walk_in' \| 'gofood' \| 'grabfood' \| 'shopeefood'` |
| `*status` | text CHECK | `'open' \| 'paid' \| 'refunded' \| 'voided'` |
| `*placed_at` | timestamptz | |
| `*subtotal` | bigint | sebelum diskon |
| `*discount_total` | bigint | |
| `*tax_total` | bigint | PB1 (inclusive—di-back-out dari subtotal untuk reporting) |
| `*grand_total` | bigint | yang dibayar customer |
| `~customer_id` | text 🔗 partners | bila member |
| `*idempotency_key` | text UNIQUE per location | untuk sync offline |

#### `sales_order_lines`
| Field | Tipe | Catatan |
|-------|------|---------|
| 🔑 `id` | text | |
| `*sales_order_id` | text 🔗 | |
| `*line_no` | int | |
| `*product_id` | text 🔗 | |
| `~variant_id` | text 🔗 | |
| `*qty` | numeric(14,3) | |
| `*unit_price` | bigint | inclusive PB1 |
| `*line_subtotal` | bigint | qty × unit_price |
| `*line_discount` | bigint | |
| `*line_tax` | bigint | |
| `*line_total` | bigint | |
| `~modifier_json` | jsonb | sugar/ice/topping snapshot |
| `~kds_qr_token` | text | unik per line — untuk scan di KDS |
| `~kds_qr_payload` | text | payload QR Naixer untuk audit/cetak ulang |

#### `payments`
Mendukung split payment.
| Field | Tipe | Catatan |
|-------|------|---------|
| 🔑 `id` | text | |
| `*sales_order_id` | text 🔗 | |
| `*method` | text CHECK | `'cash' \| 'qris' \| 'flazz' \| 'debit' \| 'credit' \| 'gofood' \| 'grabfood' \| 'shopeefood'` |
| `*amount` | bigint | |
| `~reference` | text | |
| `*occurred_at` | timestamptz | |

#### `refunds`
Header retur. Memicu jurnal balikan + stock reversal.

#### `discounts`, `promotions`, `vouchers`
Engine promosi (lihat §21.6).

#### `shifts`
Shift kasir (open/close kas).
| Field | Tipe | Catatan |
|-------|------|---------|
| 🔑 `id` | text | |
| `*location_id` | text 🔗 | |
| `*opened_by` | text 🔗 users | |
| `*opened_at` | timestamptz | |
| `*opening_cash` | bigint | |
| `~closed_by` | text 🔗 users | |
| `~closed_at` | timestamptz | |
| `~expected_cash` | bigint | dihitung sistem |
| `~actual_cash` | bigint | input kasir |
| `~variance` | bigint | actual − expected |
| `*status` | text CHECK | `'open' \| 'closed'` |

#### `pos_settings`
Konfigurasi POS per lokasi yang dikelola lewat UI `Settings → POS Settings`.

| Field | Tipe | Catatan |
|-------|------|---------|
| 🔑 `id` | text | |
| `*tenant_id` | text 🔗 | |
| `*location_id` | text 🔗 | unique per tenant/location |
| `*pb1_tax_code` | text | default `PB1`, resolve ke `tax_rates.code` |
| `*cash_account_code` | text | default `1-1030`, resolve ke `accounts.code` |
| `*revenue_account_code` | text | default `4-1010` |
| `*donation_trust_account_code` | text | default `2-2050` |
| `*delivery_channels_json` | jsonb | contoh `["gofood","grabfood","shopeefood"]` |
| `*delivery_net_bps` | int | default `8000` = 80% |
| `*receipt_width_mm` | int | default `80` mm / 8 cm; fleksibel per printer |

### 9.6 HR & Payroll

#### `employees`
Memperluas `partners` (kind=`employee`) atau tabel terpisah. **Pilih: tabel terpisah** karena field employment-specific banyak.

#### `employment_contracts`
Riwayat kontrak (PKWT/PKWTT, periode, gaji pokok).

#### `attendance`
Catatan check-in/out (dari modul absensi).

#### `leaves`, `leave_balances`

#### `payrolls`, `payroll_lines`
Header per periode + komponen per karyawan.

#### `salary_components`
Master komponen (Gaji Pokok, Tunjangan THR, Lembur, Bonus, BPJS Kesehatan, BPJS TK, PPh 21, Pinjaman).
- `kind`: `'earning' \| 'deduction'`
- `is_taxable`, `is_bpjs_base`
- `posting_account_id` 🔗 accounts

#### `disciplinary_actions`
Surat peringatan (SP1/SP2/SP3) dengan attachment.

### 9.7 CRM

#### `members`
Diturunkan dari `partners` (kind=`customer` + flag `is_member`).

#### `loyalty_accounts`, `loyalty_transactions`, `loyalty_tiers`

#### `complaints`, `complaint_compensations`

### 9.8 Kitchen / Production

#### `production_orders` (jika perlu prep-work eksplisit)
Untuk batch prep di luar real-time order POS.

#### `kds_events`
Event log dari KDS Naixer (kalau API tersedia, di-poll dan dimasukkan).

### 9.9 Custom Fields

#### `custom_field_definitions`
| Field | Tipe | Catatan |
|-------|------|---------|
| 🔑 `id` | text | |
| `*tenant_id` | text 🔗 | |
| `*entity_type` | text | `'product' \| 'customer' \| 'employee' \| 'journal_entry' \| ...` |
| `*key` | text | snake_case, unik per entity_type |
| `*name` | jsonb | LocaleString |
| `*data_type` | text CHECK | `'string' \| 'number' \| 'boolean' \| 'date' \| 'enum' \| 'reference'` |
| `~enum_options` | jsonb | bila data_type=enum |
| `~ref_entity_type` | text | bila data_type=reference |
| `*is_required` | boolean | |
| `*is_indexed` | boolean | bila TRUE → buat index ekspresi |
| `~validation_regex` | text | |
| `*display_order` | int | |

#### `custom_field_values`
| Field | Tipe | Catatan |
|-------|------|---------|
| `*tenant_id` | text 🔗 | |
| `*definition_id` | text 🔗 | |
| `*entity_id` | text | ID entitas target |
| `*value` | jsonb | typed sesuai data_type |
| PK | (definition_id, entity_id) | |

> **Larangan**: jangan pakai EAV untuk core data (uang, akuntansi, stok). Custom fields **hanya** untuk metadata bisnis non-core.

### 9.10 Workflow / Approval

#### `workflow_definitions`
Mendefinisikan rule approval per `entity_type` (`purchase_order`, `journal_entry_manual`, `leave_request`, `stock_adjustment`).
- `condition_jsonl`: array kondisi (mis. `amount > 5000000`).
- `steps_jsonl`: array step (`{ approver_role: 'director' }`).

#### `workflow_instances`, `workflow_steps`

### 9.11 Notification

#### `notifications`
| Field | Tipe | Catatan |
|-------|------|---------|
| 🔑 `id` | text | |
| `*recipient_user_id` | text 🔗 | |
| `*kind` | text | `low_stock`, `large_txn`, `approval_needed`, dll |
| `*title` | jsonb | LocaleString |
| `*body` | jsonb | LocaleString |
| `~entity_type` | text | |
| `~entity_id` | text | |
| `~read_at` | timestamptz | |

### 9.12 Audit

#### `audit_log` (di schema `audit`)
Append-only.
| Field | Tipe | Catatan |
|-------|------|---------|
| 🔑 `id` | text | |
| `*tenant_id` | text | |
| `*occurred_at` | timestamptz | |
| `*actor_user_id` | text | NULL utk system |
| `*actor_kind` | text CHECK | `'user' \| 'mcp' \| 'worker' \| 'system'` |
| `*action` | text | `'create' \| 'update' \| 'delete' \| 'post' \| 'reverse' \| 'login' \| ...` |
| `*entity_type` | text | |
| `*entity_id` | text | |
| `~before` | jsonb | snapshot sebelum |
| `~after` | jsonb | snapshot sesudah |
| `~diff` | jsonb | hasil deep-diff |
| `~ip` | inet | |
| `~user_agent` | text | |

> Index `(entity_type, entity_id, occurred_at DESC)` agar pertanyaan "siapa yang ubah X kapan saja" cepat.

---

## 10. API Design

### 10.1 Tiga Surface
1. **Server Actions** (Next.js) — untuk UI internal. Kontrak: function TypeScript.
2. **REST `/api/*`** — minimal:
   - `POST /api/sync/pos` — sinkronisasi POS offline (idempotent).
   - `GET/POST /api/files/*` — upload/download.
   - `POST /api/webhooks/*` — webhook eksternal (jika ada).
3. **MCP** — lihat §16.

### 10.2 Format Response REST/MCP
```json
// success
{ "ok": true, "data": <T> }
// failure
{ "ok": false, "error": { "code": "VALIDATION_FAILED", "messageKey": "...", "details": {...} } }
```

### 10.3 Idempotency
Endpoint mutasi REST **wajib** menerima header `Idempotency-Key`. Service layer cache hasil sukses selama 24 jam di tabel `idempotency_records (key, scope, response_json, expires_at)`.

### 10.4 Validation
Semua input di-validasi dengan Zod **di service layer** (bukan hanya di route). Kalau service di-call dari MCP, validasi tetap jalan.

### 10.5 Server Actions
- File: `app/(dash)/<module>/actions.ts` dengan `"use server"`.
- Wrapper helper `withAction(schema, handler)`:
  - Authenticate session
  - Authorize permission yang diminta
  - Parse + validate input
  - Panggil service
  - Tangkap `AppError` → kembalikan ke client untuk i18n
  - Tulis audit log

### 10.6 Pagination
- Cursor-based: `?cursor=<ULID>&limit=50`. Hindari OFFSET besar.
- Response: `{ data: T[], next_cursor: string | null }`.

---

## 11. Authentication & Authorization

### 11.1 Authentication
- **Library**: **better-auth** (decided — lihat ADR-0001). Session di tabel `sessions`. Cookie `__Host-session` dengan `Secure; HttpOnly; SameSite=Lax; Path=/`.
- Password hash: argon2id (cost menengah karena RAM 1 GB).
- **Email + password** sebagai metode primer. Tidak ada OAuth eksternal di Phase 1.
- 2FA **belum diaktifkan** (lihat SoT §18.4) — siapkan opsional via TOTP.

### 11.2 Otorisasi (RBAC + Permission Engine)

#### 11.2.1 Permission Atomik
Format: `<module>.<action>` atau `<module>.<resource>.<action>`. Contoh:
- `accounting.journal.create`
- `accounting.journal.post`
- `accounting.period.close`
- `pos.sale.refund`
- `pos.shift.open`
- `inventory.adjust`
- `inventory.transfer.create`
- `purchasing.po.approve`
- `hr.employee.read`
- `hr.payroll.run`
- `iam.user.create`
- `iam.role.create`
- `settings.taxrate.update`
- `mcp.read.*`, `mcp.write.*`

Semua permission **wajib** di-seed di `packages/db/seed/permissions.ts` saat menambah modul.

#### 11.2.2 Pemeriksaan
```ts
// di server action / mcp tool / service
if (!await iam.can(user, 'accounting.journal.post', { locationId })) {
  return err(new AppError('FORBIDDEN', 'errors.permission'));
}
```

`iam.can` membaca `user_roles` → `role_permissions`. Cache 60 detik per user.

#### 11.2.3 Scope Lokasi
Bila `user_roles.location_id IS NULL` → role berlaku global. Sebaliknya: role hanya berlaku di lokasi tersebut. `iam.can` menerima context `{ locationId }` opsional.

#### 11.2.4 Permission Khusus
- `*.*` → super admin (hanya untuk akun owner pada bootstrap; tidak boleh diberikan ke role baru sembarangan).
- `<module>.*` → semua di modul tertentu.

### 11.3 API Token (untuk MCP)
- Tabel `api_tokens (id, user_id, name, token_hash, scope_json, expires_at, last_used_at)`.
- Token format: `aroadri_<env>_<random32>`. Hash dengan SHA-256 sebelum disimpan.
- Scope: subset permissions user. Default sama dengan permission user; bisa dipersempit.
- Rotation: support generate baru + revoke lama.

---

## 12. Multi-Lokasi (Branch Dimension)

### 12.1 Aturan
- Setiap dokumen transaksional **wajib** punya `location_id`.
- Setiap `journal_line` **wajib** punya `location_id` (boleh beda dari header — untuk transaksi inter-cabang).
- Laporan keuangan wajib bisa filter per `location_id` (1 lokasi, multi lokasi, semua).
- Konsolidasi: laporan total = sum semua lokasi (eliminasi inter-cabang via akun "Inter-Branch Clearing" jika perlu — buat akun saat lokasi ke-2+ aktif).

### 12.2 Default Location
User punya `default_location_id` (di profile). UI mengisi otomatis tapi user dapat override.

### 12.3 Transfer Stok Antar Lokasi
2 step:
1. `stock_transfers` header → minta approval direktur (workflow).
2. Eksekusi → 2 movements: `transfer_out` di sumber, `transfer_in` di tujuan, dengan `reference_id` sama.

---

## 13. Internationalization

### 13.1 UI Strings
- Library: `next-intl`.
- File: `apps/web/messages/{id,en,zh}.json`. Bahasa default: `id`.
- Key namespace: `<module>.<screen>.<element>`. Contoh: `accounting.journal.button.post`.
- **Larangan**: hardcode string Bahasa Indonesia di JSX/template. Lint rule menangkap ini.

### 13.2 Data Master
- Kolom `name jsonb` (LocaleString). Render: pilih `name[user.locale] ?? name.id`.
- Pencarian full-text: index `tsvector` gabungan dari `name->>'id'`, `name->>'en'`, `name->>'zh'`.

### 13.3 Format Lokalitas
- Mata uang: `Intl.NumberFormat(locale, { style: 'currency', currency: 'IDR' })`. Untuk locale `id-ID` → `Rp 32.000`.
- Tanggal: `Intl.DateTimeFormat`.
- Bilangan: `Intl.NumberFormat`.
- Mandarin: gunakan `zh-CN` (Simplified). `Intl` mendukung secara native.

### 13.4 PDF & Excel Multi-Bahasa
- Export PDF/Excel menerima parameter `locale`. Render label sesuai locale yang diminta.
- Font Mandarin: gunakan **Noto Sans CJK SC** (embed subset di asset PDF) agar karakter Mandarin terbaca.

### 13.5 Pesan Error
- `AppError.messageKey` = i18n key (mis. `errors.accounting.period_closed`).
- UI translate sesuai locale user.

---

## 14. Offline-First POS (PWA)

### 14.1 Cakupan Offline
**Hanya modul POS** yang offline-capable. Modul lain (Akuntansi, HR, Reporting) online-only.

### 14.2 Strategi
1. **Service Worker** (Serwist) — pre-cache shell POS + asset.
2. **IndexedDB** (via `idb` library):
   - Cache produk, varian, modifier, harga, tax rate, member, shift saat ini.
   - Tabel `pending_orders` (outbox) untuk transaksi belum ter-sync.
3. **Sync**:
   - Saat online: background sync push `pending_orders` ke `POST /api/sync/pos`.
   - Idempotent (key = `client_order_uuid`).
   - Server menolak duplikat dengan kembalikan transaksi yang sudah ada.
4. **Periodic Refresh** menu/master:
   - Saat online, refresh tiap 5 menit atau saat menerima signal "dirty" dari server (via header `X-Master-Version`).
5. **Conflict Resolution**: order POS adalah **append-only** (pesanan baru) → tidak ada konflik.

### 14.3 Layout Data Offline
```
indexeddb: aroadri-pos
  ├─ products      (key: id)
  ├─ variants      (key: id)
  ├─ modifiers     (key: id)
  ├─ promotions    (key: id; filter active)
  ├─ tax_rates     (key: code)
  ├─ shifts        (key: id; only "open" shift)
  ├─ pending_orders (key: client_order_uuid)
  └─ meta          (key: 'last_synced', 'master_version', ...)
```

### 14.4 Format Outbox Entry
```json
{
  "client_order_uuid": "01HXY...",
  "created_at_client": "2026-05-05T12:34:56Z",
  "payload": { /* sales_order + lines + payments */ },
  "attempts": 0,
  "last_error": null
}
```

### 14.5 Client Clock Trust
Clock client tidak dipercaya. Server menerima `created_at_client` sebagai metadata, tapi `created_at` server = `now()` server. `placed_at` = `coalesce(created_at_client, now())` setelah validasi tidak lebih dari 24 jam dari sekarang.

### 14.6 Pengakuan Cetak Struk Offline
Printer struk + label terhubung ke mesin POS lokal (bluetooth / USB). Cetak terjadi sepenuhnya offline. ID struk lokal = `client_order_uuid`. Setelah sync, server mengembalikan `number` resmi → POS dapat cetak ulang receipt resmi bila perlu.

### 14.7 Listrik Padam
- Jangan hilangkan transaksi pada power loss → `pending_orders` di IndexedDB persist.
- POS menunjukkan banner peringatan "X transaksi belum ter-sync" sampai semuanya berhasil.

---

## 15. Audit Log

### 15.1 Ruang Lingkup
**Setiap mutasi data transaksional dan master wajib menulis audit log**.

### 15.2 Implementasi
- Helper service `audit.record({ action, entity, before, after, actor, ip })` dipanggil di akhir setiap function service yang melakukan mutasi.
- **Atau** trigger PostgreSQL pada tabel-tabel kunci yang menulis ke `audit.audit_log` otomatis (lebih tahan terhadap "developer lupa"). Strategi: **kombinasi** —
  - Trigger DB untuk safety net (capture before/after row).
  - Helper `audit.record` untuk konteks (action semantik, IP, user agent).

### 15.3 Read Model
- Service `audit.query({ entity_type, entity_id?, actor_id?, from, to, limit, cursor })`.
- Diekspos sebagai MCP tool `audit.search`.

### 15.4 Retensi
- Audit log retensi minimum 7 tahun (kepatuhan pajak Indonesia umumnya 10 tahun untuk wajib pajak).
- Partition by month untuk performa query.

---

## 16. MCP Server Design

### 16.1 Tujuan
Mengizinkan AI lokal (Gemini CLI, Claude Code, Antigravity) memanggil sistem ERP untuk:
- Membaca data (produk, jurnal, audit log, employee, dll.)
- Menulis data (buat PO, input jurnal, adjust stok, buat employee)
- Audit (query log, diff)

### 16.2 Transport
- **stdio** transport (untuk CLI klien lokal) — utama.
- **SSE/HTTP** transport (untuk klien remote) — opsional, di-gate di balik token.

### 16.3 Otentikasi
- Tools menerima `apiToken` via header / env. Server resolve token → user → permissions.
- Setiap tool **wajib** memeriksa permission yang setara dengan UI.

### 16.4 Daftar Tools (Phase 1 minimum)

#### Identity
- `iam.whoami()` → user info.
- `iam.list_locations()` → daftar lokasi yang dapat diakses.

#### Accounting
- `accounting.list_accounts({ locale?, type?, query? })`
- `accounting.create_journal({ posting_date, location_id, description, lines[], reference? })` — auto-balance check.
- `accounting.post_journal({ journal_id })`
- `accounting.reverse_journal({ journal_id, posting_date })`
- `accounting.get_period_status({ period_code })`
- `accounting.close_period({ period_code })` (perlu permission `accounting.period.close`)

#### Tax
- `tax.list_rates()`
- `tax.export_coretax({ period_code, format: 'csv' | 'xlsx' })`

#### Reporting
- `reporting.balance_sheet({ as_of, location_id?, locale })`
- `reporting.profit_loss({ from, to, location_id?, locale })`
- `reporting.cash_flow({ from, to, locale })`
- `reporting.general_ledger({ account_id, from, to, locale })`

#### Inventory
- `inventory.list_products({ query?, category? })`
- `inventory.get_stock({ product_id, location_id })`
- `inventory.adjust({ product_id, location_id, qty_delta, reason, note })` — perlu approval workflow.

#### Purchasing
- `purchasing.create_po({ supplier_id, location_id, lines[] })`
- `purchasing.approve_po({ po_id })`
- `purchasing.create_grn({ po_id, lines[] })`

#### POS
- `pos.list_sales({ location_id, from, to, channel? })`
- `pos.refund({ sales_order_id, reason, lines[] })`

#### HR & Payroll
- `hr.create_employee({ ... })`
- `hr.list_employees({ status?, location_id? })`
- `payroll.run({ period_code })` (membuat draft)
- `payroll.approve({ payroll_id })`

#### CRM
- `crm.create_member({ ... })`
- `crm.log_complaint({ ... })`

#### Audit
- `audit.search({ entity_type?, entity_id?, actor?, from?, to?, limit?, cursor? })`

### 16.5 Tool Definition Pattern
```ts
// apps/mcp/src/tools/accounting.create-journal.ts
export const tool = defineTool({
  name: 'accounting.create_journal',
  description: 'Membuat journal entry baru (status draft). Lines wajib balance.',
  inputSchema: z.object({
    posting_date: z.string().date(),
    location_id: z.string(),
    description: z.string().min(1),
    lines: z.array(z.object({
      account_id: z.string(),
      location_id: z.string(),
      description: z.string().optional(),
      debit: z.string(),   // bigint as string
      credit: z.string(),
    })).min(2),
  }),
  handler: async (input, ctx) => {
    if (!await iam.can(ctx.user, 'accounting.journal.create', { locationId: input.location_id })) {
      return mcpError('FORBIDDEN');
    }
    return services.accounting.createJournal(input, ctx);
  },
});
```

### 16.6 Penambahan Tool
**Setiap fitur UI baru wajib disertai MCP tool setara**. PR yang menambah UI tanpa tool MCP **harus ditolak** (lint rule + manual check).

---

## 17. Custom Field Engine

### 17.1 Penggunaan Yang Diizinkan
- Metadata produk yang spesifik perusahaan (mis. "kategori marketing", "supplier asli").
- Field opsional di customer (mis. "preferensi rasa").
- Field opsional di employee (mis. "nomor BPJS lokal").
- Tag arbitrer pada PO (mis. "musim", "campaign").

### 17.2 Larangan
- **Tidak boleh** untuk angka uang yang masuk ke jurnal akuntansi.
- **Tidak boleh** untuk kuantitas stok.
- **Tidak boleh** untuk pajak / tarif.
- **Tidak boleh** mengganti relasi formal (gunakan FK, bukan reference custom field).

### 17.3 UI
- `Settings → Custom Fields`. Daftar definisi per `entity_type`.
- Form rendering: `<EntityForm extra={<CustomFields entityType="product" entityId={id} />} />`.

### 17.4 Validation
- Validasi `data_type` saat insert/update (di service `customfield.setValue`).
- Bila `is_required=true`, form entitas tidak bisa save tanpa value.
- Bila `is_indexed=true`, jalankan migration untuk membuat expression index.

### 17.5 Pencarian
- API: `customfield.search({ entityType, definitionId, op: 'eq'|'in'|'contains', value })`.

---

## 18. Workflow / Approval Engine

### 18.1 Konfigurasi
- Daftar `entity_type` yang bisa di-workflow: `purchase_order`, `journal_entry_manual`, `leave_request`, `stock_adjustment`, `payroll`.
- Setiap entity_type punya **default workflow** yang sederhana (1 step ke direktur) yang dapat diubah via UI.

### 18.2 Skema Definisi
```json
{
  "entity_type": "purchase_order",
  "name": { "id": "Approval PO", "en": "PO Approval", "zh": "..." },
  "rules": [
    { "if": { "field": "total_amount", "op": "gt", "value": 5000000 },
      "steps": [
        { "approver": { "role_code": "finance_manager" } },
        { "approver": { "role_code": "director" } }
      ]
    },
    { "if": null, // default
      "steps": [{ "approver": { "role_code": "director" } }] }
  ]
}
```

### 18.3 Eksekusi
- Saat entitas di-submit (`submit_for_approval`), engine pilih rule pertama yang match → buat `workflow_instances` + `workflow_steps`.
- Approver dapat: approve / reject / request changes (kembali ke pemohon).
- Saat semua step approved → entity status → `approved`.

### 18.4 Notifikasi
- Saat step diaktifkan, kirim notifikasi ke approver target.
- MCP tool `workflow.list_my_pending_approvals()`.

---

## 19. Tax Engine

### 19.1 Tarif Awal (Seed)
| Code | Name | Rate (bps) | Calc | Posting Account |
|------|------|------------|------|-----------------|
| `PB1` | PBJT (pajak restoran) | 1000 (10%) | inclusive | `PB1 / PBJT Payable` |
| `PPN_OUT` | PPN Keluaran | 1100 (11%) | exclusive | `PPN Outcome (Vat Out)` |
| `PPN_IN` | PPN Masukan | 1100 (11%) | exclusive | `Vat In (PPN Income)` |
| `PPH21` | PPh 21 Karyawan | progresif | (dihitung di payroll engine) | `Income Tax Payable` / `Final Income Tax Payable` |
| `PPH23` | PPh 23 Jasa | 200 (2%) | exclusive (gross-up?) | `Final Income Tax 23 Payable` |
| `PPH25` | PPh 25 Badan | sesuai estimasi | exclusive | `Income Tax Expenses` |

> Tarif diubah hanya via UI Settings + change log, tidak di kode.

### 19.2 Perhitungan PB1 Inclusive (Aturan Wajib)
Karena PB1 inclusive (lihat SoT §6.5), harga jual yang ditampilkan **sudah termasuk** PB1.

```
gross = unit_price × qty
tax_base = gross / (1 + 0.10)  → simpan sebagai tax_base
pb1_amount = gross - tax_base  → simpan sebagai line_tax
```

Untuk laporan penjualan **net of PB1** (revenue): gunakan `tax_base`. Untuk laporan ke pelanggan: tampilkan `gross`.

### 19.3 PPN — Opt-In Engine (decided 2026-05-05, lihat ADR-0010)

#### 19.3.1 Aturan Default
- **Penjualan retail F&B** (`walk_in`, `gofood`, `grabfood`, `shopeefood`): **PB1 only**, **tidak ada PPN keluaran**.
- **Pembelian dari supplier PKP**: PPN Masukan (Vat In) **wajib tercatat** → akun `Vat In (PPN Income)` (DR).
- **PPN Keluaran**: tetap di-seed di `tax_rates` dengan `is_active=true`, namun **tidak diterapkan default** untuk channel retail (lihat resolusi `tax_rules` di §19.3.3).

#### 19.3.2 Skema `tax_rules`
| Field | Tipe | Catatan |
|---|---|---|
| 🔑 `id` | text | ULID |
| `*tenant_id` | text 🔗 | |
| `*scope_kind` | text CHECK | `'channel' \| 'customer_segment' \| 'product_category' \| 'global_default'` |
| `~scope_id` | text | id channel/segment/category — NULL untuk global |
| `*tax_code` | text 🔗 tax_rates.code | |
| `*is_applied_default` | boolean | TRUE = otomatis dipakai saat dokumen dibuat |
| `*priority` | int | resolusi konflik (semakin besar = lebih spesifik) |
| `*effective_from` | date | |
| `~effective_until` | date | |

Seed default:
| scope_kind | scope_id | tax_code | is_applied_default | priority |
|---|---|---|---|---|
| `channel` | `walk_in` | `PB1` | true | 100 |
| `channel` | `gofood` | `PB1` | true | 100 |
| `channel` | `grabfood` | `PB1` | true | 100 |
| `channel` | `shopeefood` | `PB1` | true | 100 |
| `global_default` | NULL | `PPN_IN` | true | 10 (selalu apply ke purchase invoice dari supplier PKP) |
| `global_default` | NULL | `PPN_OUT` | false | 10 (tidak default; aktifkan via rule per channel/segment kelak) |

#### 19.3.3 Algoritma Resolusi `tax.resolve(context)`
Input: `{ channel, customer_id?, product_category_id, document_kind: 'sales' | 'purchase' }`.

1. Ambil semua `tax_rules` yang `effective_from <= today AND (effective_until IS NULL OR effective_until >= today)`.
2. Filter berdasarkan `scope_kind`:
   - `channel` jika `scope_id == channel`
   - `customer_segment` jika `customer_id` punya segmen yang match
   - `product_category` jika produk match category
   - `global_default` selalu match
3. Untuk setiap `tax_code`, ambil rule dengan `priority` tertinggi yang `is_applied_default=true`.
4. Return list of `{ tax_code, calculation, rate_bps, posting_account_id }`.

**Untuk transaksi retail F&B di toko Malioboro saat ini**: hasil resolve = `[PB1]` (PPN Out tidak masuk karena default rule untuk channel retail tidak include PPN_OUT).

#### 19.3.4 Validation Guard di UI
Saat user di Settings → Tax Configuration mencoba menambah/edit rule yang menyebabkan **PB1 + PPN_OUT** bersamaan untuk channel yang sama:
- Tampilkan warning: "Channel ini sudah dikenakan PB1. Menambahkan PPN keluaran berisiko pajak ganda. Apakah Anda yakin? Konsultasikan konsultan pajak terlebih dulu."
- Tetap izinkan dengan konfirmasi (audit log mencatat).

#### 19.3.5 PPN Masukan (Selalu Aktif)
Saat membuat Purchase Invoice (dari GRN supplier PKP):
- UI form: field `ppn_in_amount` (bigint, opsional).
- Bila diisi: tax_lines berisi `{ code: 'PPN_IN', tax_amount: <amount>, posting_account_id: <Vat In> }`.
- JE: `Inventory/Asset (DR) + Vat In (DR) | Account Payable (CR)`.

#### 19.3.6 Aktivasi PPN Keluaran (Phase Future)
Saat user ingin aktifkan untuk B2B:
1. Tambah `customer_segments` row "B2B PKP".
2. Tambah `tax_rules`: `scope_kind='customer_segment'`, `scope_id='b2b_pkp'`, `tax_code='PPN_OUT'`, `is_applied_default=true`, `priority=200`.
3. Tipe dokumen "Sales Invoice B2B" (di-build saat fitur diminta).
4. Faktur Pajak generator (di-build saat fitur diminta).

> Engine **tidak perlu rewrite**; cukup tambah baris di `tax_rules` + UI untuk dokumen B2B.

### 19.4 Export Coretax
- `tax.export_coretax(period_code, type='ppn-out'|'ppn-in'|'pph23'|'pb1')` → menghasilkan file CSV/XLSX layout Coretax.
- Layout di `packages/services/tax/coretax-templates/*.ts`. Update bila layout Coretax berubah.

### 19.5 PPh 21
- Engine progresif PPh 21 (TER bulanan & TKP) di `packages/services/payroll/pph21.ts`.
- Tabel PTKP dan TER di-config di DB (`pph21_ter_brackets`, `pph21_ptkp`), dapat di-update tanpa deploy.

---

## 20. Accounting Engine

### 20.1 Posting Rules
- Setiap dokumen transaksional yang berdampak akuntansi memiliki **JE Generator**: function pure yang menghasilkan `journal_entry + lines` dari dokumen.
- Pattern di service: `accounting.postFor*` (e.g., `postForSalesOrder`, `postForPurchaseInvoice`).

### 20.2 Contoh Posting POS Sale (Cash + PB1 inclusive)
Asumsi: penjualan kas Rp 33.000 (sudah termasuk PB1 10%).
- `tax_base = 33000 / 1.10 = 30000`
- `pb1 = 3000`

| Akun | DR | CR |
|------|----|----|
| Cash (location: Malioboro) | 33.000 | |
| Sales | | 30.000 |
| PB1 / PBJT Payable | | 3.000 |

### 20.3 Contoh Posting Penjualan via GoFood (komisi 20%)
Pesanan Rp 33.000 (dilihat customer), komisi platform 20% = Rp 6.600. Net diterima dari platform Rp 26.400 (T+settlement).

Saat sale di POS (channel=gofood, payment via "GoFood"):
| Akun | DR | CR |
|------|----|----|
| Account Receivable - GoFood | 33.000 | |
| Sales | | 30.000 |
| PB1 / PBJT Payable | | 3.000 |

Saat settlement dari GoFood:
| Akun | DR | CR |
|------|----|----|
| Cash in Bank (BCA) | 26.400 | |
| Commission Expense | 6.600 | |
| Account Receivable - GoFood | | 33.000 |

> **Aturan**: tabel `partners` punya partner khusus untuk masing-masing platform (GoFood, GrabFood, ShopeeFood) dengan akun AR sub-ledger. Settlement dilakukan harian/mingguan via input bank.

### 20.4 Pemisahan Period
- Setiap JE wajib `period_id` aktif (`status=open`).
- Saat period di-`close`: status `closing` (read-only untuk posting baru, tapi reversal masih bisa di period berikutnya), kemudian `closed`.
- Closing entry (revenue & expense → income summary → retained earnings) di-generate saat period closing fiskal (akhir tahun).

### 20.5 Multi-Lokasi
- `location_id` adalah **dimensi**, bukan akun terpisah. Akun tetap (e.g., "Sales") sama untuk semua lokasi; filter per lokasi di laporan.
- Pengecualian: akun-akun yang sudah lokasi-spesifik di COA (Prepaid Rent of Jakarta Office, dll.) tetap dipakai sesuai existing — saat menambah lokasi baru, jangan duplicate akun, gunakan dimensi.

### 20.6 Reversal
- Untuk membatalkan JE yang sudah posted: buat JE baru dengan amount terbalik (`reversed_by_je_id` ke source). Tidak boleh edit JE yang sudah posted.

---

## 21. Spesifikasi Modul

> Untuk masing-masing modul: **Data**, **Workflow**, **API**, **UI**, **Edge Cases**, **MCP Tools**, **Audit Hooks**. Hanya highlight kunci ditulis di sini; detail lengkap akan diturunkan ke ADR atau spec terpisah saat implementasi.

### 21.1 Accounting (Phase 1)

#### Data
COA, Period, Journal Entry, Journal Line, Tax Rate. Lihat §9.2.

#### Workflow
```
Manual JE: draft → (workflow approval if amount > threshold) → posted → (optionally) reversed
Auto JE: dari sales/purchase/payroll → posted langsung (sudah pre-validated di doc source)
Period: open → closing (no new postings) → closed
```

#### UI Screens
- COA browser (tree view, search, multi-bahasa).
- Journal Entry editor (table-based, validate balance live).
- Period management.
- Audit per JE.

#### Edge Cases
- JE dengan `total_debit=0` → reject.
- JE di period closed → reject.
- JE dengan akun `is_postable=false` → reject (parent header tidak boleh diisi).
- JE dengan akun `is_active=false` → reject.

#### MCP Tools
`accounting.create_journal`, `accounting.post_journal`, `accounting.reverse_journal`, `accounting.list_accounts`, `accounting.close_period`.

#### Audit Hooks
Setiap CRUD JE & period → `audit_log`.

---

### 21.2 Reporting (Phase 1)

#### Output
- Neraca / Balance Sheet (per as-of-date, per location & konsolidasi)
- Laba Rugi / P&L (per range, per location & konsolidasi)
- Arus Kas / Cash Flow (per range)
- Buku Besar / General Ledger (per akun, per range)
- Neraca Saldo / Trial Balance (per as-of-date)
- Jurnal Umum / Journal Listing (per range)
- Laporan per cabang (filter location_id)
- Laporan penjualan (per kasir, produk, jam, saluran, metode bayar, best/worst — lihat SoT §16.1)
- Laporan inventory (stok harian, pergerakan, near-expiry, nilai persediaan, variance — lihat SoT §16.2)

#### Pattern
- Service: `reporting.balanceSheet({ asOf, locationId? })` → mengembalikan JSON struktural.
- Renderer terpisah: HTML, PDF, Excel — terima JSON, render sesuai locale.
- **Cache**: laporan akuntansi yang melibatkan period closed dapat di-cache di `report_cache` table (key: hash dari params + max(updated_at) jurnal). Invalidate saat reversal.

#### Bahasa
Setiap laporan dapat di-render dalam id/en/zh.

#### Edge Cases
- Asof-date di period belum exist → kosongkan (tampilkan saldo awal saja).
- Laporan saat period dalam status `closing` → tampilkan banner "preliminary".

---

### 21.3 Tax (Phase 1)

#### Data
- `tax_rates`, `tax_filings (period_code, kind, status, filed_at, file_path)`.

#### Workflow
- PPN keluaran/masukan terbentuk otomatis dari sales/purchase invoice.
- PB1 terbentuk dari setiap sale.
- PPh 21 terbentuk dari setiap payroll run.
- PPh 23 dipicu manual saat ada pembayaran jasa kena pajak.
- Akhir bulan: jalankan `tax.export_coretax(period_code)` → unggah manual ke Coretax.

#### UI
- `Tax → Periode <bulan>` dashboard: PPN, PB1, PPh — total + status filing.
- Export button per jenis.

#### Edge Cases
- Period belum ditutup → export "preliminary".
- Saat tarif PPN berubah (mis. 11% → 12%) → tarif baru efektif `effective_from`. Tidak edit tarif lama (audit).

---

### 21.4 POS (Phase 2)

#### Data
`sales_orders`, `sales_order_lines`, `payments`, `refunds`, `shifts`, `discounts_applied`.

#### Workflow
1. Buka shift → `shifts.opened_at`, opening cash.
2. New order → tambah lines (varian, modifier, topping).
3. Apply diskon / promo → engine validasi rule.
4. Tax calculation → PB1 inclusive.
5. Payment (split allowed) → `payments[]`.
6. Save order:
   - Online: insert ke server, post journal.
   - Offline: simpan ke IndexedDB outbox.
7. Cetak struk + label QR.
8. KDS scan → mulai produksi.
9. End-of-shift → cash count → variance.

#### Diskon / Promosi
- Engine `promotions.apply(orderDraft)` → mengembalikan diskon yang berlaku.
- Validasi: tanggal aktif, kuota, syarat min. Saat ini SoT §7.2 menyatakan tidak ada batas waktu/kuota/min — engine harus menerima null sebagai "tidak ada batas".

#### Refund
- Approver: Kasir (lihat SoT §6.3).
- Refund line-level (partial) atau full.
- Memicu reverse journal + reverse stock movement.

#### Pembatalan Transaksi (Void)
- Hanya jika belum bayar (status=open). Approver: Kasir.
- Setelah paid: harus refund.

#### Customer-Facing Display
- Subdomain / route khusus `/display/:location_id` (read-only).
- Subscribe via SSE / polling 3 detik.
- Tampilkan: pickup number, status (queued / making / ready), produk.

#### Edge Cases
- Shift belum dibuka → tolak transaksi.
- Stok bahan baku tidak cukup (BOM deduct) → tolak penjualan **atau** allow "negative stock" dengan flag warning (default: tolak; setting per produk).
- Modifier topping yang tidak punya stok → tolak.
- Network drop saat sync → retry exponential backoff (max 1 jam, lalu notify user manual).

#### MCP Tools
`pos.list_sales`, `pos.refund`, `pos.list_shifts`.

---

### 21.5 Inventory (Phase 2)

#### Data
Lihat §9.3.

#### Workflow Stock Adjustment
- User submit adjustment → workflow approval → eksekusi → stock_movement + JE (Inventory ↔ Adjustment Account).

#### Workflow Transfer
- Source → Destination, dua step (out + in dengan flag `in_transit`).

#### Workflow Stock Take (Opname)
1. Buat sesi opname per location → freeze counts.
2. Input fisik per produk.
3. Submit → variance per produk.
4. Approval → buat adjustments per produk.

#### BOM Auto-Deduct
- Saat sales paid, untuk setiap line: lookup active BOM → deduct ingredients (negative stock_movement reason='sale').
- Bila ingredient track_batch=true: pilih batch FIFO (oldest expiry).

#### Min Stock Alert
- Worker jalankan tiap jam: bandingkan `stock_levels.qty` vs `stock_levels.min_stock`. Jika di bawah → kirim notifikasi.

#### Near-Expiry Alert
- Worker harian: cari batch dengan `expiry_date - now < N days` → notifikasi.

#### Edge Cases
- Produk track_batch tanpa batch saat diterima → tolak GRN.
- Stock movement dengan stock_levels jadi negatif → reject (kecuali setting allow_negative=true di lokasi tertentu).

---

### 21.6 Purchasing (Phase 2)

#### Data
Lihat §9.4.

#### Workflow PO
```
draft → submitted → (workflow approval) → approved → partial → received → closed
                                                  ↘ cancelled
```

#### GRN
- Pembuatan GRN dari PO (atau standalone untuk pembelian langsung tanpa PO untuk emergency).
- Pencocokan qty: `received <= ordered` per line.
- GRN posting JE: Inventory (DR) / Goods Received Not Invoiced (CR).

#### Purchase Invoice
- Match ke GRN. Bila qty/harga match: post JE final (GRNI DR / AP CR + PPN In jika supplier PKP).

#### Pembayaran
- Dari Cash/Bank → AP. Modul "Payment" generik (juga digunakan oleh sales receipt, payroll).

#### Edge Cases
- Pembelian aset tetap (lihat SoT §10.4): line memilih "asset" kategori produk → tidak masuk inventory, masuk Construction in Progress / Equipment + Pre-Operation Expense bila pre-launch.

---

### 21.7 Kitchen / KDS (Phase 3)

#### Data
- `kds_orders` mirror dari `sales_orders` dengan status produksi.
- Optional: integrasi Naixer via API (jika ada).

#### Workflow
1. POS create order → push event ke queue KDS.
2. KDS view: order list per status (queued / making / ready / served).
3. Karyawan scan QR di Naixer → Naixer menyajikan resep → karyawan mark "ready" di KDS app.
4. Customer-facing display update.

#### Integrasi Naixer
- **Belum jelas apakah Naixer punya API** (lihat SoT §14.1). Cara fallback: karyawan input manual scan QR di KDS Aroadri → KDS Aroadri kirim instruksi ke Naixer via tampilan / mungkin POST API. **Riset lapangan dibutuhkan**. Sampai itu jelas, modul KDS Aroadri **mandiri** dari Naixer (Naixer tetap dipakai sesuai workflow lama).

#### Waste Log
- Modul `waste`: input qty + reason → stock_movement reason='waste' + JE Loss.

---

### 21.8 HR & Payroll (Phase 4) + SOP Operational (SoT §12, Lampiran SOP 2026-04-06)

#### Data
Lihat §9.6.

#### Attendance
- Mobile-friendly check-in: GPS verifikasi lokasi (toleransi 100 m), atau scan QR di lokasi.
- Shift-based: kaitkan check-in dengan `shift_definitions`.
- **SOP aturan keterlambatan** (SOP Aroadri Tea 2026-04-06):
  - Toleransi: maksimal 15 menit dari jam shift.
  - Jatah telat: **3× per bulan** per karyawan.
  - Setelah jatah habis: **potong gaji Rp 50.000** per keterlambatan.
  - Karyawan wajib kabari grup WA maksimal **10 menit sebelum** shift dimulai.
  - Tanpa kabar + tanpa alasan: **potong Rp 100.000**.

#### Payroll Run
1. Akhir bulan: pilih period.
2. Hitung gaji per karyawan: gaji pokok + tunjangan + lembur + bonus − BPJS − PPh 21 − potongan (terlambat, absen).
3. Generate `payrolls` (header) + `payroll_lines` (per karyawan, per komponen).
4. Approval direktur.
5. Mark paid → JE Salaries Expense (DR), Cash/Bank (CR), BPJS Payable (CR), PPh 21 Payable (CR).
6. Generate slip gaji digital (PDF) per karyawan + email atau download portal.

#### PPh 21
- Engine progresif TER bulanan + tahunan (lihat §19.5).

#### Cuti & Surat Peringatan
- Pengajuan cuti via portal karyawan → approval direktur (workflow).
- SP1/SP2/SP3 di tabel `disciplinary_actions` dengan attachment.
- **Aturan cuti SOP**: 1 hari per minggu; swap dengan konfirmasi atasan; tidak boleh combine tanpa alasan darurat.

#### SOP Operational Rules (from SOP Aroadri Tea 2026-04-06)

##### 21.8.1 Store Hours & Shifts

| Item | Value |
|---|---|
| Mall hours | 10:00 – 22:00 WIB |
| Store operational hours | 09:30 – 22:00 WIB |
| Shift pagi | 09:30 – 17:30 WIB |
| Shift siang | 14:30 – 22:30 WIB |
| Break pagi | 13:30 – 15:30 WIB |
| Break siang | 16:00 – 17:00 WIB **atau** setelah 20:30 WIB |
| Break exception (tidak boleh 18:00–20:30) | Shalat, maag, karyawan perempuan saat menstruasi |

##### 21.8.2 Store Operational Rules

| Rule | Detail |
|---|---|
| **Free tester** | Wajib sediakan 2 varian (milk tea + lemon tea) setiap hari 10:30–21:30 WIB |
| **Minimum staff** | Min. 1 orang jaga saat jam operasional |
| **Leave policy** | Karyawan tidak boleh tinggal > 5 menit tanpa pengganti |
| **Tea stock alert** | Jika stock < 300 ml antara 10:00–20:00 WIB → wajib buat teh baru (Osmanthus, Glutinous, Bamboo, Roasted Yellow Tea) |
| **Creamer alert** | Jika stock < 1.000 ml → wajib buat creamer baru |
| **Late-night exception** | Setelah 20:00 WIB jika stock habis → buat setengah porsi saja |

##### 21.8.3 Opening & Closing Procedures

**Opening (shift pagi):**
1. Seduh teh sesuai kebutuhan.
2. Buat creamer jika diperlukan.
3. Bersihkan meja, kursi, lantai.
4. Siram tanaman dalam/luar ruangan.
5. Bersihkan & rapikan area bar, pintu kaca.
6. Bersihkan mesin sesuai petunjuk.
7. Pastikan stock teh sudah diseduh & eggtart dipanggang jika diperlukan.
8. Input mutasi SO jika ada penggunaan barang pagi.

**Closing (shift malam):**
1. Tutup toko tepat waktu 22:00 WIB.
2. Mulai close order + larutan pembersih ~21:50 WIB (bisa berubah sesuai kondisi).
3. Bersihkan mesin, wadah teh, pan oven.
4. Bersihkan lantai dengan cairan pembersih.
5. Rapikan meja, kursi, area kerja, area bar.
6. Pencatatan & laporan keuangan harian.
7. **Minggu malam**: deep clean mesin (single tube) + bersihkan jejak hitam di lantai.
8. **Senin pagi**: lanjutkan pembersihan + clean meja/kursi/kaca seluruh toko dengan pembersih.

**Periodic cleaning schedule:**
- Area kaca & lantai: setiap hari.
- Selokan dapur & bar: setiap 2 hari.
- Mesin penyeduh teh + selang: **setiap hari Minggu malam**.
- Deep clean seluruh mesin: **setiap hari Minggu malam**.

##### 21.8.4 Production Standards (Product Making)

**Wajib menggunakan alat ukur** (gelas ukur/takaran/timbangan) untuk:
- Teh, es batu, lemon, egg tart, ice sugar syrup, air putih.
- **Dilarang** memperkirakan secara manual.

**Urutan produksi Milk Tea:**
1. Letak gelas shaker di bawah saluran mesin.
2. Scan/pilih menu → tunggu produksi selesai.
3. Ambil → masukkan 2-3 es batu → blend sesuai ketentuan.
4. Tambah es batu sesuai ukuran pesanan.
5. Shake → tuang ke gelas saji.
6. Tutup → siap disajikan.

**Urutan produksi Lemon Tea:**
1. Masukkan lemon ke shaker → tambahkan 2-3 es batu → smash.
2. Letak shaker di bawah mesin → scan/pilih menu.
3. Tuang ice sugar syrup sesuai instruksi (gelas ukur).
4. Tambah es batu sesuai ukuran pesanan.
5. Shake → tuang ke gelas saji → tutup → siap.

**Urutan produksi Fresh Tea:**
1. Letak shaker di bawah mesin → scan/pilih menu.
2. Tuang air putih + ice sugar syrup + 2-3 es batu (jika blend).
3. Tambah es batu sesuai kebutuhan pesanan.
4. Opsional shake.
5. Tuang ke gelas saji → tutup → siap.

**Urutan produksi Hot (Milk Tea & Fresh Tea):**
1. Shaker di bawah mesin → scan/pilih.
2. Fresh tea: tambahkan air putih + ice sugar syrup + 2-3 es batu → blend.
3. Milk tea: langsung blend dengan 2-3 es batu.
4. Tambah 4-5 es batu.
5. Pindahkan ke stemer → steam 65°C.
6. Tuangkan ke gelas saji → tutup → siap.

**Error product:** wajib perbaikan, cari tahu letak kesalahan, buat ulang. **Dilarang** menyajikan produk tidak sesuai standar.

##### 21.8.5 Area Cleanliness Rules

**Area meja kerja (bar):** hanya boleh berisi:
- Peralatan pembuatan minuman, kain lap.
- **Dilarang**: HP, tumbler pribadi, gelas non kerja.

**Area bar:** hanya peralatan:
- Gelas shaker, gelas ukur, timbangan, gula.
- **Dilarang**: HP, tumbler, benda tidak berkaitan pekerjaan.
- Wajib kering, bebas genangan air.
- **Tidak boleh makan** di area bar (hanya di dapur/luar).
- Setelah selesai bikin minuman → **wajib langsung bersihkan** area bar.

##### 21.8.6 Employee Appearance & Conduct

- Wajib gunakan **apron** saat bekerja.
- Wajib jaga kebersihan diri.
- Tidak boleh fokus tugas pribadi dan abaikan tim.
- **Ramah, cepat, profesional** dalam pelayanan.
- Wajib saling bantu saat toko ramai.
- **Dilarang** mengabaikan pelanggan.
- Setiap pesanan wajib diproses teliti & sesuai standar.
- Setelah pakai peralatan → bersihkan & kembalikan ke tempat semula.

##### 21.8.7 Knowledge Requirements

Setiap karyawan **wajib**:
1. Bisa operasional seluruh mesin.
2. Mengetahui seluruh jenis teh yang tersedia.
3. Bisa jelaskan ke pelanggan bingung memilih jenis teh.
4. tahu stock teh & creamer thresholds.

##### 21.8.8 SOP Enforcement

- Seluruh karyawan wajib tanda tangan persetujuan SOP saat onboarding.
- Potongan gaji otomatis via payroll (late fine Rp 50.000, absence fine Rp 100.000).
- Dokumentasi SOP di `/docs/hr/sop-operasional` (bagian §25.4 documentation system).
- SOP dapat berubah sewaktu-waktu; karyawan dianggap tahu setelah diinformasikan owner.

---

### 21.9 CRM & Loyalty (Phase 5)

#### Data
Member data (lihat SoT §13.1) di `partners` (kind=customer + is_member).

#### Loyalty
- Engine point-based:
  - Earn: 1 poin per Rp 10.000 (configurable).
  - Tier: bronze < silver < gold (configurable).
  - Redeem: voucher diskon nominal / freebie.
- Tabel `loyalty_accounts` (per member), `loyalty_transactions` (audit).

#### Komplain
- `complaints (id, customer_id, location_id, occurred_at, description, status)` + `complaint_compensations (complaint_id, kind: 'product_replacement' | 'voucher' | 'refund', amount, journal_entry_id)`.

---

## 22. Error Handling & Logging

### 22.1 Error Boundary (Frontend)
- Top-level error boundary di Next.js app router (`error.tsx` per segment).
- Pesan ditampilkan via i18n (mapping `AppError.code` + `messageKey`).

### 22.2 Server Logging
- `pino` + JSON output → stdout/PM2 log file, lalu dirotasi.
- Setiap request log: `method, path, status, duration_ms, user_id, idempotency_key, request_id`.
- Setiap service mutation: `service.<module>.<action>`, `entity_id`, `duration_ms`.
- **Tidak boleh** log password, token, isi PII (KTP, NPWP) — gunakan masking.

### 22.3 Request ID
- Header `X-Request-ID` (generate ULID jika tidak ada). Propagate ke log.

### 22.4 PII Masking
Helper `mask({ ktp: '...' })` → `{ ktp: '12**********0001' }`. Wrap setiap log yang menyentuh entity employees / customers / partners.

---

## 23. Testing Strategy

### 23.1 Pyramid
- **70% Unit** (`packages/services/**/*.test.ts`) — Vitest.
- **25% Integration** (panggil service dengan DB real / testcontainers) — Vitest.
- **5% E2E** (Playwright) — happy path login, buat JE, post sale.

### 23.2 Aturan Wajib
- Setiap fungsi `accounting.*` punya test untuk:
  - Balance check (debit=credit).
  - Permission denial.
  - Period closed rejection.
  - Account inactive rejection.
- Setiap fungsi pajak punya test untuk:
  - Inclusive vs exclusive math.
  - Tarif berubah `effective_from`.
- Setiap MCP tool punya integration test (calls handler, checks DB state).

### 23.3 Test Database
- Buat schema `test` di Postgres dev. Setiap test suite: transaction wrap → rollback. Jangan share state antar tests.
- **Larangan**: mock database untuk test bisnis logic (lihat P10 — fail loud).

### 23.4 Snapshot Testing
- Untuk laporan (Balance Sheet, P&L) gunakan snapshot per locale untuk regression.

### 23.5 Coverage
- Threshold minimum coverage di `accounting`, `tax`, `payroll`: 80% lines.

---

## 24. Performance & Memory Discipline

### 24.1 Budget Memory (server 2 GB)
Lihat tabel definitive di §4.3. Ringkas:
- `apps/web` (ERP): ≤ 450 MB target, 640 MB hard limit.
- `apps/site` (publik): ≤ 250 MB target.
- `apps/mcp`: ≤ 120 MB.
- `apps/worker`: ≤ 150 MB.
- HestiaCP reverse proxy: ≤ 60 MB.
- Total target ≤ 1.28 GB; menyisakan ~ 720 MB untuk OS + spike.

### 24.2 Strategi
- Standalone build Next.js (`output: 'standalone'`).
- Disable Next.js image optimizer (memori-mahal); gunakan static images / CDN.
- Tree-shake import (Biome lint).
- Avoid SSR untuk halaman heavy (laporan besar) → render client-side dengan progressive load.
- Streaming response untuk laporan besar (pakai ReadableStream).
- Pagination wajib di list endpoints (default 50 max 200).

### 24.3 DB Performance
- Index FK + filter columns (lihat §8.2).
- `EXPLAIN ANALYZE` query lambat (> 100 ms) di staging.
- Pakai materialized view untuk dashboard (refresh tiap 5 menit).

### 24.4 Bundle Budget
- Halaman pertama (login): ≤ 200 KB JS gzipped.
- Halaman dashboard: ≤ 500 KB JS gzipped.
- Halaman POS: ≤ 600 KB JS gzipped.

---

## 25. Security Checklist

### 25.1 Mandatory Baseline (existing)
- [ ] Semua route protected by default; allowlist publik di middleware.
- [ ] Password hash argon2id, salt unik.
- [ ] Session cookie `__Host-` + `Secure` + `HttpOnly` + `SameSite=Lax`.
- [ ] CSRF protection: SameSite + double-submit cookie untuk form server actions.
- [ ] Input validation Zod di setiap mutation.
- [ ] Output escaping React default (jangan `dangerouslySetInnerHTML` kecuali pasti aman).
- [ ] Rate limit pada login (5 percobaan / 15 menit / IP).
- [ ] PII (NPWP, KTP, telp) encrypted at rest (pgcrypto field-level atau aplikasi-level dengan key di KMS/env).
- [ ] HTTPS only (HestiaCP/Let's Encrypt).
- [ ] Header keamanan: HSTS, CSP, X-Content-Type-Options, X-Frame-Options.
- [ ] Audit setiap login (success/fail).
- [ ] Token API (MCP) di-hash di DB; rotasi mudah; revoke instan.
- [ ] Backup terenkripsi sebelum diunggah off-site.
- [ ] Secret di `.env`; tidak commit `.env`. `.env.example` lengkap dengan placeholder.
- [ ] Dependency audit otomatis (npm audit / Renovate) di CI.

### 25.2 Military-Level Security (SoT §18.2 — added 2026-05-09)

> "Keamanan level militer" per user: semua aspek di bawah kecuali 2FA mandatory (opsional untuk user individual).

#### 25.2.1 Enkripsi Data-at-Rest (Field-Level)

**Semua kolom berikut dienkripsi AES-256-GCM di level aplikasi:**
- `users.phone`
- `users.email` (selain untuk login lookup)
- `partners.phone`, `partners.npwp`, `partners.ktp`
- `partners.email` (customer/supplier)
- `employees.ktp`, `employees.npwp`, `employees.bpjs_kesehatan`, `employees.bpjs_tenagakerja`
- `members.phone`, `members.email`, `members.dob`
- `sessions.token` (hash, bukan plain)
- `sessions.refresh_token` (hash)
- Kolom `reference_document` di audit_log yang mungkin mengandung PII

**Implementasi:**
```ts
// packages/shared/crypto/field-encrypt.ts
// Menggunakan Node.js crypto (built-in, tidak perlu library tambahan)
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY = Buffer.from(env.ENCRYPTION_KEY!, 'hex'); // 32 bytes hex = 64 chars

export function encrypt(plaintext: string): string {
  const iv = randomBytes(12); // 96-bit IV untuk GCM
  const cipher = createCipheriv(ALGORITHM, KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
}

export function decrypt(ciphertext: string): string {
  const [ivB64, tagB64, dataB64] = ciphertext.split(':');
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const encrypted = Buffer.from(dataB64, 'base64');
  const decipher = createDecipheriv(ALGORITHM, KEY, iv);
  decipher.setAuthTag(tag);
  return decipher.update(encrypted) + decipher.final('utf8');
}
```

**Rules:**
- Master key (`ENCRYPTION_KEY`) disimpan di environment variable, bukan di repo.
- Rotation: key rotation setiap 90 hari. Proses: encrypt ulang semua data dengan key baru. Simpan key lama untuk decrypt data lama.
- Init vector (IV) selalu fresh per enkripsi (tidak reuse).
- Auth tag disimpan bersama ciphertext (append-only).
- Dokumen (CV, KTP scan, kontrak) disimpan di object storage (R2/S3) dengan encrypted at-rest, bukan di database BLOB.

#### 25.2.2 Enkripsi Data-in-Transit

- TLS 1.2+ wajib; TLS policy dikelola di HestiaCP/Nginx/Apache.
- HSTS header: `max-age=31536000; includeSubDomains; preload`
- Tidak ada HTTP fallback untuk subdomain ERP/MCP kecuali redirect ke HTTPS.
- Certificate otomatis via Let's Encrypt di HestiaCP.

#### 25.2.3 Brute Force Protection

**Rate limiting login:**
- Maksimal **5 percobaan gagal** per IP dalam **15 menit** → blokir sementara 15 menit.
- Maksimal **5 percobaan gagal** per akun dalam **15 menit** → blokir sementara 15 menit + kirim email notification.
- Percobaan gagal > 20× dalam 1 jam → dianggap attack, blokir 24 jam + audit log + notifikasi admin.
- Tabel: `login_attempts (user_id?, ip_address, succeeded, attempted_at)` — retensi 90 hari.

**Login attempt rate limit:**
```ts
// packages/services/auth/rate-limit-login.ts
// Di middleware / rate limit middleware
const WINDOW_MS = 15 * 60 * 1000; // 15 menit
const MAX_ATTEMPTS_PER_IP = 5;
const MAX_ATTEMPTS_PER_USER = 5;

async function checkLoginRateLimit(ip: string, userId?: string) {
  const windowStart = Date.now() - WINDOW_MS;
  const [ipAttempts, userAttempts] = await Promise.all([
    db.query.loginAttempts.findMany({
      where: and(eq(loginAttempts.ipAddress, ip), gt(loginAttempts.attemptedAt, windowStart)),
      orderBy: desc(loginAttempts.attemptedAt),
      limit: MAX_ATTEMPTS_PER_IP
    }),
    userId ? db.query.loginAttempts.findMany({
      where: and(eq(loginAttempts.userId, userId), gt(loginAttempts.attemptedAt, windowStart)),
      orderBy: desc(loginAttempts.attemptedAt),
      limit: MAX_ATTEMPTS_PER_USER
    }) : [[]]
  ]);
  if (ipAttempts.length >= MAX_ATTEMPTS_PER_IP) throw new AppError('RATE_LIMITED', 'auth.tooManyAttempts.ip');
  if (userId && userAttempts.length >= MAX_ATTEMPTS_PER_USER) throw new AppError('RATE_LIMITED', 'auth.tooManyAttempts.user');
}
```

**Email notification saat akun diblokir:**
```ts
// Kirim email ke user: "Percobaan login gagal terdeteksi. Jika bukan Anda, segera ubah password."
// Template: auth/account-locked-notification.{id|en|zh}.json
```

#### 25.2.4 CAPTCHA / Anti-Bot

**Halaman yang wajib punya CAPTCHA:**
- `/login` — setiap percobaan atau setelah 2× gagal
- `/member/daftar` (signup member)
- `/kontak` (form publik)
- `/api/member/signup` (endpoint)
- `/api/member/request-otp` (endpoint)

**Implementasi:**
- **Primary**: Cloudflare Turnstile (invisible, non-intrusive).
- **Fallback**: hCaptcha (bila Turnstile tidak tersedia).
- Validasi di server: verify token Turnstile/hCaptcha sebelum proses.
- Error message saat CAPTCHA gagal: i18n key `auth.captchaFailed`.

```ts
// packages/services/auth/verify-captcha.ts
import { env } from '~/env';
// Cloudflare Turnstile verify
async function verifyTurnstile(token: string, ip: string): Promise<boolean> {
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: new URLSearchParams({ secret: env.TURNSTILE_SECRET_KEY!, response: token, remoteip: ip }),
  });
  const data = await res.json();
  return data.success === true;
}
```

#### 25.2.5 Security Headers (HTTP)

Semua halaman ERP wajib kirim header ini:
```
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://challenges.cloudflare.com; frame-ancestors 'none'
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

Implementasi: Next.js `headers()` dan/atau header tambahan di template Nginx/Apache HestiaCP.

#### 25.2.6 Security Audit & Penetration Testing

- Schedule: **minimal setiap 6 bulan** oleh pihak ketiga independen.
- Scope: OWASP Top 10, SQL injection, XSS, CSRF, IDOR, privilege escalation, API abuse.
- Findings ditindaklanjuti dalam **30 hari**.
- Laporan audit disimpan di `docs/security/audit-<tanggal>.pdf` (restricted access, owner only).
- Tambah ke CI: automated scanning dengan [OWASP ZAP](https://www.zaproxy.org/) (free, open source) untuk basic scan per PR.

#### 25.2.7 Incident Response Plan

| Fase | Tindakan | Waktu |
|---|---|---|
| **Detect** | Monitoring alert (server down, brute force, anomaly) | 0–5 menit |
| **Isolate** | Matikan komponen yang terkompromi, revoke semua token/session affected | < 15 menit |
| **Investigate** | Analisis audit log,identifikasi scope breach, root cause | < 2 jam |
| **Notify** | Notify affected users (UU PDP: max 3×24 jam dari discovery) | < 72 jam |
| **Remediate** | Patch vulnerability, reset credentials, harden config | < 7 hari |
| **Post-mortem** | Document, lessons learned, update security checklist | < 30 hari |

**Contact escalation:**
- Primary: Lintang Maulana Zulfan (lintangmaulanazulfan@gmail.com)
- Backup: kontak developer ketiga (dokumentasikan di runbook)

#### 25.2.8 Secrets Management

- Semua secret (DB password, JWT secret, API keys, encryption key) di `ENV`.
- Tidak pernah di-commit ke repo (`.env` di `.gitignore`).
- `.env.example` memiliki semua key dengan placeholder `CHANGE_ME`.
- Rotation: password/secret apapun berputar otomatis setiap **90 hari** via worker job + alert ke admin.
- API keys untuk third-party: gunakan Cloudflare Secrets atau Vault (self-hosted) bila budget tersedia.

#### 25.2.9 Audit Log Imutability

- Tabel `audit_log` di schema terpisah (`audit` schema, bukan `public`).
- Trigger PostgreSQL: **tidak ada** `UPDATE` atau `DELETE` pada `audit_log` yang diijinkan.
- Policy: `DENY DELETE, UPDATE ON audit_log TO app_user;` (hanya postgres superuser yang bisa, dan aplikasi tidak pakai superuser).
- Index: `(entity_type, entity_id, occurred_at DESC)` untuk query cepat.

#### 25.2.10 Dependency Security

```yaml
# .github/workflows/ci.yml — tambahan step
- name: Security audit
  run: pnpm audit --audit-level=moderate
- name: OWASP dependency check
  run: npxowasp-dependency-check --project ERP --scan .
```

### 25.3 Ekspor XLSX di Semua Modul (SoT §21.2a)

Setiap modul yang mengelola data **wajib** menyediakan fitur ekspor ke XLSX.

#### 25.3.1 Daftar Modul & Data Ekspor

| Modul | Data yang Diekspor |
|---|---|
| `accounting` | Chart of Accounts, Jurnal Umum, Buku Besar, Neraca Saldo |
| `reporting` | Trial Balance, Balance Sheet, Profit & Loss, Cash Flow, Laporan Penjualan |
| `tax` | Daftar Tarif Pajak, Rekap PPN Masukan/Keluaran, Ringkasan PB1 |
| `pos` | Riwayat Transaksi, Shift Harian, Refund |
| `inventory` | Daftar Produk, Stok per Lokasi, Pergerakan Stok, BOM |
| `purchasing` | Purchase Orders, Goods Receipt Notes, Supplier |
| `hr` | Daftar Karyawan, Kontrak, Absensi |
| `payroll` | Slip Gaji, Rekap Payroll per Bulan |
| `crm` | Daftar Member, Riwayat Poin, Komplain |

#### 25.3.2 Spesifikasi Teknis

**Library**: ExcelJS (v4+, sudah di-stack — lihat §5).

```ts
// packages/services/export/xlsx-export.ts
import ExcelJS from 'exceljs';
import { formatRupiah } from '@erp/shared';

interface ExportConfig<T> {
  title: string;
  columns: Array<{ key: keyof T | string; header: string; format?: 'currency' | 'date' | 'text'; width?: number }>;
  data: T[];
  locale: 'id' | 'en' | 'zh';
}

async function exportToXlsx<T>(config: ExportConfig<T>): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(config.title);
  // ...
}
```

**Styling:**
- Header baris: background `D6262E` (brand-red), font white, bold.
- Freeze pane: baris pertama (`A2` freeze).
- Auto-column width: hitung dari longest value per kolom (max 50 chars, min 8).
- Number format:
  - Kolom uang: `Rp #,##0` (locale ID) atau `$ #,##0` (locale EN) atau `¥ #,##0` (locale ZH).
  - Kolom tanggal: `yyyy-mm-dd`.
- Alternating row: stripe `F5F5F5` untuk readability.

**Paginasi:**
- Ekspor seluruh data yang ter-filter (bukan hanya halaman saat ini).
- Maksimum: **100.000 baris** per file. Jika lebih → pisah ke beberapa file + indicator "1 of 3".

**Memory management:**
- Untuk export besar (> 10.000 baris): streaming write (`workbook.xlsx.writeBuffer()` dalam chunk).
- Worker-side export untuk file > 10.000 rows (bukan di request handler).

#### 25.3.3 UI Ekspor

**Per halaman daftar/tabel:**
```
┌──────────────────────────────────────┐
│ [Filter...] [🔍 Search] [⬇ Export ▾] │  ← Export dropdown: XLSX, CSV (optional)
└──────────────────────────────────────┘
```

Dropdown `Export ▾`:
- `XLSX — Excel` (default)
- `CSV — teks` (opsional)

Opsi tambahan di modal export:
- `□ Pilih kolom` → checklist kolom yang di-export.
- `□ Sertakan timestamp` → kapan file di-export.
- `□ Sertakan filter` →备注 di file apa filter yang digunakan.

**Progress indicator:**
- File ≤ 10.000 rows: download langsung.
- File > 10.000 rows: tampilkan toast "Sedang menyiapkan file..." + progress bar. User terima email/link download setelah selesai.

#### 25.3.4 MCP Tools

```ts
// tools/export-xlsx.ts
export const exportModuleXlsx = {
  name: 'export.module_xlsx',
  description: 'Export data from any module to XLSX',
  inputSchema: z.object({
    module: z.enum(['accounting', 'reporting', 'tax', 'pos', 'inventory', 'purchasing', 'hr', 'payroll', 'crm']),
    report_type: z.string(),
    filters: z.record(z.unknown()),
    locale: z.enum(['id', 'en', 'zh']).default('id'),
  }),
  handler: async (args) => {
    const { module, report_type, filters, locale } = args;
    const data = await exportService[module][report_type](filters);
    const buffer = await exportToXlsx({ ...config, data, locale });
    return { download_url: await uploadToR2(buffer, `exports/${module}/${report_type}.xlsx`) };
  },
};
```

---

### 25.4 Sistem Dokumentasi Komprehensif (SoT §21.2b)

Sistem **wajib** menyediakan halaman dokumentasi komprehensif untuk semua fitur ERP.

#### 25.4.1 Lokasi Halaman

```
apps/web/(dash)/docs/
├── page.tsx                    # Landing: TOC + search + versi ERP
├── layout.tsx                 # Shell: sidebar TOC + breadcrumb
├── accounting/
│   ├── coa.md
│   ├── posting-jurnal.md
│   └── menutup-periode.md
├── reporting/
│   ├── trial-balance.md
│   ├── balance-sheet.md
│   ├── profit-loss.md
│   └── export-coretax.md
├── tax/
│   ├── setup-pajak.md
│   └── export-laporan.md
├── pos/
│   ├── transaksi.md
│   ├── refund.md
│   ├── shift.md
│   └── demo-mode.md
├── inventory/
│   ├── setup-produk.md
│   ├── bom.md
│   └── stock-opname.md
├── purchasing/
│   ├── po-workflow.md
│   ├── grn.md
│   └── retur.md
├── hr/
│   ├── onboarding-karyawan.md
│   └── absensi.md
├── payroll/
│   ├── setup-komponen.md
│   └── jalankan-payroll.md
├── crm/
│   ├── member.md
│   └── komplain.md
├── guides/
│   ├── login.md
│   ├── navigasi.md
│   ├── keyboard-shortcut.md
│   ├── faq.md
│   └── onboarding-kasir.md    # UC: kasir baru
├── glossary.md
└── changelog.md
```

#### 25.4.2 Storage Backend

**Direkomendasikan: CMS-driven** (`cms_docs` table) dengan markdown editor untuk fleksibilitas.

```ts
// packages/db/schema/cms-docs.ts
export const cmsDocs = pgTable('cms_docs', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull().unique(), // e.g., 'accounting/posting-jurnal'
  module: text('module').notNull(),     // 'accounting', 'guides', dll.
  title: jsonb('title').notNull(),       // LocaleString
  content: text('content').notNull(),   // Markdown
  authorId: text('author_id').references(() => users.id),
  publishedAt: timestamptz('published_at'),
  updatedAt: timestamptz('updated_at').defaultNow(),
});
```

Alternatif: **static MDX files** dalam repository (lebih simple untuk Phase 1, tapi perlu redeploy untuk update konten).

#### 25.4.3 Spesifikasi UI Halaman Dokumentasi

**Layout:**

```
┌────────────────────────────────────────────────────────────────┐
│ 🏠 Docs    [Search... (⌘K)]                    [ID ▾] v1.3     │  ← Header docs
├──────────────┬───────────────────────────────────────────────────┤
│              │                                                   │
│  ▾ Guides    │  # Posting Jurnal Manual                         │
│    Login     │                                                   │
│    Navigasi  │  ## Tujuan                                       │
│    FAQ       │  Mencatat transaksi akuntansi yang tidak ...     │
│  ▸ Accounting│                                                  │
│  ▸ Reporting │  ## Prasyarat                                    │
│  ▸ Tax       │  • Permission: `accounting.journal.create`       │
│  ▸ POS       │  • Peran: Akuntan, Direktur                      │
│  ▸ Inventory │                                                  │
│  ▸ Purchasing│  ## Langkah-langkah                              │
│  ▸ HR        │  1. Buka **Akuntansi → Jurnal Umum**             │
│  ▸ Payroll   │  2. Klik **+ Jurnal Baru**                       │
│  ▸ CRM       │  3. Isi form...                                 │
│              │                                                   │
│  ─────────   │  ## Tips & Troubleshooting                     │
│  Glossary    │  • Pesan error "Period closed" → buka periode   │
│  Changelog   │                                                   │
│              │  [← Sebelumnya]              [Selanjutnya →]     │
└──────────────┴───────────────────────────────────────────────────┘
```

**Fitur:**
1. **TOC Sidebar (kiri)**:
   - Sticky saat scroll.
   - Hierarki 3 level (modul → section → sub-section).
   - Aktif highlight saat scroll ke section.
   - Collapse/expand per modul.
   - Keyboard: `j/k` untuk next/prev item.

2. **Search Bar (`⌘K` / `Ctrl+K`)**:
   - Full-text search (Fuse.js atau pg full-text search).
   - Keyboard navigation (↑↓ untuk hasil, Enter untuk pilih).
   - Highlight kata kunci di snippet hasil.
   - Category filter (by module).

3. **Konten Markdown**:
   - Header: `#`, `##`, `###`.
   - Code block dengan syntax highlighting.
   - Tabel, list, blockquote.
   - Image/ilustrasi (dari object storage).
   - Video embed (YouTube/Loom via iframe).

4. **Breadcrumb**: `Docs / Accounting / Posting Jurnal Manual`.

5. **Navigasi Halaman**: `← Sebelumnya` / `Selanjutnya →` di bawah konten.

6. **Multi-bahasa**: Switcher di header (`ID` / `EN` / `ZH`) → konten di-load sesuai locale.

7. **Last updated**: tampil di bawah setiap halaman.

#### 25.4.4 Use Case Guide yang Wajib Ada

| Use Case | Lokasi | Deskripsi |
|---|---|---|
| Onboarding Kasir Baru | `guides/onboarding-kasir.md` | Langkah dari login → transaksi pertama → refund → demo mode |
| Setup Produk Baru | `inventory/setup-produk.md` | Dari login → tambah produk → varian → modifier → BOM |
| Tutup Bulan | `accounting/menutup-periode.md` | Posting penyesuaian → generate laporan → tutup periode |
| Export Coretax | `tax/export-coretax.md` | Filter data → export → format Coretax |
| Training Demo Mode | `pos/demo-mode.md` | Aktivasi → simulasi transaksi → reset |
| Setup Karyawan Baru | `hr/onboarding-karyawan.md` | Input data → kontrak → absensi |

#### 25.4.5 CMS Admin untuk Dokumentasi

Menggunakan modul CMS yang sama (`apps/web/(dash)/cms/`) dengan tipe konten `doc`:
- Editor markdown (minimal: bold, italic, heading, list, table, code, image).
- Preview langsung.
- Publish workflow: draft → published.
- Last updated + author tracking.
- Revision history (rollback capability).

---

### 25.5 Laporan Harian Summary (SoT §21.3)

#### 25.5.1 Service

```ts
// packages/services/reporting/daily-summary.ts
export async function getDailySummary(params: {
  locationId: string;
  startDate: Date;
  endDate: Date;
  cashierId?: string;
}): Promise<Result<DailySummary>>

interface DailySummary {
  period: { start: Date; end: Date };
  locationId: string;
  grossSales: Money;
  discountTotal: Money;
  netSales: Money;
  taxTotal: Money;           // PB1 breakdown
  commissionDelivery: Money; // 20% × (gofood + grabfood + shopeefood gross)
  netRevenue: Money;
  refundTotal: Money;
  refundCount: number;
  paymentBreakdown: PaymentMethodRow[];
  shiftSummary: ShiftSummary[];
  topProducts: ProductSaleRow[];
}
```

#### 25.5.2 UI

- Page: `apps/web/(dash)/reporting/daily-summary/page.tsx`
- Filter bar: tanggal range, lokasi, kasir.
- Tabel 1: Payment breakdown (method | tx_count | total).
- Tabel 2: Top 10 products (rank | product | qty | nominal).
- Grafik: donut chart payment method, bar chart top products.
- Tombol: Print (PDF), Export (XLSX).
- Toggle: "Include closed shifts only" (default: true).

#### 25.5.3 MCP Tools

```ts
export const reportingGetDailySummary = {
  name: 'reporting.get_daily_summary',
  description: 'Get daily sales summary with payment method breakdown',
  inputSchema: z.object({
    location_id: z.string(),
    start_date: z.string(), // YYYY-MM-DD
    end_date: z.string(),   // YYYY-MM-DD
    cashier_id: z.string().optional(),
  }),
  handler: async (args) => {
    const result = await getDailySummary(args);
    return formatResult(result);
  },
};
```

#### 25.5b Omzet Harian Export — PB1 Exclusive + Koreksi Fiskal (SoT §21.3b)

> User-requested 2026-05-12: file Excel untuk pelaporan pajak Coretax / SPT PPh Final UMKM, dengan omzet yang sudah dikurangi PB1 10% dan kolom koreksi manual untuk beda omzet akuntansi vs fiskal.

#### 25.5b.1 Schema

```sql
-- packages/db/schema/reporting/daily-revenue-adjustments.sql
CREATE TABLE daily_revenue_adjustments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES locations(id),
  date        DATE NOT NULL,           -- YYYY-MM-DD, WIB date
  adjustment_amount BIGINT NOT NULL DEFAULT 0, -- sen/IDR; can be negative
  adjustment_note    TEXT,
  created_by  UUID REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (location_id, date)
);
-- Index for fast lookup by location+date
CREATE INDEX idx_dra_location_date ON daily_revenue_adjustments(location_id, date);
```

**Reasoning**: stored as `BIGINT` (sen/IDR) to maintain Money type consistency. `adjustment_amount` can be negative (koreksi pengurang) or positive (koreksi penambah).

#### 25.5b.2 Calculation Formula

```ts
// packages/services/reporting/daily-omzet.ts

const PB1_RATE = 0.10; // 10%

/**
 * Strip PB1 (inclusive) from gross to get net taxable omzet.
 * Formula: net = gross / (1 + PB1_RATE)
 * Example: gross = 5.500.000 → net = 5.500.000 / 1.10 = 5.000.000
 */
function stripPB1(grossSales: bigint): bigint {
  return grossSales / 110n * 100n; // integer-safe: multiply by 100 then divide by 110
  // Better (no overflow): gross * 100 / 110
  return (gross * 100n) / 110n;
}

function computePB1(grossSales: bigint): bigint {
  return grossSales - stripPB1(grossSales);
}

interface OmzetHarianResult {
  date: string;
  locationId: string;
  locationName: string;
  grossSales: string;          // bigint string
  pb1Amount: string;           // bigint string (gross - net)
  netOmzet: string;            // bigint string (PB1-exclusive)
  adjustmentAmount: string;    // bigint string (from daily_revenue_adjustments)
  adjustmentNote: string | null;
  fiscalOmzet: string;         // bigint string (netOmzet + adjustment)
  lastModified: string | null; // ISO timestamp of last adjustment
}
```

> **Integer-safe calculation note**: `gross * 100 / 110` avoids floating-point errors. This yields floor division which matches standard PB1 back-calculation for whole-IDR amounts.

#### 25.5b.3 Service API

```ts
// packages/services/reporting/daily-omzet.ts

export async function getOmzetHarian(
  params: { locationId: string; date: string }, // YYYY-MM-DD
  ctx: AuditContext,
): Promise<Result<OmzetHarianResult>>

export async function saveOmzetAdjustment(
  params: {
    locationId: string;
    date: string;
    adjustmentAmount: string; // bigint string, can be negative
    adjustmentNote?: string;
  },
  ctx: AuditContext,
): Promise<Result<void>>

export async function exportOmzetHarianXlsx(
  params: { locationId: string; date: string; locale?: 'id' | 'en' | 'zh' },
  ctx: AuditContext,
): Promise<Result<{ buffer: ArrayBuffer; filename: string }>>
```

#### 25.5b.4 UI

- **Route**: `apps/web/(dash)/reporting/omzet-harian/page.tsx`
- **Layout**: Single-column centered, max-width 800px.
- **Filter bar**: tanggal (default: today), lokasi (dropdown).
- **Read-only fields** (A–E): tanggal, lokasi, gross sales, PB1 10%, omzet neto.
- **Editable fields** (F–H): penyesuaian amount (inline number input), keterangan (text area). Double-click to edit. Auto-save on blur or Enter.
- **Fiscal total badge** (G): prominently displayed with warning icon if adjustment ≠ 0.
- **Warning banner**: yellow box if `adjustmentAmount ≠ 0` — "⚠️ Omzet fiskal berbeda dari omzet akuntansi sebesar Rp X."
- **Buttons**: "Simpan Penyesuaian", "Export Excel".
- **Permission**: `accounting.view` | `reporting.view`.

#### 25.5b.5 XLSX Export Columns

| Col | Header (ID) | Header (EN) | Header (ZH) | Format |
|-----|-------------|-------------|-------------|--------|
| A | Tanggal | Date | 日期 | date `YYYY-MM-DD` |
| B | Lokasi | Location | 地点 | text |
| C | Gross Sales (IDR) | Gross Sales (IDR) | 总销售额 | number, `Rp #,##0` |
| D | PB1 10% (IDR) | PB1 10% (IDR) | PB1 10% (印尼盾) | number, `Rp #,##0` |
| E | Omzet Neto (IDR) | Net Revenue (IDR) | 净收入 | number, `Rp #,##0` |
| F | Penyesuaian (IDR) | Adjustment (IDR) | 调整金额 | number, `#,##0` (can be negative, red) |
| G | Omzet Fiskal (IDR) | Fiscal Omzet (IDR) | 财政应税收入 | number, `Rp #,##0` (formula: E+F) |
| H | Keterangan | Note | 备注 | text |

- Row 1: bold header, background `#D6262E` (brand-red), white text.
- Freeze pane: row 1.
- Column C–G: number format `Rp #,##0` (Indonesian locale, no decimals).
- Column F: conditional red color for negative values.
- Column G: formula `=E2+F2` for Excel formula recalculation.
- File name: `omzet-harian-{YYYY-MM-DD}-{location-slug}.xlsx`.

#### 25.5b.6 MCP Tool

```ts
// apps/mcp/src/tools/reporting-omzet.ts
export const reportingGetOmzetHarian = {
  name: 'reporting.get_omzet_harian',
  description: 'Get daily PB1-exclusive omzet with fiscal adjustment. Returns gross, PB1 amount, net omzet, adjustment, fiscal omzet, and last modified timestamp. SoT §21.3b / SD §25.5b.',
  inputSchema: z.object({
    location_id: z.string(),
    date: z.string(), // YYYY-MM-DD
    locale: z.enum(['id', 'en', 'zh']).optional().default('id'),
  }),
  handler: async (input, ctx) => {
    const permitted = await checkPermission(ctx, 'reporting.view');
    if (!permitted) return mcpError('FORBIDDEN', 'Permission denied: reporting.view');
    const result = await getOmzetHarian({ locationId: input.location_id, date: input.date }, {
      userId: ctx.userId, tenantId: ctx.tenantId, locationId: input.location_id,
    });
    return serializeResult(result);
  },
};
```

#### 25.5b.7 Security & Audit

- Every `saveOmzetAdjustment` call writes to `audit_log` (entity_type: `daily_revenue_adjustment`).
- `adjustment_note` stored in plaintext; no PII needed.
- Only users with `accounting.view` | `reporting.view` can read/write.
- All timestamps in UTC; date field in WIB.

#### 25.5b.8 Tax Compliance Notes (for developer and user reference)

- PB1/PBJT 10% is **inclusive** — `gross_price = net_price + PB1`.
- For SPT PPh Final UMKM (PP 5/2022), omzet base = **omzet neto (E)** = gross ÷ 1.10.
- Fiscal adjustment (F) must be supported by supporting documents (receipts, correction memos).
- For Coretax input: use **Omzet Fiskal (G)** as the gross revenue figure.
- Consult tax consultant for cases involving: partial exemptions, mix-use sales, B2B transactions with PPN.

---

### 25.6 Hourly Sales Report (SoT §21.4)

#### 25.6.1 Service

```ts
// packages/services/reporting/hourly-sales.ts
export async function getHourlySales(params: {
  locationId: string;
  startDate: Date;
  endDate: Date;
  groupBy: Array<'variant' | 'size' | 'category' | 'channel'>;
}): Promise<Result<HourlySalesReport>>
```

`groupBy` determines how product rows are grouped. Multiple groupBy = hierarchical grouping.

#### 25.6.2 Group By Mapping

| groupBy value | Source column | How derived |
|---|---|---|
| `variant` | Product variant group (e.g., "Fresh Milk Tea", "Lemon Fresh Tea") | From `product_variants.variant_group` |
| `size` | Regular / Large | From `product_variants.size` |
| `category` | product category | From `products.category_id` |
| `channel` | sales_orders.channel | Direct |

#### 25.6.3 UI

- Page: `apps/web/(dash)/reporting/hourly-sales/page.tsx`
- Filter bar: tanggal, lokasi, group by (multi-select chips).
- Tabel: rows = (hour × group value), cols = product details.
- Heatmap: CSS grid dengan background color berdasarkan nominal (intensity scale).
- Peak hour badge: highlight jam dengan penjualan tertinggi.
- Export: XLSX.

---

### 25.7 Petty Cash (SoT §21.5)

#### 25.7.1 Schema

```ts
// packages/db/schema/accounting.ts (extend)

// petty_cash_accounts: satu per lokasi
export const pettyCashAccounts = pgTable('petty_cash_accounts', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').references(() => tenants.id),
  locationId: text('location_id').references(() => locations.id).unique(),
  balance: bigint('balance').notNull().default(0), // dalam rupiah
  maxLimit: bigint('max_limit').notNull(), // plafond
  lastReplenishAt: timestamptz('last_replenish_at'),
  createdAt: timestamptz('created_at').defaultNow(),
});

// petty_cash_transactions
export const pettyCashTransactions = pgTable('petty_cash_transactions', {
  id: text('id').primaryKey(),
  accountId: text('account_id').references(() => pettyCashAccounts.id),
  kind: text('kind').checkIn(['topup', 'expense']),
  amount: bigint('amount').notNull(), // selalu positif
  description: text('description').notNull(),
  createdBy: text('created_by').references(() => users.id),
  createdAt: timestamptz('created_at').defaultNow(),
});
```

#### 25.7.2 Service

```ts
// packages/services/accounting/petty-cash.ts
export async function getPettyCashBalance(locationId: string): Promise<Result<PettyCashAccount>>
export async function listPettyCashTransactions(locationId: string, pagination: Pagination): Result<PettyCashTransaction[]>
export async function requestReplenish(locationId: string, amount: Money): Result<void> // creates workflow instance
export async function recordExpense(locationId: string, amount: Money, description: string): Result<void>
```

- Warning threshold: `balance < maxLimit * 0.2` → notifikasi ke kepala toko + director.
- Replenish request → workflow instance (§18) → approval director → update balance.

#### 25.7.3 UI

- Page: `apps/web/(dash)/accounting/petty-cash/`
- Tabel saldo per lokasi + history transaksi.
- Form request replenish (popup modal).
- Warning banner merah jika saldo < 20%.

---

### 25.8 Reimbursement (SoT §21.6)

#### 25.8.1 Schema

```ts
// packages/db/schema/accounting.ts
export const reimbursementRequests = pgTable('reimbursement_requests', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').references(() => tenants.id),
  requesterId: text('requester_id').references(() => users.id),
  locationId: text('location_id').references(() => locations.id),
  amount: bigint('amount').notNull(),
  category: text('category').checkIn(['operational', 'supplies', 'emergency', 'other']),
  description: text('description').notNull(),
  attachmentUrl: text('attachment_url'), // R2/S3 URL
  attachmentName: text('attachment_name'),
  status: text('status').checkIn(['draft', 'submitted', 'approved', 'disbursed', 'rejected']),
  approvedBy: text('approved_by').references(() => users.id),
  approvedAt: timestamptz('approved_at'),
  disbursedAt: timestamptz('disbursed_at'),
  rejectionReason: text('rejection_reason'),
  createdAt: timestamptz('created_at').defaultNow(),
});
```

#### 25.8.2 Service

```ts
// packages/services/accounting/reimbursement.ts
export async function createReimbursement(params: ReimbursementInput): Result<ReimbursementRequest>
export async function submitReimbursement(id: string): Result<void>
export async function approveReimbursement(id: string, approverId: string): Result<void>
export async function disburseReimbursement(id: string): Result<void>
export async function rejectReimbursement(id: string, reason: string): Result<void>
// Worker: auto-escalate after 48h no action
export async function escalateOldReimbursements(): Promise<void>
```

- `submitReimbursement`: mengubah status → `submitted`, kirim notifikasi ke director.
- `approveReimbursement`: hanya user dengan permission `accounting.reimbursement.approve` dapat approve.
- Worker cron: daily, check `status='submitted' AND createdAt < NOW() - 48h` → escalate notification.

#### 25.8.3 UI

- Page: `apps/web/(dash)/accounting/reimbursement/`
- Form pengajuan dengan upload lampiran (drag & drop image/receipt).
- Tabel daftar pengajuan: filter status, tanggal, kategori.
- Detail view: image preview lampiran, history status, approve/reject buttons.

---

### 25.9 Stock Opname & Variance (SoT §21.7)

#### 25.9.1 Schema

```ts
// packages/db/schema/inventory.ts

export const stockOpnameSessions = pgTable('stock_opname_sessions', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').references(() => tenants.id),
  locationId: text('location_id').references(() => locations.id),
  periodStart: date('period_start').notNull(),
  periodEnd: date('period_end').notNull(),
  status: text('status').checkIn(['draft', 'in_progress', 'completed', 'approved', 'cancelled']),
  physicalCountBy: text('physical_count_by').references(() => users.id),
  approvedBy: text('approved_by').references(() => users.id),
  approvedAt: timestamptz('approved_at'),
  createdAt: timestamptz('created_at').defaultNow(),
  // Threshold setting
  varianceThresholdCents: bigint('variance_threshold_cents').notNull().default(5000000), // Rp 50.000 default
});

export const stockOpnameLines = pgTable('stock_opname_lines', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').references(() => stockOpnameSessions.id),
  productId: text('product_id').references(() => products.id),
  systemQty: numeric('system_qty', { precision: 14, scale: 3 }).notNull(),
  totalIn: numeric('total_in', { precision: 14, scale: 3 }).notNull().default(0),  // sum masuk dari movements
  totalOut: numeric('total_out', { precision: 14, scale: 3 }).notNull().default(0), // sum keluar
  physicalQty: numeric('physical_qty', { precision: 14, scale: 3 }), // nullable: filled during opname
  variance: numeric('variance', { precision: 14, scale: 3 }), // physical - system (nullable)
  reason: text('reason'), // required if variance != 0
  reasonDetail: text('reason_detail'),
  varianceApprovedBy: text('variance_approved_by').references(() => users.id),
  varianceApprovedAt: timestamptz('variance_approved_at'),
});

export const stockMovementManual = pgTable('stock_movement_manual', {
  // For Sheet 2: manual daily input
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').references(() => tenants.id),
  occurredAt: date('occurred_at').notNull(),
  productId: text('product_id').references(() => products.id),
  qtyIn: numeric('qty_in', { precision: 14, scale: 3 }).notNull().default(0),
  qtyOut: numeric('qty_out', { precision: 14, scale: 3 }).notNull().default(0),
  description: text('description'),
  enteredBy: text('entered_by').references(() => users.id),
  createdAt: timestamptz('created_at').defaultNow(),
});
```

#### 25.9.2 Imported from Excel (Sheet 1 — Master)

```ts
// packages/services/inventory/import-master.ts
interface ImportMasterRow {
  KODE: string;       // SKU / kode barang
  KATEGORI: string;  // kategori (Teh, Cup, Gula, etc.)
  NAMA_BARANG: string;
  SATUAN: string;    // Bungkus / Pcs / Kaleng / Botol / Gen
  STOK_AWAL: number;
  GAMBAR_URL?: string;
  LINK_URL?: string;
}

export async function importMasterFromExcel(rows: ImportMasterRow[]): Promise<Result<ImportResult>>
// Creates products where not exist; updates where code matches.
// Maps kategori to product_category via keyword matching (case-insensitive).
```

#### 25.9.3 Stock Opname Session Flow

1. **Create session** → `stock_opname_sessions` (draft)
2. **Generate lines** → `stock_opname_lines` dengan `system_qty` = current stock level, `total_in/out` = calculated from `stock_movement_manual` + `stock_movements` dalam periode.
3. **Physical count** → kepala toko input `physical_qty` per line (can be partial, save progress).
4. **Calculate variance** → `variance = physical_qty - (system_qty + total_in - total_out)`.
5. **Reason logging** → user harus isi `reason` jika `variance != 0`.
6. **Approval** → jika `ABS(variance) * unit_cost > variance_threshold` → wait for director approval. Else: auto-approved.
7. **Post adjustment** → approved variance → `stock_movements` adjustment (kind='opname') + optional JE for losses.

#### 25.9.4 Variance Dashboard

- Page: `apps/web/(dash)/inventory/variance/`
- Grafik: line chart variansi bulanan per kategori.
- Tabel: top 20 produk dengan variansi tertinggi.
- Export XLSX.
- Filter: periode, lokasi, kategori.

#### 25.9.5 MCP Tools

```ts
export const inventoryStockOpname = {
  name: 'inventory.stock_opname',
  description: 'Run stock opname for a location and period',
  inputSchema: z.object({
    location_id: z.string(),
    period_start: z.string(), // YYYY-MM-DD
    period_end: z.string(),
  }),
};

export const inventoryGetVarianceReport = {
  name: 'inventory.get_variance_report',
  description: 'Get stock variance analysis report',
};
```

---

### 25.10 Journal Attachments (MCP Audit) (SoT §21.9)

#### 25.10.1 Schema

```ts
// packages/db/schema/accounting.ts
export const journalAttachments = pgTable('journal_attachments', {
  id: text('id').primaryKey(),
  journalEntryId: text('journal_entry_id').references(() => journalEntries.id),
  fileKey: text('file_key').notNull(),   // R2/S3 key
  fileName: text('file_name').notNull(),  // original name
  fileSize: integer('file_size').notNull(),
  mimeType: text('mime_type').notNull(),
  uploadedBy: text('uploaded_by').references(() => users.id),
  uploadedAt: timestamptz('uploaded_at').defaultNow(),
});
```

#### 25.10.2 Service

```ts
// packages/services/accounting/journal-attachments.ts
export async function uploadJournalAttachment(params: {
  journalEntryId: string;
  file: File; // multipart
  uploadedBy: string;
}): Promise<Result<JournalAttachment>>

export async function listJournalAttachments(journalEntryId: string): Promise<Result<JournalAttachment[]>>

export async function downloadAttachment(fileKey: string, userId: string): Promise<Result<string>> // presigned URL
```

#### 25.10.3 API

```
POST /api/files/upload
  Content-Type: multipart/form-data
  Body: file + (optional) prefix
  Response: { url, file_key, file_name, file_size }
```

Files stored at `attachments/journal/{journal_entry_id}/{filename}` in R2 bucket.

#### 25.10.4 MCP Tools

```ts
export const accountingGetJournalWithAttachments = {
  name: 'accounting.get_journal_with_attachments',
  description: 'Get journal entry with all attached files and metadata',
  inputSchema: z.object({
    journal_id: z.string(),
  }),
};

export const accountingUploadAttachment = {
  name: 'accounting.upload_attachment',
  description: 'Upload proof document attachment to a journal entry',
};

export const accountingDownloadAttachment = {
  name: 'accounting.download_attachment',
  description: 'Get a presigned download URL for a journal attachment',
};
```

- `get_journal_with_attachments` → returns `{ journal, lines, attachments: [{ id, file_name, uploaded_by, uploaded_at }] }` (file_content/base64 embedded for small files).
- Every upload/download → `audit_log` with `action='journal_attachment_upload'` / `journal_attachment_download`.

---

### 25.11 Donasi / Rounding Donation (SoT §21.10)

#### 25.11.1 Schema

```ts
// packages/db/schema/pos.ts — extend payments table
// payments already has: add nullable column
payments.donationAmount  // bigint, nullable — amount donated (not given as change)
payments.roundingOption   // text: 'donate' | 'round_up' | 'no_donation'
```

#### 25.11.2 COA

Donation account: `Donation Fund / Trust Fund` (akun passiva sementara, bukan revenue).

```
Donation Receivable (Asset/Trust) | Cash (Asset)  ← saat donation
```

Saat donasi di-close (donasi dikirim ke pihak ketiga): `Donation Payable | Donation Receivable`.

#### 25.11.3 Service

```ts
// packages/services/pos/donation.ts
interface DonationChoice {
  type: 'donate' | 'round_up' | 'no_donation';
  amount?: Money; // nominal donasi (calculated or custom)
}

// Applied during payment processing
export function calculateDonation(changeAmount: Money): DonationChoice
// change < 500 → suggest donate/round; change >= 500 → no suggestion

export function recordDonation(saleId: string, choice: DonationChoice): Result<void>
// Updates payment record + optional JE for trust fund
```

#### 25.11.4 UI (POS Flow)

```
Step: Payment cash
1. Cashier selects "Cash Rp XX"
2. System calculates change: Rp 4.230
3. If change < 500:
   Modal appears: "Sisa kembalian Rp 4.230"
   Buttons:
     ✓ Bulatkan ke atas (+Rp 70) → kembalian Rp 4.300
     ✓ Donasikan Rp 4.230 → tidak ada kembalian
     ✓ Kembalikan Rp 4.230
4. Selected choice → recorded in payment
```

#### 25.11.5 Laporan Donasi

- Page: `apps/web/(dash)/reporting/donations/`
- Filter: tanggal, lokasi.
- Tabel: tanggal | jumlah donasi | jumlah transaksi donasi | rata-rata.
- Total donasi periode + export XLSX.

#### 25.11.6 MCP Tool

```ts
export const reportingDonations = {
  name: 'reporting.get_donations',
  description: 'Get donation summary report for a period',
  inputSchema: z.object({
    start_date: z.string(),
    end_date: z.string(),
    location_id: z.string().optional(),
  }),
};

---

## 26. CI/CD & Deployment

### 26.1 CI (GitHub Actions)
1. Install pnpm + node.
2. Lint (Biome).
3. Type check (`tsc --noEmit`).
4. Test (`vitest run`).
5. Build (`next build` dengan `output: 'standalone'`).
6. Build aplikasi (`next build` + `tsc`).
7. Deploy/reload via PM2 di VPS HestiaCP.

### 26.2 CD
- **Staging**: deploy otomatis dari `develop`.
- **Production**: deploy manual approval dari `main`.
- Strategi: rolling restart (single VPS — accept 30 detik downtime saat deploy; user dilatih untuk tidak transaksi tepat saat deploy).

### 26.3 PM2 Process Manager (Server VPS)

Production VPS HestiaCP menjalankan proses Node lewat `ecosystem.config.cjs`:

- `aroadri-site` → `apps/site`, bind `127.0.0.1:3000`.
- `aroadri-web` → `apps/web`, bind `127.0.0.1:3001`.
- `aroadri-mcp` → `apps/mcp/src/server.ts` via `tsx`, health bind `127.0.0.1:3002`, `MCP_ENABLE_STDIO=false` untuk mode daemon PM2.
- `aroadri-worker` → `apps/worker/src/index.ts` via `tsx`.

DB di managed (Neon/Supabase) → tidak ada DB lokal di VPS.

Semua port aplikasi PM2 wajib bind loopback (`127.0.0.1`), bukan `0.0.0.0`; akses publik hanya lewat reverse proxy HestiaCP HTTPS.

MCP transport utama tetap `stdio` untuk klien AI lokal. Proses PM2 hanya menjaga health/root HTTP; transport HTTP/SSE token-gated dapat ditambahkan saat ada klien remote yang benar-benar dipakai.

### 26.4 Migrations
- Drizzle Kit `generate` saat development (commit migration files).
- Saat deploy: jalankan `drizzle-kit migrate` sebelum `pm2 reload`.
- Jangan auto-migrate saat startup di prod.

---

## 27. Backup, Restore, DR

### 27.1 Database
- Neon/Supabase: gunakan **point-in-time recovery** built-in jika tersedia di plan.
- Tambahan: `pg_dump` harian via worker → upload terenkripsi (gpg) ke S3/R2 → retensi 7 hari.

### 27.2 Files (Uploads)
- Sediakan storage object eksternal (R2/S3) sejak hari pertama (jangan simpan di disk VPS — terbatas).

### 27.3 Restore Drill
- Sekali per kuartal: restore backup ke staging, jalankan sanity tests, dokumentasikan waktu restore.

---

## 28. Observability

### 28.1 Logs
- pino/console structured logs → PM2 log files (`logs/pm2/*.log`). Rotate via `pm2-logrotate` atau logrotate OS.
- Worker yang sukses: log INFO singkat. Yang gagal: log ERROR + stack.

### 28.2 Metrics
- **Phase 1**: tidak ada Prometheus (RAM terbatas). Cukup endpoint `/healthz` yang mengembalikan status DB + version.
- **Phase 6+**: jika perlu, gunakan plain text counter di file + dashboard sederhana.

### 28.3 Error Tracking
- Self-hosted Glitchtip (kalau RAM cukup di server berbeda) atau **Sentry tier free** (sampai 5k events/bulan).

---

## 29. Workflow untuk AI Developer

### 29.1 Sebelum Mulai Tugas
1. Baca **judul tugas** + spec di SOURCE-OF-TRUTH (bagian relevan).
2. Baca **bagian SYSTEM-DESIGN** terkait modul yang disentuh.
3. Identifikasi:
   - Tabel DB yang disentuh.
   - Service function yang dibuat/diubah.
   - Permission baru yang perlu di-seed.
   - MCP tool yang harus ditambah.
   - i18n key yang harus dibuat.
4. Cek `Open Decisions` (§30) — kalau tugas terkait, **stop** dan tanya user.

### 29.2 Saat Implementasi
- **Selalu mulai dari skema DB + migrasi**, lalu service, lalu UI/MCP. Jangan tulis UI dulu.
- **Tulis test lebih dulu** untuk function akuntansi, pajak, payroll.
- Pakai `Result<T, AppError>` di semua service.
- Gunakan i18n key untuk **semua** string user-facing.
- Tambahkan permission baru ke seed.
- Tambahkan MCP tool setara setiap fitur UI.
- Update `SOURCE-OF-TRUTH.md` bila kebutuhan bisnis berubah.
- Update `SYSTEM-DESIGN.md` bila keputusan teknis berubah; tambah ADR di `docs/adr/` untuk keputusan signifikan.

### 29.3 Saat Selesai
- `pnpm lint && pnpm typecheck && pnpm test` lulus.
- Dokumentasi terkait diupdate.
- Commit: `feat(<module>): <ringkas>` ; `Co-Authored-By: <ai-model>`.
- Push, buka PR, isi description: ringkasan + referensi SoT/SD section.

### 29.4 Larangan Mutlak (sekali lagi)
- ❌ Hardcode role check.
- ❌ Hardcode tarif pajak / harga / akun.
- ❌ Skip migration (mengubah tabel via SQL ad-hoc).
- ❌ Tambah library besar tanpa diskusi.
- ❌ Mengakses DB dari `apps/ui` atau `packages/ui`.
- ❌ Cross-module direct service import (gunakan ports).
- ❌ Throw error mentah dari service (selalu Result).
- ❌ Pakai `number` untuk uang.
- ❌ Pakai `Date.now()` untuk timestamp DB (gunakan `now()` SQL).
- ❌ Logging password / token / KTP / NPWP unmasked.
- ❌ `--no-verify` saat commit.
- ❌ Buat fitur yang tidak ada di SoT atau SD.

### 29.5 Eskalasi
Bila kebutuhan ambigu, AI **wajib** berhenti dan tanyakan ke user (Lintang) di kanal komunikasi (PR comment atau output session). **Jangan asumsikan**.

---

## 30. Open Decisions / ADR Pointers

> Status diperbarui 2026-05-05 setelah user menjawab batch pertama. AI developer **tidak boleh** menjatuhkan keputusan ⏳ tanpa konfirmasi user.

| # | Topik | Resolusi |
|---|-------|----------|
| 1 | Final pilihan database manage: Neon vs Supabase vs PlanetScale | ✅ **Neon** (decided 2026-05-05, lihat ADR-0001 §Tindak Lanjut). Supabase fallback bila kebutuhan storage/realtime muncul kelak. |
| 2 | Auth library: better-auth vs Lucia v3 vs Auth.js | ✅ **better-auth** (decided 2026-05-05). Lucia v3 dalam fase wind-down. |
| 3 | UI primitif: shadcn/ui vs Radix manual | ✅ shadcn/ui di-override brand (lihat ADR-0006) |
| 4 | Apakah Naixer KDS punya API? | ✅ Treat as opaque box, integrasi via QR-only (ADR-0007) |
| 5 | Multi-tenant aktif sekarang atau later? | ✅ Disiapkan kolom `tenant_id`, default `'default'` |
| 6 | PWA library: Serwist vs next-pwa | ✅ Serwist (decided di SD §5) |
| 7 | Email transactional provider (slip gaji + OTP member) | ✅ SMTP mailbox bawaan HestiaCP (`SMTP_*` env), lihat ADR-0011 |
| 8 | File storage: R2 vs S3 vs Backblaze B2 | ⏳ R2 (default) — pilih saat Phase 5 (CMS images, kartu member) |
| 9 | PPN penjualan retail dipungut atau hanya PB1? | ✅ **PB1 saja, PPN engine opt-in untuk akomodasi B2B kelak** (decided 2026-05-05, lihat ADR-0010) |
| 10 | Layout final laporan keuangan (template SAK ETAP) | ⏳ Template Aroadri di-design saat Phase 1 (T-0021) |
| 11 | Format export Coretax versi mana | ⏳ Versi terkini saat implementasi Phase 1 |
| 12 | Jam zona laporan keuangan (cut-off harian) | ⏳ Default 23:59 WIB (per `location.timezone`) |
| 13 | Skema versi BOM saat resep di-update di tengah period | ✅ New version, old tetap dipakai untuk transaksi historis |
| 14 | Strategi promo "Buy X Get Y" untuk POS offline | ⏳ Engine local di IndexedDB (replicate rule) — detail di Phase 2 |
| 15 | Notifikasi push (PWA) atau hanya in-app | ⏳ In-app notifikasi dulu Phase 1; push Phase 6 |
| 16 | Daftar kode produk + spec Naixer dari vendor | ✅ Tidak menunggu — user input via UI saat Phase 3 (ADR-0007 §Tindak Lanjut) |
| 17 | `display.aroadritea.com` jadi subdomain terpisah atau path di apps/web? | ⏳ Decide saat Phase 3 setelah ukur RAM staging |
| 18 | POS Imin Swan 2: PWA di Chrome WebView vs Android shell? | ⏳ Default PWA di Chrome WebView; uji di device sebelum Phase 2 mulai |
| 19 | OAuth sosial (Google login) untuk member portal Phase 2? | ⏳ Decide saat Phase 5 berdasarkan permintaan user |

Catat keputusan baru di `docs/adr/NNNN-<title>.md` dengan format ADR (Context / Decision / Consequences).

---

## Lampiran — Cheat Sheet Singkat

### Membuat Modul Baru (Checklist)
- [ ] Schema DB di `packages/db/schema/<module>.ts`
- [ ] Migration generated
- [ ] Permissions di-seed di `packages/db/seed/permissions.ts`
- [ ] Service di `packages/services/<module>/`
  - [ ] `*.service.ts` dengan Result return type
  - [ ] Test unit
- [ ] Server Action di `apps/web/app/(dash)/<module>/actions.ts`
- [ ] UI di `apps/web/app/(dash)/<module>/`
- [ ] i18n key di `apps/web/messages/{id,en,zh}.json`
- [ ] MCP tool di `apps/mcp/src/tools/<module>.<action>.ts`
- [ ] Audit hook di service (panggil `audit.record`)
- [ ] Update `SOURCE-OF-TRUTH.md` bila ada pembaruan bisnis
- [ ] Update `SYSTEM-DESIGN.md` bila ada keputusan teknis baru

### Membuat Field Baru di Entity (Checklist)
- [ ] Tambah ke Drizzle schema → generate migration
- [ ] Update Zod input schema di service
- [ ] Update Server Action input
- [ ] Update UI form
- [ ] Update MCP tool input
- [ ] Update i18n key untuk label
- [ ] Update test
- [ ] Pertimbangkan: butuh custom field engine atau column riil?

---

---

## 31. Public Website + CMS + Member Portal

> Bagian ini menguraikan implementasi teknis dari kebutuhan SOURCE-OF-TRUTH §22.

### 31.1 Aplikasi `apps/site` — Public Marketing Site

- **Framework**: Next.js 15 App Router, output: `standalone`.
- **Rendering strategy**:
  - Halaman beranda, menu, tentang, lokasi: **SSG di build time** + **ISR** (revalidate on-demand setiap CMS publish).
  - Halaman blog/posting: **ISR** dengan revalidate webhook.
  - Halaman member portal (`/member/akun`): **client-side rendered**, fetch via API.
  - Form member signup: **server action** dengan rate-limit.
- **i18n**: prefix `/{id,en,zh}` di route. Default: `/id`. `next-intl` dengan loader server-only.
- **CDN**: Cloudflare di depan VPS. Halaman publik aggressive cache (1 jam) + revalidate header.
- **PWA**: tidak (cukup web biasa). Service worker hanya untuk member portal kalau diperlukan untuk pengalaman seperti aplikasi.

### 31.2 Skema CMS

#### `cms_pages`
| Field | Tipe | Catatan |
|---|---|---|
| 🔑 `id` | text | ULID |
| `*tenant_id` | text 🔗 | |
| `*slug` | text UNIQUE per locale | `'beranda'`, `'tentang'`, ... |
| `*type` | text CHECK | `'page' \| 'landing' \| 'legal'` |
| `*title` | jsonb | LocaleString |
| `*content` | jsonb | block-based JSON (lihat §31.3) |
| `*status` | text CHECK | `'draft' \| 'review' \| 'published' \| 'archived'` |
| `~published_at` | timestamptz | |
| `~scheduled_at` | timestamptz | publish terjadwal |
| `*meta_title` | jsonb | LocaleString (SEO) |
| `*meta_description` | jsonb | LocaleString (SEO, ≤ 160 chars) |
| `~og_image_url` | text | |
| `*display_order` | int | untuk navbar |
| `*is_in_navbar` | boolean | |

#### `cms_posts`
Mirip `cms_pages` tapi untuk blog/news/promo:
- `kind`: `'news' \| 'promo' \| 'recipe' \| 'event'`
- `cover_image_url`, `excerpt jsonb`, `tags text[]`, `author_user_id`.

#### `cms_banners`
Hero / promo banner dengan jadwal aktif (`active_from`, `active_until`), `cta_url`, `image_url_desktop`, `image_url_mobile`.

#### `cms_faqs`
- `category` text, `question jsonb`, `answer jsonb`, `display_order int`.

#### `cms_settings`
Key-value: logo URL, alamat kantor, sosial media link, copyright text, dll.

#### `cms_revisions`
Append-only revision history untuk `cms_pages` & `cms_posts`. Setiap save → snapshot.

### 31.3 Block-Based Content

Konten halaman & posting disimpan sebagai array blok JSON:
```json
{
  "blocks": [
    { "type": "hero", "props": { "title": {...locale}, "subtitle": {...}, "cta": {...} } },
    { "type": "rich_text", "props": { "html": {...locale} } },
    { "type": "product_grid", "props": { "category_id": "..." , "limit": 6 } },
    { "type": "location_map", "props": { "location_ids": [...] } },
    { "type": "image", "props": { "url": "...", "alt": {...locale} } },
    { "type": "cta", "props": { "label": {...}, "url": "..." } }
  ]
}
```

- Daftar tipe blok terbatas (whitelist) — di-define di `packages/services/cms/blocks.ts`.
- Renderer di `apps/site` — satu komponen React per tipe blok.
- Validasi schema blok dengan Zod (per tipe).
- Editor di `apps/web /admin/cms` — drag-drop UI; setiap blok punya panel form sendiri.

### 31.4 Workflow Publishing & ISR Revalidation

1. Admin CMS klik **Publish** di `apps/web /admin/cms/posts/<id>`.
2. Service `cms.publish(id)`:
   - Set `status='published'`, `published_at=now()`.
   - Tulis ke `cms_revisions`.
   - Trigger ISR revalidation di `apps/site` via webhook signed-secret:
     ```
     POST aroadritea.com/api/revalidate
     Body: { paths: ["/blog/<slug>", "/blog"] }
     Header: x-signature: HMAC(secret, body)
     ```
3. `apps/site` route handler `/api/revalidate` verifikasi signature → call `revalidatePath(path)`.

### 31.5 Member Portal & Authentication

#### 31.5.1 Auth Terpisah dari ERP
Member punya **schema sesi terpisah**:
- ERP staff: `sessions` table.
- Member: `member_sessions` table.

Alasan: domain berbeda (cookie tidak share antara `erp.aroadritea.com` dan `aroadritea.com`), policy berbeda (member lebih lax — boleh remember-me lama; ERP staff session ketat).

#### 31.5.2 Skema Member-Spesifik
Tabel tambahan di `packages/db/schema/member.ts`:

#### `member_signup_attempts`
Audit + rate-limit signup.
| Field | Tipe |
|---|---|
| `id`, `tenant_id`, `email`, `phone`, `ip`, `user_agent`, `attempted_at`, `outcome (text CHECK: 'otp_sent' \| 'otp_verified' \| 'failed_captcha' \| 'rate_limited')`, `partner_id text NULL` (jika sukses) |

#### `member_otp_codes`
Token OTP yang dikirim.
| Field | Tipe |
|---|---|
| `id`, `tenant_id`, `purpose (text: 'signup' \| 'login' \| 'reset')`, `channel (text: 'email' \| 'wa')`, `recipient`, `code_hash`, `expires_at`, `attempts int default 0`, `consumed_at` |

OTP code 6-digit numeric, expiry 10 menit, max 5 percobaan.

#### `member_sessions`
Session DB-backed untuk member portal. Cookie `__Host-member-session` di domain `aroadritea.com`.

### 31.6 Member Signup Flow

```
1. GET /id/member/daftar
   → halaman form (nama, email, HP, tanggal lahir, kota, password, consent)

2. POST /api/member/signup (server action)
   - Verifikasi captcha (Turnstile)
   - Rate-limit per IP (3/jam)
   - Validasi payload (Zod)
   - Cek email/HP belum terdaftar
   - Generate OTP, simpan di member_otp_codes
   - Kirim OTP via email melalui SMTP mailbox HestiaCP
   - Insert member_signup_attempts (outcome='otp_sent')
   - Response: redirect ke /id/member/verifikasi-otp?token=<short-lived>

3. POST /api/member/verify-otp
   - Cek OTP valid + belum expired + attempts < 5
   - Buat partners (kind=customer, is_member=true) + member_sessions
   - Set cookie __Host-member-session
   - Redirect ke /id/member/akun

4. Halaman /id/member/akun
   - Tampilkan: ID member, instruksi nomor telepon untuk kasir, saldo poin (kalau loyalty aktif), riwayat trx, profil
```

### 31.7 Identifikasi Member di POS

- Flow utama: kasir bertanya "Apakah ada member?", lalu memasukkan nomor telepon pelanggan di POS.
- Service `member.findMemberByPhone(phone)` melakukan normalisasi nomor (hapus spasi/tanda baca, konversi awalan `0` Indonesia menjadi `62`) dan mencari `partners.kind='customer'`, `is_member=true`, `is_active=true`.
- POS menampilkan nama hasil lookup; kasir wajib mengonfirmasi "Atas nama `<nama member>`?" sebelum attach member.
- Setelah dikonfirmasi, POS menyimpan `customer_id` ke draft order dan `createSale` menulisnya ke `sales_orders.customer_id`; loyalty points dihitung dari mekanisme existing.
- Jika nomor tidak ditemukan atau pelanggan tidak mengonfirmasi, transaksi tetap berjalan sebagai walk-in tanpa `customer_id`.
- Kartu digital/QR member adalah opsi Phase 2, bukan dependency alur kasir. Jika nanti diaktifkan, QR tetap harus token non-PII dan dikonfirmasi di POS.

### 31.8 Anti-Abuse di apps/site
- **Captcha**: Cloudflare Turnstile pada `/api/member/signup` dan `/api/member/contact`.
- **Rate limit**: token bucket per IP (Redis-less: pakai DB tabel `rate_limits` dengan TTL bersih oleh worker).
- **HTTPS only**, HSTS preload.
- **Content Security Policy** ketat (no inline scripts kecuali nonce-signed).

### 31.9 Mengelola Konten Produk & Lokasi (Read-Only)

Halaman publik `aroadritea.com/menu` membaca produk dari `inventory.publicListProducts({ is_published: true })`.

- Kolom tambahan di `products`:
  - `is_published_to_site boolean default false`
  - `marketing_description jsonb` (LocaleString) — narasi panjang untuk web
  - `marketing_images text[]` — array URL gambar marketing (berbeda dari foto operasional)

Editor produk di `apps/web /inventory/products/<id>` punya tab "Marketing" untuk mengisi field ini.

### 31.10 SEO Implementation
- **Metadata API** Next.js: `generateMetadata` per halaman.
- **Structured data** JSON-LD: `Organization`, `Restaurant` (dengan jam buka, alamat, geo), `MenuItem` per produk.
- **Sitemap** auto-generated di `app/sitemap.ts` membaca dari DB.
- **Robots.txt** di `app/robots.ts`.

### 31.11 Performance Budget `apps/site`
- Halaman publik first load: ≤ 150 KB JS gzipped.
- Lighthouse target ≥ 90 di semua kategori (Performance, SEO, Accessibility, Best Practices).
- LCP < 2.5 s di koneksi 4G simulated (target Cloudflare cache hit).
- Gambar: format `avif`/`webp`, `<Image>` Next dengan priority eksplisit di hero.

---

## 32. Domain & Routing Strategy

### 32.1 Pemetaan
| Domain | App | Tujuan |
|---|---|---|
| `aroadritea.com`, `www.aroadritea.com` | `apps/site` | Public marketing + CMS-rendered + member portal |
| `erp.aroadritea.com` | `apps/web` | ERP (login required) |
| `erp.aroadritea.com/mcp/` | `apps/mcp` | MCP server health/HTTP surface (token required if remote tools are enabled) |
| `display.aroadritea.com` (opsional) | route di `apps/web` (subdomain rewrite) | Customer-facing display |

> **Catatan**: jika RAM server di staging menunjukkan stress > 80%, fold `display` ke `apps/web/display/<location>` dan tidak pakai subdomain terpisah (mengurangi 1 host vhost).

### 32.2 DNS
- A record `@` dan `www` → IP VPS.
- CNAME `erp` → `@`.
- MCP default lewat path `/mcp/` di `erp.aroadritea.com`. Jika butuh subdomain terpisah di Cloudflare, gunakan satu tingkat seperti `mcp.aroadritea.com` atau Advanced Certificate untuk subdomain bertingkat.
- (Opsional) CNAME `display` → `@`.
- TLS via HestiaCP Let's Encrypt untuk semua hostnames.

### 32.3 HestiaCP Reverse Proxy Mapping

| Domain | Local upstream |
|---|---|
| `aroadritea.com`, `www.aroadritea.com` | `http://127.0.0.1:3000` |
| `erp.aroadritea.com` | `http://127.0.0.1:3001` |
| `erp.aroadritea.com/mcp/` | `http://127.0.0.1:3002/` |

Reverse proxy wajib meneruskan `Host`, `X-Forwarded-Host`, `X-Forwarded-Proto`, dan `X-Forwarded-Port` dari request publik. Tanpa header ini, redirect middleware Next.js dapat membangun `Location` memakai origin internal seperti `localhost:3000`.

Aktifkan gzip/brotli di HestiaCP bila tersedia. Cache header tetap dikelola dari Next.js.

### 32.4 Cookies
- `apps/site` sesi member: cookie `__Host-member-session`, `Domain` tidak diset (host-only) → terkirim hanya untuk `aroadritea.com`.
- `apps/web` sesi staff: cookie `__Host-session` di `erp.aroadritea.com`.
- Tidak ada cookie share antar dua domain (memang tidak diinginkan).

### 32.5 CORS
- `apps/site` API hanya menerima request same-origin.
- `apps/web` API hanya menerima request same-origin + (untuk `/api/sync/pos`) header `Origin: https://erp.aroadritea.com`.
- `apps/mcp` jika dibuka via SSE: hanya menerima koneksi dengan token valid + `Origin` whitelist.

### 32.6 Cross-App Communication (di Server)
Tidak ada HTTP call antar `apps/site` ↔ `apps/web`. Keduanya konsumsi `packages/services/*` in-process. Konsistensi data via DB.

### 32.7 Webhook Internal
- Saat CMS publish → `apps/web` panggil `apps/site /api/revalidate` (signed HMAC) untuk invalidasi ISR.
- Saat member daftar (sukses) → `apps/site` tidak perlu memberi tahu `apps/web` (data sudah di DB; modul CRM melihat real-time).

---

---

## 33. Naixer KDS Integration (QR-only)

### 33.1 Prinsip
- Integrasi POS ↔ KDS Naixer **HANYA via QR code** di label cup. Tidak ada koneksi API/jaringan, tidak ada polling, tidak ada webhook.
- QR yang di-print kasir = sumber instruksi resep yang dibaca Naixer.
- Naixer dianggap **opaque box**.

### 33.2 Skema Mapping Master

#### `naixer_product_codes`
| Field | Tipe | Catatan |
|---|---|---|
| 🔑 `id` | text | ULID |
| `*tenant_id` | text 🔗 | |
| `*product_id` | text 🔗 products | |
| `~variant_id` | text 🔗 product_variants | NULL = berlaku semua varian produk |
| `*naixer_code` | text | mis. `T003` |
| `*is_active` | boolean | |

UNIQUE: `(tenant_id, product_id, variant_id)` (saat variant_id NULL diperlakukan sebagai sentinel).

#### `naixer_modifier_codes`
| Field | Tipe | Catatan |
|---|---|---|
| 🔑 `id` | text | |
| `*tenant_id` | text 🔗 | |
| `*modifier_kind` | text CHECK | `'size' \| 'ice' \| 'sugar' \| 'topping' \| 'cup' \| 'other'` |
| `*modifier_option_id` | text 🔗 modifiers | mis. ID untuk "Large", "Less ice" |
| `*naixer_code` | text | mis. `C01`, `S02`, `W01` |
| `*display_order` | int | urutan dalam string QR |
| `*is_active` | boolean | |

#### `naixer_qr_format_config`
| Field | Tipe | Catatan |
|---|---|---|
| 🔑 `id` | text | |
| `*location_id` | text 🔗 | |
| `*format` | text CHECK | `'dash' \| 'pipe'` |
| `*include_order_id` | boolean | TRUE untuk Format A; FALSE untuk Format B |
| `*parameter_order_json` | jsonb | array urut: `["product","size","ice","sugar","topping"]` |
| `*is_active` | boolean | |

Default seed (Aroadri Malioboro):
```
format = 'dash'
include_order_id = false
parameter_order = ['product', 'size', 'ice', 'sugar']
```

### 33.3 Generator (Strategy Pattern)

```ts
// packages/services/kitchen/naixer-qr.ts
type NaixerCodeFormat = 'dash' | 'pipe';

interface NaixerQRPayload {
  orderNumber?: string;
  productCode: string;
  specCodes: string[];   // urut sesuai parameter_order
}

interface NaixerQRStrategy {
  format: NaixerCodeFormat;
  encode(payload: NaixerQRPayload): string;
}

// dash: [product]-[spec1]-[spec2]-...
const dashStrategy: NaixerQRStrategy = {
  format: 'dash',
  encode: ({ productCode, specCodes }) => [productCode, ...specCodes].join('-'),
};

// pipe: [order_id]|[product]|[spec1],[spec2],...
const pipeStrategy: NaixerQRStrategy = {
  format: 'pipe',
  encode: ({ orderNumber, productCode, specCodes }) =>
    `${orderNumber ?? ''}|${productCode}|${specCodes.join(',')}`,
};

const STRATEGIES: Record<NaixerCodeFormat, NaixerQRStrategy> = {
  dash: dashStrategy,
  pipe: pipeStrategy,
};

export async function generateQrPayload(
  orderLineId: string,
  ctx: ServiceCtx,
): Promise<Result<{ payload: string; format: NaixerCodeFormat }>> {
  // 1. Ambil order line + sales_order
  // 2. Ambil naixer_qr_format_config untuk location
  // 3. Lookup naixer_product_codes(product_id, variant_id)
  // 4. Lookup naixer_modifier_codes untuk setiap modifier di order line, di-urutkan sesuai parameter_order
  // 5. Strategy = STRATEGIES[config.format]
  // 6. Return strategy.encode({ orderNumber, productCode, specCodes })
}
```

**Aturan**:
- Bila ada modifier yang **tidak punya mapping** Naixer code → log warning, **fallback ke kode default** yang dapat dikonfigurasi (mis. "no spec" = `Z00`), atau **abort + alert** jika config strict.
- Hasil disimpan ke `sales_order_lines.kds_qr_payload` (text) untuk audit & cetak ulang.

### 33.4 Cetak Label

Label printer (Comson CSPL78 BT atau equivalen) disimpan sebagai konfigurasi per lokasi di `naixer_qr_format_config`, bukan hardcoded. Pilihan awal:
- **6x4 cm landscape** (`label_width_mm=60`, `label_height_mm=40`)
- **4x3 cm landscape** (`label_width_mm=40`, `label_height_mm=30`)

Label wajib berisi 4 elemen:
1. **QR code** Naixer KDS (cukup besar untuk dibaca scanner): payload Naixer (Format B atau A sesuai config).
2. **Pickup number text** (besar): `Pickup #3`
3. **Jam pesanan**: contoh `10:42` dari `kds_order_items.queued_at` / waktu order.
4. **Deskripsi produk + ringkasan modifier** (sedang): `Glutinous Fragrant Tea (500ml) — Less sugar, Standard ice`

Driver: WebUSB / WebBluetooth (bila printer support) atau via service worker yang call print API mesin POS Imin Swan 2.

### 33.5 Demo Mode + Naixer
Saat POS dalam demo mode (lihat §34): **jangan kirim ke printer fisik**. Tampilkan preview label di layar (modal). Kalau memang harus cetak: tambahkan watermark "DEMO" di teks label dan QR diisi prefix `DEMO-` (tidak akan dibaca Naixer karena diawali kata bukan kode produk).

### 33.6 Update Vendor Code Mapping
- Daftar awal kode produk + spec **akan diberikan vendor Naixer** (sedang diminta user).
- Setelah diterima: import via `pnpm seed naixer-codes <file.csv>` (script di `scripts/seed-naixer-codes.ts`).
- Bila format vendor berubah, update via UI di `Settings → Integrations → Naixer KDS`.

### 33.7 MCP Tool
- `kitchen.list_naixer_product_codes()`
- `kitchen.set_naixer_product_code({ product_id, variant_id?, naixer_code })`
- `kitchen.set_naixer_modifier_code({ modifier_option_id, naixer_code, kind, display_order })`
- `kitchen.get_qr_format({ location_id })`
- `kitchen.set_qr_format({ location_id, format, include_order_id, parameter_order })`
- `kitchen.preview_qr({ sales_order_line_id })` — return string + image SVG.

> Lihat ADR-0007 untuk konteks lengkap.

---

## 34. POS Demo / Training Mode

### 34.1 Strategi: Client-Side Sandbox (Bukan Server Tenant)
- Demo state hidup **hanya di IndexedDB** POS device (database terpisah dari outbox produksi).
- **Tidak ada tabel `*_demo`** di server. **Tidak ada tenant terpisah**.
- Master data (produk, harga, modifier, tax) di-snapshot **dari produksi** saat demo mode diaktifkan (read-only di demo).
- Transaksi demo:
  - Tidak masuk ke `pending_orders` outbox.
  - Tidak dipost ke jurnal.
  - Tidak deduct stok.
  - Tidak masuk laporan / dashboard / audit log.

### 34.2 Aktivasi
1. User dengan permission `pos.demo.use` membuka menu kasir → tap "Mode Demo".
2. Modal konfirmasi: "Anda akan masuk Mode Demo. Transaksi tidak akan masuk sistem. Lanjutkan?"
3. Setelah konfirmasi:
   - Browser membuka tab/route `/pos/demo` (atau toggle in-place dengan state).
   - IndexedDB `aroadri-pos-demo` di-create / direset.
   - Master data di-snapshot dari `aroadri-pos` (database produksi PWA).
   - Banner "MODE DEMO" muncul (warna `brand-red` dengan tulisan putih, fixed top, dismissable hanya dengan keluar mode).

### 34.3 IndexedDB Schema Demo
```
indexeddb: aroadri-pos-demo
  ├─ products      (snapshot read-only)
  ├─ variants      (snapshot)
  ├─ modifiers     (snapshot)
  ├─ promotions    (snapshot)
  ├─ tax_rates     (snapshot)
  ├─ demo_orders   (transaksi demo, ditambah & dihapus oleh user)
  └─ meta          ('snapshot_at', 'cashier_id', 'session_id')
```

### 34.4 Cetak Label di Demo Mode
- Default: **preview di layar** (modal showing struk + QR), tanpa cetak fisik.
- Opsional (toggle di settings demo): cetak fisik dengan **watermark "DEMO / TIDAK SAH"** di kertas.
- QR di label demo diisi **payload prefix `DEMO-`** sehingga **tidak dibaca Naixer** (mis. `DEMO-T003-C01-S02-W01`).

### 34.5 Reset & Keluar
- Tombol "Reset Demo" → hapus `demo_orders` saja (pertahankan snapshot master).
- Tombol "Keluar Mode Demo" → wipe seluruh IndexedDB `aroadri-pos-demo` + redirect ke `/pos`.

### 34.6 Indikator
- Banner persistent (sticky top), warna kontras tinggi.
- Title bar browser: prefix `[DEMO]` di `<title>`.
- Setiap order detail: stempel diagonal "DEMO" di tampilan ringkas.

### 34.7 Permission
Tambah ke seed:
- `pos.demo.use` — bisa masuk demo mode
- `pos.demo.print` — bisa cetak label fisik di demo (default off; aktifkan hanya untuk training fisik)

### 34.8 Larangan
- ❌ Demo mode **tidak boleh** mengirim event ke server (telemetri demo opsional, tapi anonim).
- ❌ Demo mode **tidak boleh** mempengaruhi snapshot master (read-only enforced di IDB transaction `readonly`).
- ❌ Master data demo **tidak boleh** out-of-sync > 24 jam — bila snapshot terlalu lama, prompt user untuk refresh snapshot.

> Lihat ADR-0008 untuk konteks lengkap.

---

## 35. Resilience & Auto-Recovery

### 35.1 Layered Strategy

#### 35.1.1 Layer Client (POS PWA)
| Komponen | Implementasi |
|---|---|
| Pre-cache shell | Serwist precache: `/pos/*`, products list, fonts, logo |
| Network detection | `navigator.onLine` + heartbeat ping `GET /api/healthz` setiap 60 detik |
| Outbox (IndexedDB) | Tabel `pending_orders` (idempotency_key, payload, attempts, last_error, next_retry_at) |
| Sync flush | Background sync API; fallback: setInterval 30 detik bila online; exponential backoff 30 → 60 → 120 → 300 → 600 detik (cap 1 jam) |
| Idempotency | Setiap submit kirim header `Idempotency-Key: <client_order_uuid>`. Server cache hasil di `idempotency_records` (24 jam) |
| UX saat offline | Banner: "Offline — N transaksi pending sync" (kuning); transaksi tetap diterima |
| UX saat sync gagal | Notifikasi merah jika 3 retry beruntun gagal, sertakan tombol "Coba lagi sekarang" |
| Persistence saat reboot | IndexedDB tahan reboot device; service worker re-register saat browser dibuka |

#### 35.1.2 Layer Server Process
| Komponen | Implementasi |
|---|---|
| Process restart | PM2 `autorestart` untuk semua service |
| Healthcheck | Endpoint `/healthz` di tiap app: cek DB connection, Drizzle pool sehat, return 200 |
| PM2 health check | Worker outage monitor hit `http://127.0.0.1:3000-3002` dan kirim alert bila gagal |
| Memory limits | PM2 `max_memory_restart`; `--max-old-space-size` di Node command |
| Graceful shutdown | Listen SIGTERM → drain HTTP, flush logs, close DB pool, exit 0 |
| HestiaCP upstream | Reverse proxy ke port lokal; error/maintenance page dikelola di HestiaCP |

#### 35.1.3 Layer Database
- Managed (Neon/Supabase) — provider menangani replikasi & failover.
- App-side: connection pool dengan retry transient errors (timeout, connection reset). Library `postgres-js` punya `max_lifetime` + reconnect bawaan.
- Migrasi: zero-downtime style (additive). Hindari `DROP COLUMN` saat ada deploy berjalan; pakai 2-step (deprecate → migrate code → drop next deploy).

#### 35.1.4 Layer Worker
- BullMQ-like (atau queue ringan: `pg-boss` di Postgres yang sama, hemat dependency).
- Job idempotent: handler menerima `attempt` count, dapat skip kalau side-effect sudah dilakukan.
- Retry policy: 3x dengan exponential backoff. Setelah gagal final → kirim ke `dead_letter` table + notifikasi admin.

#### 35.1.5 Layer Monitoring
- **Internal cron**: setiap 5 menit, worker hit `/healthz` semua service. Bila gagal 2 kali berturut → kirim notifikasi (email/WA via webhook).
- **External uptime check** (gratis): UptimeRobot atau Better Stack free tier melakukan ping `https://erp.aroadritea.com/healthz` setiap 5 menit.

#### 35.1.6 Layer Notifikasi Outage
- **WhatsApp**: webhook ke nomor admin via WA Business API (bila tersedia) atau pakai Twilio.
- **Email**: ke `lintangmaulanazulfan@gmail.com`.
- **Pesan**: cantumkan timestamp, service yang down, durasi, last error.

### 35.2 Skenario Test Resilience (Wajib)
Tiap deploy ke production harus lulus test berikut di staging:

| # | Skenario | Expected |
|---|----------|----------|
| 1 | Cabut kabel jaringan saat user input order | POS terus dapat selesaikan order, banner offline muncul, struk tetap cetak, transaksi masuk outbox |
| 2 | Sambungkan kembali jaringan | Outbox flush dalam ≤ 30 detik, status order menjadi "synced" |
| 3 | Stop PM2 process `aroadri-web` saat ada 5 transaksi outbox | HestiaCP serve 502/maintenance; PM2 restart < 30 detik; outbox flush setelah restart |
| 4 | OOM/restart simulasi (`pm2 restart aroadri-web`) | Process otomatis kembali healthy < 30 detik |
| 5 | Reboot POS device dengan 3 transaksi outbox | Setelah boot + buka browser PWA, outbox masih ada, sync resume |
| 6 | Submit transaksi sama 2 kali (idempotency test) | Server hanya membuat 1 record; response kedua sama dengan pertama |
| 7 | Server down 5 menit | Notifikasi terkirim ke admin |
| 8 | DB connection drop | App reconnect otomatis dalam ≤ 5 detik; tidak ada request hilang |

Skrip uji di `scripts/resilience-tests/*.ts` perlu diarahkan ke PM2 untuk skenario proses server.

### 35.3 RTO / RPO
- **RTO (Recovery Time Objective)**: ≤ 2 menit (dari process crash hingga service healthy lagi).
- **RPO (Recovery Point Objective)**: 
  - POS: **0 transaksi hilang** (jaminan via outbox + idempotency).
  - Modul lain (akuntansi, dll.): ≤ 1 jam (kompromi karena tidak offline-capable; user wajib retry manual untuk action yang gagal saat outage).

### 35.4 Backup Recovery Drill
- Quarterly: restore backup harian ke staging, jalankan smoke tests, ukur waktu restore.
- Dokumentasi langkah di `docs/runbook/restore-from-backup.md`.

> Lihat ADR-0009 untuk konteks lengkap.

---

## 36. Design System (Anti-Generic UI)

> AI developer cenderung memproduksi tampilan default shadcn/ui (zinc/slate, radius standar, border default) yang langsung dikenali sebagai "AI-generated". Aroadri Tea memerlukan tampilan **distinctive, premium, Chinese-traditional**.

### 36.1 Prinsip Visual
1. **Brand-first**: setiap halaman menggunakan token brand (lihat §36.2). Tidak ada warna hex hardcoded.
2. **Premium tea brand vibe**: nuansa tenang, hangat, terasa "kerajinan tangan", bukan "tech startup loud".
3. **Inspirasi referensi (style)**: Linear, Stripe, Apple Pay receipt, Hakkasan menu — modern minimal dengan sentuhan oriental halus.
4. **Anti-pattern referensi yang HARUS DIHINDARI**: dashboard generic shadcn dengan zinc/slate + border-zinc-200 + bg-white card — terlalu mudah dikenali sebagai output AI.

### 36.2 Token Tailwind (di `apps/web/tailwind.config.ts` & `apps/site/...`)
```ts
theme: {
  extend: {
    colors: {
      brand: {
        red:        '#D6262E',  // cinnabar
        'red-dark': '#A41B22',  // hover/pressed
        cream:      '#FBF6EE',  // surface warm
        'cream-2':  '#F4ECDF',  // surface darker
        ink:        '#1A1A1A',  // text primary
        'ink-2':    '#3A3A3A',  // text secondary
        gold:       '#C8A557',  // accent premium
        jade:       '#5C8D7E',  // accent kalem (success)
        clay:       '#B85C38',  // accent secondary (warning)
      },
      // override default zinc/slate jadi brand untuk shadcn vars
      background: '#FBF6EE',
      foreground: '#1A1A1A',
      // … (mapping shadcn css vars ke brand)
    },
    fontFamily: {
      sans: ['Inter', 'Noto Sans SC', 'system-ui', 'sans-serif'],
      display: ['"Manrope"', '"Noto Serif SC"', 'serif'],
    },
    borderRadius: {
      // sedikit lebih lembut dari default tetapi tidak terlalu rounded
      sm:  '6px',
      md:  '10px',
      lg:  '14px',
      xl:  '20px',
      '2xl': '28px',
    },
    boxShadow: {
      // shadow lembut hangat, bukan biru-abu khas Material
      soft: '0 1px 2px rgba(58, 39, 18, 0.06), 0 8px 24px -12px rgba(58, 39, 18, 0.16)',
      pop:  '0 2px 6px rgba(58, 39, 18, 0.10), 0 18px 48px -16px rgba(58, 39, 18, 0.24)',
    },
  }
}
```

### 36.3 Komponen Wajib Custom (override shadcn/ui)
| Komponen | Override |
|---|---|
| Button (primary) | `bg-brand-red text-white hover:bg-brand-red-dark`, custom spring transition |
| Button (secondary) | `bg-brand-cream-2 text-brand-ink border-brand-ink/10` |
| Card | `bg-white border-brand-cream-2 shadow-soft` (tidak `bg-card border-border`) |
| Input | border `brand-ink/15`, focus ring `brand-red/40` |
| Tabs | underline animasi geser dengan `brand-red`, bukan tab kotak default |
| Toast | warm style dengan ikon outline, bukan filled |
| Empty state | ilustrasi dekoratif (motif awan / gunung sederhana SVG), bukan text-only |
| Loading state | spinner kustom (lihat §36.5) |
| Date picker | minggu mulai Senin (locale ID), header dengan brand color |
| Modal/Sheet | overlay `bg-brand-ink/50`, panel dengan `shadow-pop`, sudut konsisten radius |

### 36.4 Motif Dekoratif (Subtle, Bukan Tabrak Mata)
- **Header halaman publik**: garis tipis motif gelombang (SVG inline) di bawah hero, opacity 8–12%.
- **Empty state ilustrasi**: gunung + awan minimalis monokrom brand-red, 1 warna.
- **Login screen**: latar warm `brand-cream` + spot light radial halus.
- **Customer-facing display**: latar gelap `brand-ink` dengan aksen `brand-gold` untuk angka pickup besar (gold = premium).

### 36.5 Spinner / Loading Custom
Spinner default (border circle berputar) **dilarang** karena terlalu generic. Pakai motif khas Aroadri:
- 3 titik pulsing horizontal dengan warna `brand-red` (mengingatkan butir teh / bubble).
- Ukuran: sm (16px), md (24px), lg (40px).

### 36.6 Tipografi
- Body: Inter 400, line-height 1.55.
- Heading: Manrope 600/700, tracking sedikit lebih ketat (-0.01em).
- Mandarin headline: Noto Serif SC (memberi rasa traditional).
- Mandarin body: Noto Sans SC.
- **Larangan**: jangan pakai Roboto / Open Sans (terlalu generic).

### 36.7 Iconography
- Default: **Lucide icons** (sudah include shadcn). 
- **Override**: ikon brand-spesifik (gunung, awan, daun teh, gelas) menggunakan SVG kustom di `packages/ui/icons/brand/`.
- Stroke width konsisten 1.5px (bukan default 2px Lucide) untuk feel lebih halus.

### 36.8 Microinteraction
- Semua transition `cubic-bezier(0.16, 1, 0.3, 1)` (ease-out spring), durasi 200–280ms.
- Hover button: subtle scale 1.02 + shadow ramp.
- Focus state: ring ganda (inner cream + outer red) — bukan default biru OS.

### 36.9 Mode Gelap (Phase 2)
- Phase 1: light only (warm cream).
- Phase 2: dark mode dengan basis `brand-ink` background + `brand-cream` text + accent `brand-gold`. Hindari "default dark zinc-950".

### 36.10 Aturan AI Developer
1. **WAJIB** import token dari `tailwind.config.ts`. **Dilarang** menulis `bg-white`, `text-zinc-*`, `border-slate-*` di komponen produksi. Lint rule menangkap ini.
2. **WAJIB** override shadcn/ui base components di `packages/ui/` sebelum dipakai di `apps/*`. Jangan pakai shadcn raw.
3. **WAJIB** review screenshot tiap halaman penting di `docs/screenshots/<page>.png` — bila tampak generic AI dashboard, refactor.
4. **DILARANG** generate ilustrasi via DALL-E / placeholder Lorem Picsum di production. Pakai SVG kustom atau foto produk asli (folder `apps/site/public/photo/`).
5. Sebelum PR: jalankan visual diff (Playwright + Percy / sederhana — screenshot manual) untuk halaman utama.

> Lihat ADR-0006 untuk diskusi alternatif & alasan keputusan.

---

## 37. TASK.md Workflow untuk AI Multi-Sesi

### 37.1 Masalah
Sesi AI Code (Claude Code, Gemini CLI, dll.) memiliki **token limit**. Sebuah implementasi modul akuntansi atau POS dapat membutuhkan beberapa puluh ribu token; satu sesi mungkin tidak cukup. Tanpa kontinuitas, sesi berikutnya kehilangan konteks "sudah sampai mana".

### 37.2 Solusi: TASK.md + Checkpoint Files

```
ERP/
├── TASK.md                      ← state register tasks (SINGLE source of truth runtime)
└── docs/
    └── checkpoints/             ← satu file per task aktif yang signifikan
        ├── 0001-scaffold-monorepo.checkpoint.md
        ├── 0002-db-schema-iam.checkpoint.md
        └── …
```

#### `TASK.md`
- Di root repo (mudah ditemukan oleh AI baru).
- Berisi tabel semua task dengan status, owner (AI model), dan link checkpoint.
- AI **wajib update** saat: start task, write code signifikan, complete task, blocked.

#### `docs/checkpoints/<id>-<slug>.checkpoint.md`
- Hanya untuk task `IN_PROGRESS` dan task yang baru selesai dalam ≤ 7 hari (untuk audit).
- Berisi:
  1. **Goal**: apa yang harus dicapai (ringkasan).
  2. **Plan**: langkah-langkah yang sudah dijabarkan.
  3. **Done so far**: file & function yang sudah ditulis/diubah, dengan path eksplisit.
  4. **Decisions**: keputusan teknis yang diambil dalam task ini.
  5. **Open issues**: bugs / TODO / pertanyaan yang muncul.
  6. **Next step**: kalimat eksplisit "selanjutnya jalankan X di file Y baris Z".
  7. **Test status**: lulus / gagal / belum jalan.

### 37.3 Format TASK.md (Template)

```markdown
# TASK.md — Active Implementation Tasks

> Single source of truth runtime untuk task yang sedang/akan dikerjakan AI developer.
> AI **wajib** update file ini sebelum dan sesudah bekerja.

## Legend
- 🟦 PENDING
- 🟨 IN_PROGRESS
- 🟩 DONE
- 🟥 BLOCKED
- ⚪ DEFERRED

## Active Tasks (sedang dikerjakan)

| ID | Status | Title | Owner | Started | Checkpoint | Blocker |
|----|--------|-------|-------|---------|-----------|---------|
| T-0042 | 🟨 | Implementasi journal posting | claude-sonnet-4-5 | 2026-05-08 09:30 | [link](docs/checkpoints/0042-journal-posting.checkpoint.md) | — |

## Done This Sprint (≤ 7 hari)

| ID | Title | Owner | Completed | Commit |
|----|-------|-------|-----------|--------|
| T-0001 | Scaffold monorepo | claude-sonnet-4-5 | 2026-05-06 | `abc123` |

## Backlog (scoped, belum dimulai)

| ID | Title | Module | Phase | Spec link |
|----|-------|--------|-------|-----------|
| T-0050 | Inventory adjustment workflow | inventory | 2 | SD §21.5 |

## Aturan Update
- Tambah task baru di Backlog; saat mulai → pindahkan ke Active dengan owner & timestamp.
- Saat menulis code signifikan → buat/update file checkpoint.
- Saat selesai → pindahkan ke Done, link commit.
- Saat blocked → pindahkan ke top Active dengan 🟥 + isi kolom Blocker.
```

### 37.4 Format Checkpoint (Template)

```markdown
# Checkpoint: T-0042 — Implementasi journal posting

- **Owner**: claude-sonnet-4-5
- **Started**: 2026-05-08 09:30
- **Last updated**: 2026-05-08 11:15
- **Status**: 🟨 IN_PROGRESS

## Goal
Implementasi `accounting.postJournal(journalId)` yang:
- Validasi balance debit=credit
- Validasi period status='open'
- Set status='posted', posted_at, posted_by
- Tulis audit_log

Spec: SOURCE-OF-TRUTH §10, SYSTEM-DESIGN §20.

## Plan
1. [x] Tambah Zod schema input
2. [x] Implementasi service `postJournal`
3. [x] Test happy path
4. [ ] Test reject saat period closed
5. [ ] Test reject saat tidak balance
6. [ ] Server action wrapper di apps/web
7. [ ] MCP tool `accounting.post_journal`
8. [ ] i18n key untuk pesan error
9. [ ] PR & verifikasi lint/typecheck/test

## Done so far
- `packages/services/accounting/journal.service.ts` — fungsi `postJournal` ditulis (line 80-150)
- `packages/services/accounting/journal.service.test.ts` — 3 test happy path lulus
- Commit: belum

## Decisions
- Mengubah `posted_at` ke timestamp DB `now()` server-side (bukan dari client) — keputusan: tidak percaya jam client.
- Reversal entry akan dibuat di task terpisah T-0043.

## Open issues
- ❓ Apakah period status `'closing'` boleh menerima posting? Saat ini: tidak. Verifikasi dengan SoT — confirmed: SoT §10 melarang.

## Next step
Lanjutkan langkah 4: tambah test untuk period closed di `journal.service.test.ts` (mock period dengan status='closed', expect AppError 'BUSINESS_RULE').

## Test status
- Unit: 3/8 lulus, sisanya belum ditulis.
- Integration: belum.
- E2E: belum diperlukan (server-only).
```

### 37.5 Aturan untuk AI Developer

**Sebelum mulai bekerja**:
1. Baca `TASK.md`. Cari status 🟨 IN_PROGRESS yang owner-nya kompatibel (atau yang owner-nya AI lain tetapi sudah idle > 1 jam — lihat `Last updated` di checkpoint).
2. Bila ada IN_PROGRESS yang relevan: baca checkpoint-nya. Lanjutkan dari `Next step`.
3. Bila tidak ada: pilih task dari Backlog yang phase-nya sesuai prioritas. Pindahkan ke Active dengan owner & timestamp baru.

**Saat bekerja**:
4. Update checkpoint **setiap kali** menulis 100+ baris code atau menyelesaikan satu sub-step Plan. Update field `Last updated`, `Done so far`, `Next step`.
5. Bila menemui ambiguitas yang tidak bisa di-resolve dari SoT/SD: status → 🟥 BLOCKED, isi Blocker, beritahu user via output.

**Saat berhenti (token limit / sesi habis)**:
6. **WAJIB** update checkpoint dengan `Next step` yang **eksplisit dan dapat dieksekusi langsung** oleh AI selanjutnya.
7. **JANGAN** menulis "lanjutkan dari sini" yang vague. Tulis: "Edit file X.ts baris Y, tambahkan function Z dengan signature `(input: A) => Result<B>`, lalu jalankan `pnpm test packages/services/accounting`".
8. Sebelum exit: commit code yang sudah ditulis (meski belum lengkap) dengan pesan `wip(T-XXXX): <ringkas>` agar tidak hilang.

**Saat AI baru lanjutkan**:
9. Baca `TASK.md` → cari 🟨 dengan `Last updated` paling baru (atau yang spesifik di-handoff).
10. Baca checkpoint penuh. **Tidak boleh** menebak — bila `Next step` tidak jelas, tanya user.
11. Update owner di TASK.md ke AI baru, update `Last updated`.

**Saat selesai**:
12. Update `TASK.md`: pindah ke Done, isi Commit.
13. Hapus file checkpoint **setelah 7 hari** dari completion (audit window) atau pindahkan ke `docs/checkpoints/archive/`.

### 37.6 Penomoran Task
Format: `T-NNNN` (4 digit, pad zero), di-increment global. Sumber:  baris terakhir di TASK.md.

### 37.7 ID Task vs Branch Git
- Branch: `feat/T-0042-journal-posting`.
- Commit: `feat(accounting): T-0042 implement journal posting`.

### 37.8 Larangan
- ❌ Mulai task baru tanpa entry di TASK.md.
- ❌ Bekerja > 200 baris code tanpa update checkpoint.
- ❌ Selesaikan task tanpa commit + tulis di Done.
- ❌ Edit checkpoint AI lain yang masih IN_PROGRESS dan owner-nya aktif (< 1 jam idle).

> Lihat ADR-0009 (atau ADR baru bila workflow ini perlu evolusi) untuk justifikasi.

---

## 38. Konfigurasi & Kustomisasi Tanpa Edit Source

Target sistem adalah fleksibel untuk operasional Aroadri Tea tanpa harus mengubah source code setiap ada perubahan bisnis. Aturan implementasi:

- Konfigurasi bisnis yang berubah rutin harus disimpan di database dan dikelola lewat admin UI/seed: pajak, COA, scheduled jobs, workflow, custom field, CMS, lokasi, katalog, role, permission, dan mapping integrasi.
- Environment variable hanya untuk secret, URL deployment, provider eksternal, dan default bootstrap yang jarang berubah.
- Source code hanya boleh memuat default aman untuk development dan kontrak validasi. Nilai production harus bisa dioverride.
- Bila menemukan nilai hardcoded baru di service/app, pindahkan ke DB atau env sebelum fitur dianggap production-ready.
- Referensi operasional lengkap ada di `docs/CONFIGURATION.md`.

Contoh yang sudah menjadi konfigurasi UI/DB: POS mengambil kode pajak PB1, akun kas/settlement, akun pendapatan, akun donasi, channel delivery net settlement, basis point settlement, dan lebar struk dari tabel `pos_settings`. Tarif pajak tetap dari `tax_rates`; mapping Naixer dan ukuran label dari tabel konfigurasi Naixer. Member registration memakai Turnstile dan SMTP HestiaCP via environment karena credential keduanya rahasia, dengan fallback development yang tidak aktif di production.

---

## Catatan Versi

| Versi | Tanggal | Penulis | Perubahan |
|-------|---------|---------|-----------|
| 1.0 | 2026-05-05 | Lintang Maulana Zulfan | Versi awal — diturunkan dari SOURCE-OF-TRUTH v1.0 dan keputusan stack 2026-05-05 |
| 1.1 | 2026-05-05 | Lintang Maulana Zulfan | Tambah §31 (Public Website + CMS + Member Portal) dan §32 (Domain & Routing); split `apps/site` dari `apps/web`; tambah skema CMS, member, OTP; update arsitektur dan dependency rule |
| 1.2 | 2026-05-05 | Lintang Maulana Zulfan | Upgrade RAM 1→2 GB, update §3 + §4.3 + §24.1; tambah §33 Naixer QR Integration, §34 POS Demo Mode, §35 Resilience & Auto-Recovery, §36 Design System (anti-generic), §37 TASK.md Workflow; tabel constraints diperluas |
| 1.3 | 2026-05-05 | Lintang Maulana Zulfan | Resolusi 4 Open Decisions: confirm Neon + better-auth di §5; expand §19.3 (PPN opt-in dengan `tax_rules`); tambah skema `tax_rules` di §9.2; update §30 (8 dari 19 keputusan resolved) |
| 1.7 | 2026-05-12 | Lintang Maulana Zulfan | Tambah §25.5b (Omzet Harian Export — PB1 10% exclusive + koreksi fiskal manual): schema `daily_revenue_adjustments`, rumus PB1-exclusive gross÷1.10, UI inline edit, XLSX export 8 kolom, MCP tool `reporting.get_omzet_harian` |
| 1.8 | 2026-05-13 | Codex | Tambah §38 dan `docs/CONFIGURATION.md`: kebijakan konfigurasi production/kustomisasi tanpa edit source, env wajib, POS posting, pajak, Turnstile, dan OTP email |
| 1.9 | 2026-05-13 | Codex | Email otomatis diputuskan memakai SMTP mailbox HestiaCP (`SMTP_*`) sesuai ADR-0011 |
| 2.0 | 2026-05-14 | Codex | Deployment VPS production dialihkan dari Docker Compose ke PM2 + HestiaCP sesuai ADR-0012 |

---

> **Aturan emas**: ketika ragu, **berhenti** dan baca ulang SOURCE-OF-TRUTH + SYSTEM-DESIGN. Bila masih ragu, **tanya user** sebelum menulis kode. Lebih baik 5 menit klarifikasi daripada 5 jam refactor.
