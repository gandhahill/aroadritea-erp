# CLAUDE.md — Panduan untuk Claude Code

Dokumen ini menjelaskan cara Claude Code (dan AI assistant lain) bekerja di repository ERP Aroadri Tea. **Wajib dibaca sebelum membuat perubahan kode atau saran arsitektur.**

---

## 1. Konteks Singkat

Repository ini adalah **sistem ERP custom** untuk **PT. Gandha Hill Catering Management Indonesia** (merek **Aroadri Tea**) — sebuah kedai bubble tea & dessert bergaya Tiongkok dengan toko di Yogyakarta dan kantor di Yogyakarta + Jakarta.

- **PIC + developer**: Lintang Maulana Zulfan (`lintangmaulanazulfan@gmail.com`)
- **Bahasa kerja**: Bahasa Indonesia (untuk komunikasi & dokumentasi). Komentar kode boleh Bahasa Inggris.
- **Komunikasi tim luas**: WhatsApp.
- **Komunikasi dengan AI / harness**: melalui Claude Code (file ini) dan **MCP server** yang akan dibangun (lihat §6).

---

## 2. Dua Source of Truth

Repository ini punya **dua** dokumen sumber kebenaran yang **wajib** dibaca sebelum mengubah apa pun:

📌 **`SOURCE-OF-TRUTH.md`** — sumber kebenaran **bisnis** (apa yang dibangun & mengapa).
📌 **`SYSTEM-DESIGN.md`** — sumber kebenaran **teknis** (bagaimana dibangun: stack, skema DB, pola arsitektur, konvensi).

Aturan konflik:
- Pertanyaan kebutuhan bisnis → SOURCE-OF-TRUTH menang.
- Pertanyaan implementasi teknis → SYSTEM-DESIGN menang.

Sebelum:
- Menambah/mengubah skema database → baca **SYSTEM-DESIGN §8–§9**
- Menambah modul atau fitur → baca **SOURCE-OF-TRUTH** modul terkait + **SYSTEM-DESIGN §21**
- Mengubah peran / izin → baca **SYSTEM-DESIGN §11**
- Menambah field / atribut → cek apakah perlu kolom riil atau custom field engine (**SYSTEM-DESIGN §17**)
- Mengubah aturan akuntansi / pajak → baca **SYSTEM-DESIGN §19–§20**
- Menulis MCP tool → baca **SYSTEM-DESIGN §16**
- Menulis kode offline POS → baca **SYSTEM-DESIGN §14**

Bila ada kebutuhan baru yang belum ada, **update dokumen relevan dulu** (SoT untuk bisnis, SD untuk teknis), baru tulis kodenya.

Sumber mentah (kuesioner asli) ada di `../ERP-Questionaire.pdf`. Gunakan hanya sebagai rujukan terakhir bila kedua SoT silent.

---

## 3. Status Repository

Saat dokumen ini ditulis (2026-05-05), repository **belum berisi kode** — masih tahap perancangan. Yang sudah ada:

```
ERP/
├── CLAUDE.md             ← file ini (panduan harian AI)
├── SOURCE-OF-TRUTH.md    ← spesifikasi kebutuhan bisnis (v1.3)
├── SYSTEM-DESIGN.md      ← rancangan sistem teknis untuk AI developer (v1.3)
├── TASK.md               ← register task aktif & backlog (runtime, AI WAJIB update)
├── brand-assets/
│   └── BRAND.md          ← logo, palet, tipografi, larangan visual, panduan UI
└── docs/
    ├── adr/              ← Architecture Decision Records
    │   ├── README.md     ← index ADR (10 ADR diputuskan)
    │   ├── 0001-stack-choice.md
    │   ├── 0002-monorepo-and-app-split.md
    │   ├── 0003-public-website-cms-architecture.md
    │   ├── 0004-member-registration-and-auth.md
    │   ├── 0005-build-vs-modify-existing-erp.md
    │   ├── 0006-design-system-anti-generic.md
    │   ├── 0007-naixer-qr-integration.md
    │   ├── 0008-pos-demo-mode-client-side.md
    │   ├── 0009-resilience-and-auto-recovery.md
    │   └── 0010-ppn-engine-opt-in.md
    ├── checkpoints/      ← state per task IN_PROGRESS
    │   ├── README.md     ← cara pakai
    │   ├── TEMPLATE.checkpoint.md
    │   └── archive/      ← checkpoint lebih dari 7 hari
    └── runbook/          ← (akan diisi: server outage, restore backup, dll.)
```

