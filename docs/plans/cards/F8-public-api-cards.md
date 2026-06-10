# Kartu Fase 8 — API publik pihak ketiga + dokumentasi Scalar

> Bagian dari `docs/plans/MASTER-PLAN-S4-CLASS.md`. Baca §1 (kontrak eksekutor) dulu. Dipecah Perencana 2026-06-10 (T-0288).
> **Catatan interpretasi (PENTING)**: permintaan user 2026-06-10 berbunyi "dokumentasi API menggunakan Scala". Perencana menafsirkan ini sebagai **Scalar** (scalar.com — UI dokumentasi API berbasis OpenAPI, punya integrasi resmi Hono `@scalar/hono-api-reference`), BUKAN bahasa pemrograman Scala: menulis layanan dokumentasi dengan Scala berarti menambah runtime JVM baru, melanggar ADR-0001 (stack TypeScript) dan batas server 2 GB (master plan §2.2). Bila Lintang ternyata bermaksud bahasa Scala → eksekutor kartu F8.1 WAJIB BLOCKED dan eskalasi, jangan lanjut.
> **Urutan eksekusi fase ini**: setelah gerbang F5, sebelum F6 (penutupan/pentest harus mencakup permukaan API baru ini).
> **Prinsip pengikat**: TIDAK ada proses runtime baru (RAM 2 GB) — API publik menumpang app Hono `apps/mcp` yang sudah berjalan di `mcp.erp.aroadritea.com`. Autentikasi memakai infrastruktur `api_tokens` yang ada (SHA-256, scope per permission); semua endpoint memanggil service + permission engine + audit yang sama dengan UI/MCP.

---

### Kartu F8.1 — ADR-0016: arsitektur API publik
- **Effort**: S · **Dependensi**: gerbang F5
- **Tujuan**: `docs/adr/0016-public-rest-api-scalar.md` memutuskan dan mendokumentasikan: (a) konfirmasi interpretasi Scalar (lihat catatan di atas — minta konfirmasi Lintang, BLOCKED sampai dijawab); (b) API REST versi `/api/v1` di `apps/mcp` (Hono), spec OpenAPI 3.1 digenerate dari kode via `@hono/zod-openapi` (skema Zod = sumber kebenaran tunggal); (c) auth Bearer `api_tokens` existing + scope = permission engine; (d) rate limit per token; (e) idempotency header wajib untuk mutasi; (f) format error seragam (kode stabil + pesan tanpa bocoran internal); (g) kebijakan versioning & deprecation; (h) docs UI Scalar di `/docs` (publik, read-only; spec tidak memuat secret); (i) ukuran dependensi baru dicek < batas §5.7 CLAUDE.md.
- **Bukti selesai**: ADR ter-commit (Proposed → Accepted setelah konfirmasi Lintang); update `docs/adr/README.md` + CLAUDE.md §3.1.

### Kartu F8.2 — Fondasi API v1 + 3 endpoint read pertama
- **Effort**: M · **Dependensi**: F8.1
- **Tujuan**: di `apps/mcp/src/api/v1/`: router `OpenAPIHono` + middleware rantai: auth Bearer (pakai `verifyToken` di `apps/mcp/src/auth.ts`) → resolusi permission (`can()`, pola sama dengan tools MCP) → rate limiter per token (pola limiter F2.8, tanpa Redis) → audit akses. Endpoint pertama (read-only, reuse service): `GET /api/v1/products` (filter+paginasi standar `page/pageSize/total`), `GET /api/v1/stock?locationId=`, `GET /api/v1/reports/daily-summary?date=`.
- **Larangan khusus**: endpoint TIDAK memanggil DB langsung — hanya `packages/services`; respons memakai skema Zod yang juga menjadi spec; paginasi wajib (tanpa endpoint dump-semua); permission yang dipakai = permission UI padanannya (jangan mencetak permission baru tanpa seed).
- **Bukti selesai**: test kontrak per endpoint (200 happy, 401 token salah, 403 tanpa permission, 429 burst); `GET /api/v1/openapi.json` valid (lint spec); `pnpm verify` + `pnpm --filter @erp/mcp build`.

