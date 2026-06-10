# Kartu Fase 2 — sapu keamanan (siap eksekusi)

> Bagian dari `docs/plans/MASTER-PLAN-S4-CLASS.md`. Baca §1 (kontrak eksekutor) dan §6.1 (prosedur baku sapuan) sebelum mengambil kartu.
> Kartu di file ini dipecah oleh Perencana (Claude Fable 5, 2026-06-10, T-0287) berdasarkan inventaris repo nyata. Bila ringkasan di master plan §6.2 berbeda sedikit dari kartu ini, kartu ini yang menang.
> Prosedur tiap kartu: (1) periksa SEMUA butir checklist, (2) tulis temuan ke `docs/audit/sweep-security-<area>-YYYY-MM-DD.md` dengan klasifikasi Critical/High/Medium/Low + bukti file:baris, (3) perbaiki Critical/High di kartu yang sama dengan test regresi merah-dulu-hijau-sesudah, (4) Medium/Low → backlog TASK.md, (5) `pnpm verify`.

---

### Kartu F2.1 — Sapu autentikasi & sesi
- **Effort**: M · **Dependensi**: F0.5
- **File yang diperiksa** (boleh diedit hanya untuk patch temuan):
  - `packages/services/src/auth/auth.server.ts` (better-auth: sesi 7 hari, cookie HttpOnly/SameSite=Lax, rateLimit window 60s max 20)
  - `packages/services/src/auth/password.ts` (bcryptjs cost 12 + verifikasi legacy argon2id)
  - `apps/web/app/api/auth/[...all]/route.ts` (loginAttempts: 5 gagal/15 menit, 20/jam)
  - `packages/db/schema/auth.ts` (tabel users, sessions, loginAttempts, apiTokens)
  - `apps/web/middleware.ts` (cek cookie `aroadri.session_token` / `__Secure-…`)
- **Checklist**:
  1. Cookie sesi production: `Secure` aktif? `SameSite=Lax` cukup untuk server actions? Verifikasi di response live (curl header `Set-Cookie`).
  2. Rotasi token sesi setelah login dan setelah ganti password (T-0176 mengklaim invalidasi sesi lain; buktikan dengan test).
  3. loginAttempts: apakah lockout bisa dilewati dengan mengganti casing email / spasi? Normalisasi input?
  4. Password policy: panjang minimum dan penolakan password umum ditegakkan di server (bukan hanya UI)?
  5. Reset password staf: token sekali pakai, kedaluwarsa, tidak bocor di log?
  6. OTP member (`packages/services/src/member/index.ts`): masa berlaku, sekali pakai, percobaan maksimal, dan TIDAK ada rate limit terpisah (temuan kandidat, lihat F2.8).
  7. Sesi multi-device: revoke di `/account` benar-benar menghapus row sessions?
- **Larangan khusus**: jangan menaikkan cost bcrypt tanpa mengukur dampak CPU (server 1 vCPU); jangan mengubah skema auth tanpa migrasi drizzle.
- **Bukti selesai**: file sweep terisi semua butir (✅/temuan); test regresi untuk tiap patch; `pnpm verify`.

### Kartu F2.2a — Generator test matriks otorisasi (route × role)
- **Effort**: M · **Dependensi**: F0.5
- **Tujuan**: test otomatis yang membaca `apps/web/lib/nav-access.ts` (`NAV_ACCESS`: mapping route → permission, satu-satunya sumber kebenaran) dan seed permission `packages/db/seed/iam.ts`, lalu menguji setiap route `(dash)` dengan sesi tiap role: role tanpa permission harus dapat redirect/403, dengan permission harus 200.
- **File yang boleh disentuh**: `packages/services/tests/authz-matrix.test.ts` (baru) atau `apps/web/tests/` mengikuti pola test yang ada; helper login test.
- **Langkah**: 1) enumerasi NAV_ACCESS; 2) buat user test per role di DB test; 3) request tiap route, assert status; 4) route yang tidak terdaftar di NAV_ACCESS = temuan (halaman tanpa gate).
- **Larangan khusus**: route yang gagal di-assert JANGAN ditambahkan ke daftar pengecualian; itu temuan, catat.
- **Bukti selesai**: test jalan di CI; daftar route tanpa gate masuk file sweep.