Begitu kode mulai ditulis, ikuti struktur di **SYSTEM-DESIGN.md §6** (Repository Layout).

### 3.1 Daftar ADR yang Sudah Diputuskan

| # | Judul | Status | Pesan |
|---|-------|--------|-------|
| [0001](docs/adr/0001-stack-choice.md) | Pilihan Stack Teknologi | Accepted | Next.js 15 + Drizzle + Postgres managed; **tidak boleh** Prisma/Bun/Odoo |
| [0002](docs/adr/0002-monorepo-and-app-split.md) | Monorepo + App Split | Accepted | 4 app: `site` (publik), `web` (ERP), `mcp`, `worker` |
| [0003](docs/adr/0003-public-website-cms-architecture.md) | Public Website + CMS | Accepted | Custom CMS internal + JAMstack ISR + Cloudflare CDN |
| [0004](docs/adr/0004-member-registration-and-auth.md) | Member Registration & Auth | Accepted | Email + OTP + Turnstile; sesi terpisah dari ERP staff |
| [0005](docs/adr/0005-build-vs-modify-existing-erp.md) | Build vs Modify ERP Open Source | Accepted | Bangun custom — Odoo/ERPNext tidak masuk constraint RAM 2 GB |
| [0006](docs/adr/0006-design-system-anti-generic.md) | Design System Anti-Generic UI | Accepted | Token brand + override shadcn/ui; lint rule larang `bg-white`, `text-zinc-*`, `border-slate-*` |
| [0007](docs/adr/0007-naixer-qr-integration.md) | Naixer KDS Integration via QR | Accepted | QR-only (tanpa API); strategy pluggable dash/pipe; mapping master di DB |
| [0008](docs/adr/0008-pos-demo-mode-client-side.md) | POS Demo / Training Mode | Accepted | Sandbox client-side IndexedDB; tidak pernah sync ke server; QR demo prefix `DEMO-` |
| [0009](docs/adr/0009-resilience-and-auto-recovery.md) | Resilience & Auto-Recovery | Accepted | PWA offline POS + Docker auto-restart + healthcheck + idempotency; RTO 2m, RPO 0 untuk POS |
| [0010](docs/adr/0010-ppn-engine-opt-in.md) | PPN Engine — Opt-In | Accepted | PB1 default, PPN keluaran off untuk retail; engine siap B2B kelak via `tax_rules` |

Bila keputusan baru mempengaruhi >1 modul, ubah skema, atau menambah dependency utama → **wajib** tulis ADR baru di `docs/adr/`. Format: lihat `docs/adr/README.md`.

---

## 4. Ringkasan Arsitektur

Detail lengkap di **`SYSTEM-DESIGN.md`**. Ringkasan operasional:

- **Stack**: TypeScript + Next.js 15 (App Router) + Hono (MCP) + Drizzle ORM + PostgreSQL managed (Neon/Supabase) + Tailwind + shadcn/ui (di-override brand) + better-auth + next-intl + Serwist (PWA).
- **Bentuk**: modular monolith dalam pnpm workspace dengan 4 app: `site` (publik, aroadritea.com), `web` (ERP, erp.aroadritea.com), `mcp` (Hono), `worker` (cron + queue).
- **Tiga lapisan**: `apps/*` (transport) → `packages/services/*` (business logic, Result-typed) → `packages/db` (Drizzle schema).
- **DB managed** terpisah dari VPS (offload RAM); VPS hanya menjalankan compute (Next.js × 2 + MCP + worker + Caddy).

**Constraint keras**:
- Server VPS **1 vCPU / 2 GB RAM / 60 GB disk** (upgrade dari 1 GB pada 2026-05-05) — Odoo/ERPNext/Frappe (≥ 4 GB) **tetap tidak masuk**.
- POS wajib **PWA + offline mode + idempotent sync** (lihat SD §14, §35).
- Multibahasa **ID/EN/ZH** sejak hari pertama (lihat SD §13).
- **MCP server** wajib (lihat SD §16).
- Multi-cabang via **dimensi `location_id`** (lihat SD §12).
- Custom field & permission **database-driven**, tidak hardcode (lihat SD §17, §11).
- **UI distinctive — bukan default shadcn** (lihat SD §36, ADR-0006).
- **Naixer KDS** integrasi via **QR-only**, bukan API (lihat SD §33, ADR-0007).
- **POS Demo mode** wajib (sandbox client-side, tidak sync ke server) — lihat SD §34, ADR-0008.
- **Resilience**: RTO ≤ 2 menit, RPO 0 untuk POS (lihat SD §35, ADR-0009).