### Kartu F8.3 — Endpoint read lanjutan
- **Effort**: M · **Dependensi**: F8.2
- **Tujuan**: melengkapi permukaan read yang berguna bagi pihak ketiga (akuntan eksternal, agregator, partner): `GET /journals` + `GET /journals/{id}`, `GET /invoices` + detail, `GET /purchase-orders` + detail, `GET /members/{id}/loyalty` (scope member), `GET /reports/{trial-balance|profit-loss|balance-sheet}` (parameter periode), ekspor XLSX laporan sebagai respons biner ber-`Content-Disposition`.
- **Larangan khusus**: PII mengikuti aturan F2.9 (member phone/email tidak terdekripsi tanpa permission spesifik); semua daftar berpaginasi; filter lokasi menghormati scope token.
- **Bukti selesai**: test kontrak per endpoint; spec ter-update otomatis; `pnpm verify`.

### Kartu F8.4 — Endpoint mutasi terpilih (idempoten + approval-aware)
- **Effort**: M · **Dependensi**: F8.2; F4.4 sudah jalan (gate aktif)
- **Tujuan**: mutasi yang aman untuk pihak ketiga, semua dengan header `Idempotency-Key` wajib (pakai `shared/idempotency.ts`): `POST /purchase-orders` (status draft — approval tetap di dalam ERP), `POST /complaints`, `POST /members` (registrasi partner program), `POST /journals` (draft saja, posting tetap lewat gate internal). Respons saat tertahan gate = `202` + status `pending_approval` (bukan error).
- **Larangan khusus**: DILARANG mengekspos endpoint yang mem-bypass approval gate atau memposting langsung dokumen finansial; mutasi tanpa Idempotency-Key → 400; semua mutasi menulis audit_log dengan penanda sumber `public_api`.
- **Bukti selesai**: test idempoten (2× kirim = 1 entitas), test gate (di atas ambang → 202 pending), audit row punya penanda sumber; `pnpm verify`.

### Kartu F8.5 — Dokumentasi Scalar + panduan onboarding pihak ketiga
- **Effort**: S · **Dependensi**: F8.2 (boleh paralel F8.3/F8.4)
- **Tujuan**: (a) route `/docs` di `apps/mcp` menyajikan Scalar UI (`@scalar/hono-api-reference`) membaca `/api/v1/openapi.json`; branding judul + deskripsi ID/EN; (b) `docs/runbook/public-api-onboarding.md`: cara minta token ke admin (UI Settings → API Token yang ada, T-0251), scope yang tersedia, contoh `curl` per endpoint inti, format error, kebijakan rate limit & idempotency, kebijakan versi; (c) tautan docs dari halaman Settings API Token.
- **Larangan khusus**: docs UI tidak boleh menyajikan endpoint internal non-v1 (tools MCP tidak ikut tampil); jangan menulis token contoh asli di dokumen.
- **Bukti selesai**: buka `/docs` live menampilkan seluruh endpoint v1 dengan skema; runbook selesai; `pnpm verify`.

### Kartu F8.6 — Hardening API + uji onboarding end-to-end
- **Effort**: M · **Dependensi**: F8.3, F8.4, F8.5
- **Tujuan**: (a) sapuan keamanan mini khusus API (checklist F2.1/F2.2/F2.3/F2.8/F2.11 diterapkan ke permukaan v1, hasil ke `docs/audit/sweep-security-public-api-YYYY-MM-DD.md`); (b) burst test rate limiter per token; (c) simulasi onboarding pihak ketiga buta: satu sesi agen HANYA bermodal `/docs` + token baru harus berhasil: baca produk → buat PO draft → lihat PO muncul di ERP — tanpa membaca kode; hambatan yang ditemui = bug dokumentasi, perbaiki; (d) daftarkan permukaan API ke scope pentest F6.4.
- **Bukti selesai**: file sweep API tanpa Critical/High; transkrip simulasi onboarding sukses; `pnpm verify`.

---

## Penutupan gerbang F8 (Perencana)
1. Spec OpenAPI valid + Scalar docs live di `mcp.erp.aroadritea.com/docs`.
2. Simulasi onboarding pihak ketiga sukses tanpa bantuan di luar docs.
3. Sapuan keamanan API bersih; rate limit terbukti; semua mutasi idempoten + teraudit.
4. `pnpm verify` + 12 skenario F3 hijau; RAM `pm2 status` pasca-deploy dicatat; catat tanggal tutup di master plan §3.