### Kartu F2.2b — Sapu IDOR & kebocoran lintas lokasi
- **Effort**: M · **Dependensi**: F2.2a
- **Checklist**:
  1. Server actions di `apps/web/app/(dash)/*/actions.ts`: semua memanggil `requirePermission`/`requirePermissionAtLocation` (`apps/web/lib/authz.ts`) SEBELUM logika? Grep actions tanpa pemanggilan itu → temuan.
  2. Akses by-ID (journals/[id], po/[id], employees/[id], dst.): apakah service memfilter `tenant_id` + `location_id` sesuai scope user, atau hanya `id`? Uji dengan user lokasi A membuka dokumen lokasi B.
  3. Endpoint print `apps/web/app/(print)/pos/print/receipt/[orderId]/page.tsx` (akses langsung DB, 7 import): ada cek sesi + scope?
  4. API upload privat `apps/web/app/api/uploads/[...key]/route.ts`: permission check per area dipertahankan?
  5. MCP tools: tool dengan `locationId` opsional — default-nya bocor semua lokasi?
- **Bukti selesai**: file sweep + test reproduksi per temuan + `pnpm verify`.

### Kartu F2.3 — Sapu injeksi (SQL mentah, XSS, formula CSV)
- **Effort**: M · **Dependensi**: F0.5
- **Fakta awal**: 62 file memakai `` sql` `` di packages; terbanyak `packages/services/src/pos/create-sale.ts` (8), `packages/services/src/accounting/close-center.ts` (6), `packages/services/src/pos/posting.ts` (3).
- **Checklist**:
  1. Audit SEMUA pemakaian `` sql` ``: nilai user masuk sebagai parameter binding, bukan interpolasi string? Khusus: JS `Date` di dalam raw sql tag dilarang (bug WIB yang pernah terjadi; pakai `gte/lte` Drizzle).
  2. XSS: konten CMS (pages/posts/banners/faqs) dirender dengan sanitasi? Cari `dangerouslySetInnerHTML` di apps/web + apps/site.
  3. Formula injection: semua ekspor CSV/XLSX (`packages/services/src/sales/exports.ts`, ekspor reporting aging/cogs/waste) meng-escape nilai berawalan `= + - @`?
  4. Path traversal pada parameter file (sudah ada guard di upload-storage; verifikasi juga `read_file` AI tool yang punya allowlist).