---

## 5. Konvensi Kode (Diset Lebih Awal)

### 5.1 Bahasa & Komentar
- **Identifier kode**: Bahasa Inggris (camelCase / PascalCase / snake_case sesuai konvensi bahasa).
- **Komentar kode**: Bahasa Inggris ringkas. Hanya tulis komentar bila *why* tidak jelas dari kode.
- **String UI**: melalui i18n key (jangan hardcode Bahasa Indonesia di JSX/template).
- **Pesan commit**: Bahasa Inggris, conventional commits (`feat:`, `fix:`, `refactor:`, `docs:`, `chore:`).

### 5.2 Multibahasa (i18n)
- Semua label, tombol, judul kolom, pesan validasi → **wajib pakai key i18n**.
- Data master (produk, kategori, modifier) menyimpan kolom `name_id`, `name_en`, `name_zh` (atau pola JSON `{ id, en, zh }`).
- Format mata uang: IDR (tanpa desimal), thousand separator titik, decimal koma untuk locale ID; locale EN/ZH ikut konvensi mereka.
- Format tanggal: `YYYY-MM-DD` di database; tampilan UI per locale.

### 5.3 Skema Database
- Setiap tabel transaksional **wajib** punya kolom audit:
  - `id` (UUID atau ULID)
  - `created_at`, `updated_at`, `deleted_at` (soft delete)
  - `created_by_user_id`, `updated_by_user_id`
  - `location_id` (kecuali tabel master global)
  - `tenant_id` bila multi-tenant disiapkan untuk franchise
- **Audit trail terpisah** di tabel `audit_log` (entity_type, entity_id, action, before_json, after_json, user_id, timestamp).

### 5.4 Akuntansi (Aturan Khusus)
- Setiap entry jurnal: **debit total = kredit total** (validasi server-side wajib).
- Setiap entry jurnal **harus** punya: `posting_date`, `location_id`, `currency=IDR`, `period_id`.
- COA mengikuti **Lampiran A SOURCE-OF-TRUTH.md**, di-seed saat go-live. Jangan tambah akun ad-hoc dari kode — selalu via UI/migrasi yang tercatat.
- Periode akuntansi yang sudah ditutup **tidak boleh** menerima posting baru.

### 5.5 Keamanan
- **Tidak pernah** commit secret (kunci API, password DB, JWT secret) ke repo. Pakai `.env` + `.env.example`.
- Password user: hash dengan **argon2id** atau **bcrypt cost ≥ 12**.
- Data pribadi karyawan & pelanggan (KTP, NPWP, telp) → **enkripsi at-rest** (sesuai UU PDP).
- HTTPS only di production. Cookie session: `Secure`, `HttpOnly`, `SameSite=Lax`.

### 5.6 Pajak — Aturan Tetap
- **PB1/PBJT 10%, inclusive**: tarif disimpan di tabel `tax_rate`, jangan hardcode.
- **PPN keluaran/masukan**: di-track per dokumen, tidak hanya summary.
- Format export untuk **Coretax**: CSV/Excel sesuai layout Coretax (versi terkini per tanggal commit).

### 5.7 Larangan
- ❌ Hardcode role check di middleware (`if user.role === 'admin'`) — pakai permission lookup ke DB.
- ❌ Hardcode menu produk / harga / tarif pajak di kode.
- ❌ Tambah library besar (>5 MB bundle / >100 MB node_modules) tanpa diskusi — server kecil.
- ❌ Mock database di test integrasi — pakai DB real (atau Testcontainers).
- ❌ Console.log di production code path.
- ❌ Skip pre-commit hook (`--no-verify`).
- ❌ Pakai class Tailwind generic shadcn (`bg-white`, `text-zinc-*`, `border-slate-*`) di `apps/*` — wajib pakai token `brand.*`. Lihat ADR-0006.
- ❌ Generate UI dengan default shadcn raw — selalu via `packages/ui/` yang sudah di-override brand.
- ❌ Pakai Date.now() / setInterval untuk waktu DB — pakai `now()` SQL dan timer server.
- ❌ Pakai `number` untuk uang — pakai `Money` (bigint).
- ❌ Mulai task tanpa entry di `TASK.md` + checkpoint.
- ❌ Exit sesi tanpa update checkpoint dengan `Next step` eksplisit.

