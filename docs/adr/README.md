# Architecture Decision Records (ADR)

Folder ini berisi catatan keputusan arsitektur untuk sistem ERP Aroadri Tea. Setiap ADR menangkap **konteks**, **keputusan**, dan **konsekuensi** dari sebuah pilihan teknis penting.

## Mengapa ADR?

ADR adalah catatan tertulis dari sebuah keputusan arsitektur penting beserta alasannya. Ia melayani tiga kepentingan:

1. **Onboarding**: developer baru (manusia atau AI) dapat memahami "kenapa kita memilih X bukan Y" tanpa bertanya berulang.
2. **Audit jejak keputusan**: kalau di kemudian hari kita ingin mengubah keputusan, kita tahu apa konteks aslinya — sehingga kita tidak salah memutar kembali keputusan yang dibuat dengan informasi yang sama.
3. **Referensi sumber**: tiap ADR mencantumkan literatur / dokumen pendukung agar dapat ditelusuri.

## Format

Setiap ADR mengikuti struktur Michael Nygard:

```markdown
# ADR-NNNN: <Judul Singkat>

- **Status**: Proposed | Accepted | Deprecated | Superseded by ADR-XXXX
- **Tanggal**: YYYY-MM-DD
- **Pengambil keputusan**: <nama>
- **Konteks bisnis**: <ringkas, link ke SOURCE-OF-TRUTH §X>
- **Konteks teknis**: <ringkas, link ke SYSTEM-DESIGN §X>

## Konteks
Apa yang sedang terjadi? Apa masalahnya? Apa kendalanya?

## Keputusan
Apa yang kita pilih dan mengapa.

## Alternatif yang Dipertimbangkan
Opsi lain yang dievaluasi + alasan ditolak.

## Konsekuensi
- Positif: …
- Negatif / trade-off: …
- Neutral: …

## Referensi
- Tautan dokumen, RFC, paper, ADR lain.
```

## Cara Membuat ADR Baru

1. Buat file baru: `NNNN-judul-kebab.md` dengan nomor 4-digit berurutan (lihat ADR terakhir + 1).
2. Status awal: `Proposed`.
3. Diskusikan / review (di PR atau WhatsApp dengan PIC).
4. Setelah disetujui: ubah status ke `Accepted` dan commit ke `main`.
5. Update tabel index di file ini.
6. Bila kelak keputusan ini di-superseded: jangan hapus ADR lama; tandai `Superseded by ADR-XXXX` dan referensikan ADR penggantinya.

## Index ADR