- **Bukti selesai**: tabel audit per file sql` di file sweep (62 baris, status aman/temuan); test regresi patch; `pnpm verify`.

### Kartu F2.4 — Sapu upload & storage
- **Effort**: S · **Dependensi**: F0.5
- **File**: `apps/web/app/api/uploads/route.ts`, `apps/web/app/api/uploads/[...key]/route.ts`, `apps/web/lib/upload-storage.ts`.
- **Checklist**: magic-bytes check konsisten semua area (bukan hanya imageOnly); batas ukuran per area; nama file disanitasi (tidak ada `..`/null byte); `UPLOAD_STORAGE_DIR` di luar webroot dan persisten (pelajaran T-0277); file privat tidak bisa diakses tanpa permission; PDF di-serve dengan `Content-Disposition` dan CSP yang benar (pelajaran T-0275/T-0276); tidak ada eksekusi file terupload (svg dengan script? sajikan sebagai attachment).
- **Bukti selesai**: file sweep + uji manual upload file jahat (svg-script, exe rename .png, nama `../x`) tertolak; `pnpm verify`.

### Kartu F2.5 — Sapu SSRF & integrasi keluar
- **Effort**: S · **Dependensi**: F0.5
- **File**: `packages/services/src/shared/binderbyte.ts`; `packages/services/src/ai/client.ts` (DeepSeek, base URL dari config DB); tool web-search Exa (cari `web-search.ts` di `packages/services/src/ai`, hasil T-0179); `packages/services/src/notification/email-transport.ts`; worker `isr-revalidate` (`apps/worker/src/jobs/`).
- **Checklist**: URL eksternal selalu host tetap (tidak menerima URL dari input user); timeout + abort di semua fetch; API key tidak ikut tercetak di error/log; base URL AI yang bisa diubah lewat UI/DB dibatasi allowlist host (kalau admin bisa menulis URL bebas = SSRF-by-config, klasifikasi Medium, patch dengan allowlist); respons upstream tidak diteruskan mentah ke user.
- **Bukti selesai**: file sweep; test timeout/allowlist; `pnpm verify`.

### Kartu F2.6 — Sapu rahasia & konfigurasi
- **Effort**: S · **Dependensi**: F0.6 (gitleaks sudah jalan)
- **Checklist**: `.env.example` lengkap dan tanpa nilai asli; hasil gitleaks CI bersih (termasuk riwayat — jalankan `gitleaks detect --log-opts="--all"` sekali, catat hasil); token MCP tersimpan hash SHA-256 (`apps/mcp/src/auth.ts`) dan raw token hanya tampil sekali saat mint; `PII_ENCRYPTION_KEY` wajib ada di production (fail-closed bila kosong? verifikasi `packages/services/src/security/pii.ts`); tidak ada secret di `cms_settings` (yang nilainya tampil di UI).
- **Bukti selesai**: file sweep + output gitleaks; `pnpm verify`.

### Kartu F2.7 — Sapu header, CSP, CORS, frame
- **Effort**: S · **Dependensi**: F0.5
- **File**: `apps/web/next.config.ts` (CSP, HSTS, X-Frame-Options), `apps/web/middleware.ts`, `apps/site/middleware.ts`, `apps/mcp/src/http-server.ts` (Hono; ada host-allowlist, TIDAK ada middleware CORS eksplisit).
- **Checklist**: CSP web tidak mengandung `unsafe-inline`/`unsafe-eval` yang tidak perlu; pengecualian frame untuk preview PDF SOP masih sempit (`frame-ancestors 'self'` hanya di route uploads); apps/site punya CSP sendiri (bukan hanya middleware locale); MCP: keputusan eksplisit soal CORS (API token-based tanpa cookie boleh tanpa CORS, tetapi tulis keputusannya di file sweep); HSTS konsisten ketiga app; verifikasi live dengan `curl -sI` ke ketiga domain dan tempel hasil.
- **Bukti selesai**: file sweep + output curl live; `pnpm verify`.

### Kartu F2.8 — Rate limiting permukaan yang belum terlindungi
- **Effort**: M · **Dependensi**: F0.5
- **Fakta awal (temuan kandidat dari inventaris)**: rate limit baru ada di login (better-auth + loginAttempts). TIDAK ditemukan di: OTP member (kirim + verifikasi), `/api/sync/pos`, endpoint MCP, AI chat.
- **Langkah**: 1) konfirmasi tiap permukaan dengan burst test lokal (skrip 50 request beruntun); 2) untuk yang tak terlindungi, tambahkan limiter sederhana berbasis DB/memori per-IP+per-identitas (tiru pola loginAttempts; JANGAN menambah dependensi Redis); 3) OTP member juga butuh cap per email per hari; 4) sync POS: limiter longgar (jangan sampai outbox offline sah tertolak — idempotency sudah menjaga duplikat).
- **Larangan khusus**: jangan memasang limiter yang bisa mengunci kasir saat sync normal; ambang didokumentasikan di file sweep.
- **Bukti selesai**: burst test sebelum (lolos semua) vs sesudah (429 setelah ambang) untuk tiap permukaan; test unit limiter; `pnpm verify`.

### Kartu F2.9 — PII & kripto (UU PDP) + log scrubbing yang yatim
- **Effort**: M · **Dependensi**: F0.5
- **Fakta awal (temuan kandidat TERKONFIRMASI)**: `packages/shared/src/security/log-scrub.ts` (scrubPii) dan `packages/shared/src/security/hmac.ts` TIDAK diimpor satu pun kode produksi (hanya test-nya sendiri), padahal T-0176 mengklaim keduanya terpasang. Artinya log produksi kemungkinan memuat PII polos dan inbound Naixer tidak diverifikasi HMAC.
- **Checklist**:
  1. Pasang `scrubPii`/`scrubPiiDeep` di titik logging transport: error handler server actions, logger MCP (`apps/mcp/src/server.ts`), worker job error, dan console error path produksi.
  2. Audit kolom terenkripsi: `employees` (KTP/NPWP via `packages/services/src/security/pii.ts` AES-256-GCM), `members` (phone/email). Cek kolom PII lain yang masih polos: rekening bank karyawan (payroll T-0246), alamat, `whistleblowerReports` identitas pelapor.
  3. HMAC: identifikasi endpoint inbound Naixer/eksternal; bila ada, pasang `validateInboundHmac`; bila tidak ada endpoint inbound, catat resmi di file sweep bahwa helper disimpan untuk masa depan (supaya temuan ini tertutup).
  4. Ekspor (XLSX payroll, audit log) dan backup: PII terenkripsi tidak ikut terdekripsi ke file tanpa permission khusus?
- **Bukti selesai**: grep membuktikan scrubPii terpasang di ≥3 transport; test scrub; daftar kolom PII + status enkripsi di file sweep; `pnpm verify`.

### Kartu F2.10 — Dependensi & rantai pasok
- **Effort**: S · **Dependensi**: F0.5
- **Langkah**: `pnpm audit --prod` + `gh api repos/{owner}/{repo}/dependabot/alerts?state=open` → nol high/critical; tinjau `pnpm.overrides` di package.json root (esbuild, hono, next, qs, tmp, uuid, dll): masih perlukah masing-masing? catat alasan per override di file sweep; pastikan lockfile frozen di CI (`--frozen-lockfile` sudah ada, verifikasi).
- **Bukti selesai**: output kedua perintah ditempel; file sweep berisi tabel override + alasan; `pnpm verify`.

### Kartu F2.11 — MCP & API token
- **Effort**: M · **Dependensi**: F0.5
- **File**: `apps/mcp/src/auth.ts` (hashToken SHA-256, format `aroadri_<env>_<base64url>`), `apps/mcp/src/server.ts` (verifyToken), `apps/mcp/src/tools/*.ts` (checkPermission via `can()`), UI mint token (settings).
- **Checklist**: SETIAP tool (68 terdaftar di `apps/mcp/src/tools/index.ts`) memanggil checkPermission dengan permission yang sama dengan UI padanannya — buat tabel tool→permission di file sweep, tandai tool tanpa cek; scope lokasi token ditegakkan; token kedaluwarsa & revoked ditolak (test); mutasi via MCP menulis audit_log setara UI (sampling 5 tool mutasi); brute-force token: respons 401 seragam + tidak ada timing leak (hash dulu baru lookup); error tool tidak membocorkan stack/SQL.
- **Bukti selesai**: tabel 68 tool × permission × audit di file sweep; test untuk tool yang diperbaiki; `pnpm verify`.

---

## Penutupan gerbang F2 (dikerjakan Perencana / sesi review)

1. Gabungkan semua `sweep-security-*` → `docs/audit/SECURITY-SWEEP-REPORT-2026-Q2.md`: tabel temuan, status, commit patch.
2. Nol Critical/High terbuka; `pnpm audit --prod` + Dependabot bersih.
3. Sapuan ulang cepat 11 area (satu sesi, sampling checklist tiap area). Temuan Critical/High baru → perbaiki → ulangi.
4. Update tabel §3 master plan: tanggal tutup + link laporan.