---

## 5.8 Workflow TASK.md (Wajib untuk AI Multi-Sesi)

Karena AI memiliki token limit, sesi dapat terputus di tengah implementasi. Untuk kontinuitas:

1. **`TASK.md` di root repo** = single source of truth runtime untuk semua task.
2. **`docs/checkpoints/<id>-<slug>.checkpoint.md`** = catatan rinci per task aktif.
3. **Template**: `docs/checkpoints/TEMPLATE.checkpoint.md`.
4. **Spesifikasi**: `SYSTEM-DESIGN.md §37`.

### Aturan ringkas (lihat detail di SD §37):

**Sebelum mulai bekerja**:
- Baca `TASK.md`. Cari 🟨 IN_PROGRESS yang owner-nya idle > 1 jam → boleh ambil alih. Bila < 1 jam, jangan ambil alih.
- Bila tidak ada Active yang dapat dilanjutkan → pilih dari Backlog sesuai phase.
- Pindahkan task dari Backlog → Active, isi Owner, Started, Last Updated, buat checkpoint baru.

**Saat bekerja**:
- Update checkpoint setiap 100+ baris code atau setiap sub-step Plan diselesaikan.
- Update field `Last Updated` di TASK.md.

**Saat berhenti (token limit / sesi habis)**:
- WAJIB tulis `## Next step` **eksplisit dan dapat dieksekusi** di checkpoint.
- Format Next step yang baik: `"Edit X.ts baris N, tambahkan function Y dengan signature ..., lalu jalankan pnpm test ..."`.
- Commit code yang sudah ditulis (meski belum lengkap) dengan pesan `wip(T-XXXX): <ringkas>`.

**Saat AI baru lanjutkan**:
- Baca `TASK.md` → cari 🟨 dengan `Last Updated` paling baru.
- Baca checkpoint penuh. Lanjutkan dari `Next step`.
- **Jangan menebak**. Bila `Next step` tidak jelas → tanya user.
- Update Owner di TASK.md ke AI baru.

**Saat selesai**:
- Update `TASK.md`: pindah ke Done, isi Commit.
- Update checkpoint: status 🟩 DONE.
- Setelah 7 hari → arsipkan checkpoint ke `docs/checkpoints/archive/`.

---

## 6. MCP Server (Fitur Diferensiasi)

ERP ini **wajib** mengekspos antarmuka **Model Context Protocol** sehingga AI lokal (Gemini CLI, Claude Code, Google Antigravity, dll.) dapat:

- **Read**: query produk, stok, jurnal, audit log, employee, payroll.
- **Write**: create purchase order, update inventory adjustment, create employee record, log complaint.
- **Audit**: read audit log + diff before/after.

Authentikasi MCP: per-user token dengan scope = scope user di UI. Jangan beri MCP "super-user". Tools MCP **harus melewati permission engine yang sama** dengan UI.

Saat membangun fitur baru, **selalu pertimbangkan** MCP tool yang setara — agar AI bisa otomatisasi.

---

## 7. Struktur Direktori (Akan Diisi)

> Kosong saat ini. Setelah scaffold awal, dokumentasikan layout di sini. Contoh placeholder:
>
> ```
> ERP/
> ├── apps/
> │   ├── web/         # Next.js / SvelteKit / dst — UI utama
> │   └── mcp-server/  # MCP server endpoint
> ├── packages/
> │   ├── db/          # ORM schema + migrations
> │   ├── shared/      # types, utils, i18n keys
> │   └── ui/          # shared components
> ├── docs/
> │   └── adr/         # Architecture Decision Records
> ├── SOURCE-OF-TRUTH.md
> └── CLAUDE.md
> ```

---

## 8. Workflow Pengembangan

1. **Sebelum mulai**: baca isu / diskusi WhatsApp + SOURCE-OF-TRUTH.md bagian relevan.
2. **Branch**: `feat/...`, `fix/...`, `refactor/...`, `docs/...`.
3. **Commit kecil & sering**, pesan jelas (lihat §5.1).
4. **Test**: tulis test untuk logic akuntansi & pajak (jangan kompromi). Untuk UI ringan boleh minimal.
5. **Review diri sendiri**: jalankan lint + typecheck + test sebelum commit.
6. **Update dokumen** kalau perubahan menyentuh kebutuhan bisnis.
7. **Push**, deploy ke staging, verifikasi manual di toko (sebelum push ke prod).