| # | Judul | Status | Tanggal | Topik |
|---|-------|--------|---------|-------|
| [0001](0001-stack-choice.md) | Pilihan Stack Teknologi | Accepted | 2026-05-05 | Next.js + Drizzle + Postgres managed; bukan Odoo/ERPNext |
| [0002](0002-monorepo-and-app-split.md) | Monorepo + App Split (site / web / mcp / worker) | Accepted | 2026-05-05 | Pemisahan public website dan ERP berdasar audiens & domain |
| [0003](0003-public-website-cms-architecture.md) | Arsitektur Public Website + CMS (JAMstack ISR) | Accepted | 2026-05-05 | Custom CMS internal, ISR + Cloudflare CDN |
| [0004](0004-member-registration-and-auth.md) | Registrasi & Otentikasi Member Online | Accepted | 2026-05-05 | OTP email, schema sesi terpisah dari ERP staff |
| [0005](0005-build-vs-modify-existing-erp.md) | Build dari Nol vs Modifikasi ERP Open Source | Accepted | 2026-05-05 | Bangun custom; Odoo/ERPNext tidak memenuhi constraint RAM 2 GB |
| [0006](0006-design-system-anti-generic.md) | Design System Anti-Generic (UI Aroadri) | Accepted | 2026-05-05 | Token brand + override shadcn/ui; lint rule untuk hindari look generic AI |
| [0007](0007-naixer-qr-integration.md) | Integrasi POS ↔ KDS Naixer via QR Code | Accepted | 2026-05-05 | QR-only (tanpa API); strategy pluggable dash/pipe; mapping master di DB |
| [0008](0008-pos-demo-mode-client-side.md) | POS Demo / Training Mode (IndexedDB Sandbox) | Accepted | 2026-05-05 | Sandbox client-side; tidak pernah sync ke server; QR demo prefix `DEMO-` |
| [0009](0009-resilience-and-auto-recovery.md) | Resilience & Auto-Recovery | Accepted | 2026-05-05 | PWA offline POS + process auto-restart + healthcheck + idempotency; runtime production lihat ADR-0012 |
| [0010](0010-ppn-engine-opt-in.md) | PPN Engine — Opt-In | Accepted | 2026-05-05 | PB1 default, PPN keluaran default off untuk retail F&B; engine siap aktivasi B2B kelak via `tax_rules` |
| [0011](0011-hestiacp-smtp-transactional-email.md) | HestiaCP SMTP Untuk Email Transaksional | Accepted | 2026-05-13 | Email otomatis via mailbox HestiaCP SMTP; bukan Resend/SES sebagai default |
| [0012](0012-pm2-hestiacp-production-runtime.md) | PM2 + HestiaCP Untuk Runtime Production VPS | Accepted | 2026-05-14 | Runtime production VPS memakai PM2, bukan Docker Compose |
| [0013](0013-attendance-face-verification.md) | Attendance Face Verification | Accepted | 2026-06-02 | Inline enrollment di halaman check-in, template wajah terenkripsi, tanpa foto mentah rutin |
| [0015](0015-native-packaging-silent-printing.md) | Native Packaging (Tauri 2) + Silent Printing ESC/POS | Proposed | 2026-06-10 | Shell Tauri 2 (Android+Windows) bungkus POS; builder ESC/POS + adapter transport BT/USB; konfig printer di DB |
| [0016](0016-sak-ep-and-tax-compliance-baseline.md) | SAK EP and Tax Compliance Baseline | Accepted | 2026-06-10 | SAK EP menggantikan ETAP, CALK wajib, PPh Final UMKM dipisah dari PPh 25, PPN efektif 11% dijelaskan |
| [0017](0017-public-rest-api-scalar.md) | Public REST API (`/api/v1`) + Scalar Docs | Accepted | 2026-06-10 | REST publik di `apps/mcp` (Hono), auth `api_tokens` + permission engine, rate limit per token, spec OpenAPI 3.1 di kode, Scalar UI via CDN (hindari peer zod v3) |
| [0018](0018-odoo-like-fnb-erp-platform.md) | Odoo-Like FnB ERP Platform | Accepted | 2026-06-10 | Target fitur dan fleksibilitas setara Odoo, tetap FnB-first; extensibility lewat platform services DB-driven yang ringan dan diaudit |
| [0019](0019-modifier-group-role.md) | `groupRole` Column on `product_modifier_groups` | Accepted | 2026-06-13 | Kolom `group_role` (`sugar\|ice\|topping\|size\|cup\|other\|custom`) di `product_modifier_groups`; kanonikalisasi `modifierJson` sebagai array `ModifierSelection[]` dikonsumsi picker/KDS/label/Naixer QR |

> Tabel di atas wajib diperbarui setiap kali ADR baru dibuat atau status berubah. Index ini di-render di `CLAUDE.md` sebagai daftar pengingat.

## Kapan Membutuhkan ADR?

Tulis ADR untuk keputusan yang:
- Mempengaruhi >1 modul, atau
- Mengubah cara penyimpanan data, atau
- Menambah/mengganti dependency utama (framework, ORM, auth library), atau
- Mempengaruhi deployment / infrastructure, atau
- Mempengaruhi pendekatan keamanan / compliance, atau
- Sulit dibalik (lock-in vendor, perubahan skema massal).

Tidak perlu ADR untuk:
- Pilihan utility kecil (mis. library helper).
- Refactor internal modul tanpa kontrak API berubah.
- Bug fix.
- Penyesuaian copy / i18n.