---

## 9. Pengingat Operasional

- **PB1/PBJT inclusive** — *jangan* tambahkan pajak di atas harga jual yang ditampilkan.
- **Komisi delivery 20%** — pendapatan bersih GoFood/GrabFood/ShopeeFood = 80% × harga.
- **Stock opname**: bulanan global, mingguan untuk teh + lemon.
- **Tanggal payroll**: **tanggal 8** setiap bulan.
- **Jam toko**: 10:00–22:00 WIB.
- **Bahasa default UI** untuk staf operasional: **Bahasa Indonesia**. Direksi: bisa switch ke **Mandarin** atau **Inggris**.
- **Backup**: harian, retensi mingguan, off-site.

---

## 10. Pertanyaan Terbuka

Pertanyaan teknis terbuka ada di **`SYSTEM-DESIGN.md` §30** (Open Decisions / ADR Pointers).

Pertanyaan bisnis terbuka:
- [ ] Visi 1/3/5 tahun → mempengaruhi keputusan multi-tenant / franchise sejak awal atau tidak.
- [ ] Diferensiasi vs Chagee / Molly Tea (untuk strategi branding di sistem).
- [ ] Deskripsi tugas detail per peran (data baca/tulis spesifik) — saat ini hanya outline kasar.
- [ ] Daftar lengkap supplier + syarat pembayaran (akan diinput user sendiri ke sistem nanti).
- [ ] Daftar lengkap aset tetap dengan nilai perolehan, tanggal, masa manfaat (ada di file Excel terpisah, perlu import).
- [ ] Daftar resep / BOM (akan diinput user setelah modul siap).
- [ ] Apakah Plaza Malioboro outlet kedua sudah operasional atau dalam persiapan? (Status di kuesioner: Aktif, perlu dikonfirmasi)
- [ ] Konfirmasi konsultan pajak: penjualan retail F&B dikenakan PPN selain PB1 atau tidak?

---

## 11. Memori AI (untuk Sesi Claude Code)

Repository ini sudah memiliki memori pengguna di `~/.claude/projects/D--KERJA-Aroadri-Tea-ERP/memory/`. Beberapa fakta penting yang sudah tersimpan:

- User adalah developer + PIC tunggal proyek, kerja solo.
- Bahasa kerja Indonesia, koordinasi WhatsApp.
- Server constraint: **1 vCPU / 2 GB RAM / 60 GB disk** (upgrade dari 1 GB pada 2026-05-05).
- Modul priority: Accounting → Reporting → Tax → POS → Inventory → Purchasing → Kitchen → HR → CRM.
- Sumber dokumen mentah ada di `D:/KERJA/Aroadri Tea/`.
- Naixer KDS integrasi via QR-only (Format B dash default; Format A pipe sebagai fallback). Vendor code list tidak menunggu — user input via UI.
- POS wajib offline + demo mode client-side.
- DB managed: **Neon** (Supabase fallback). Auth: **better-auth**.
- PPN engine **opt-in** — PB1 default untuk retail F&B; PPN keluaran siap diaktifkan kelak untuk B2B via tabel `tax_rules` (lihat ADR-0010).

Bila informasi tersebut berubah (mis. anggaran naik, tim bertambah, server diupgrade lagi), **update memori** sekaligus dokumen ini.

---

## 12. Cek Cepat Sebelum Mulai (Pre-Flight Checklist AI)

Sebelum AI menulis kode pertama:

- [ ] Sudah baca `SOURCE-OF-TRUTH.md` bagian relevan?
- [ ] Sudah baca `SYSTEM-DESIGN.md` bagian relevan?
- [ ] Sudah baca semua ADR yang relevan (lihat §3.1)?
- [ ] Sudah cek `TASK.md` untuk Active Tasks?
- [ ] Bila ada IN_PROGRESS dengan owner idle > 1 jam → siap ambil alih?
- [ ] Bila task baru → sudah pindahkan dari Backlog ke Active + buat checkpoint?
- [ ] Tahu modul mana yang disentuh, file mana yang akan diubah?
- [ ] Tidak ada keputusan yang harus dijatuhkan yang belum ada di Open Decisions (SD §30)?

Bila ada yang belum jelas — **berhenti dan tanya user**.

---

*Dokumen ini disiapkan 2026-05-05. Versi 1.3 (RAM 2 GB, ADR 0006-0010, TASK.md workflow, decisions resolved).*
