# Checkpoint: T-0191 - Patch VPS pentest infra + AI lookup/OCR + UI cleanup

- **Owner**: Codex
- **Started**: 2026-05-27 05:49 WIB
- **Last updated**: 2026-05-27 06:09 WIB
- **Status**: IN_PROGRESS

## Goal

Menutup follow-up user:
- Patch hasil pentest VPS secara langsung via SSH, bukan hanya runbook.
- Buat AI assistant lebih tahan alias/fuzzy lookup untuk outlet dan produk.
- Perbaiki OCR upload struk agar provider 400 tidak menghentikan fallback OCR lokal.
- Hilangkan format qty seperti `0.000`.
- Tambah i18n untuk `scheduledJobs.aiActionDraftsSweeper.*`.
- Hapus sidebar duplikat.

Spec: SOURCE-OF-TRUTH §4-§6, SYSTEM-DESIGN §16, §25-§26, §37; pentest artifacts di `D:\KERJA\Aroadri Tea\pentest-aroadri`.

## Plan

1. [x] Baca AGENTS, SoT, SD, TASK, dan skill security fix.
2. [x] Validasi finding INF VPS yang masih reproduksi.
3. [x] Patch VPS Hestia/firewall/headers/default-host sesuai finding.
4. [x] Patch AI lookup/OCR fallback di repo dan test dengan kasus user.
5. [x] Patch UI qty/i18n/sidebar duplikat.
6. [x] Jalankan lint/typecheck/test/build lokal.
7. [ ] Commit/push, pull/build/reload VPS, smoke test.

## Done so far

- Branch kerja dibuat: `codex/t-0191-vps-ai-ui-fixes`.
- Pentest report dibaca, termasuk finding INF-001..INF-005 dan roadmap 24-48 jam.
- External advisory context dicek untuk HestiaCP web terminal: Tenable/Mercury ISS/Hestia CLI docs.
- VPS patched:
  - Hestia 8083 tidak lagi public; hanya allowlist `27.124.95.176/32` dan `182.2.50.27/32`.
  - FTP dan DNS public firewall rules dihapus; `vsftpd` disabled.
  - SSH password login dimatikan (`PasswordAuthentication no`, `PermitRootLogin prohibit-password`) dan key login diverifikasi masih OK.
  - Default IP vhost Host-header redirect diganti menjadi `421 Misdirected Request`.
  - MCP nginx SSL config ditambah HSTS + CSP.
- Repo patched:
  - `resolve_location` dan `get_product` sekarang melakukan token fallback untuk alias/non-contiguous words.
  - `ocr_receipt_struk` fallback ke OCR lokal ketika provider vision error/no-json/invalid-json/unreadable.
  - Qty UI memakai formatter yang memangkas trailing zero di daily summary, waste, variance, stock, dan opname.
  - `scheduledJobs.aiActionDraftsSweeper.*` ditambah ke ID/EN/ZH.
  - Item sidebar duplikat Promosi di bawah POS dihapus; Promosi tetap ada di Settings.
- Gambar real `D:\KERJA\Aroadri Tea\WhatsApp Image 2026-05-26 at 14.09.18.jpeg` dites di VPS dengan Tesseract 5.3.4. Output OCR noisy berhasil diparse menjadi tanggal `2026-05-26`, gross `230000`, transaksi `5`.

## Decisions

- Untuk VPS, patch harus dibuktikan dengan `curl`/port checks setelah konfigurasi berubah.
- Untuk OCR, provider vision error harus fallback ke OCR lokal jika attachment bisa dibaca, karena DeepSeek masih text-only/sering 400 untuk image payload.

## Open issues

- Mail ports tetap dibuka karena DNS publik menunjukkan MX `mail.aroadritea.com` dan ADR-0011 memakai Hestia SMTP.
- DNS service masih listening, tetapi port 53 public diblokir firewall karena authoritative DNS memakai Cloudflare NS.

## Next step

Commit dan push branch `codex/t-0191-vps-ai-ui-fixes`, lalu SSH ke VPS, `git pull`, `pnpm install --frozen-lockfile`, `pnpm --filter @erp/web build`, reload PM2, dan smoke test `https://erp.aroadritea.com`, `https://mcp.erp.aroadritea.com`, Host-header 421, security headers, serta port checks.

## Test status

- PASS: `pnpm --filter @erp/services test -- ai-lookup-tools.test.ts ocr-receipt.test.ts` (6 tests).
- PASS: `pnpm --filter @erp/services test` (609 tests).
- PASS: `pnpm --filter @erp/services typecheck`.
- PASS: `pnpm --filter @erp/web typecheck`.
- PASS: `pnpm --filter @erp/web build`.
- PASS: scoped `pnpm exec biome check` untuk file yang disentuh (0 errors, 38 existing warnings).
- WARN: full `pnpm lint` masih gagal karena lint debt lama di file lain (`account`, `bank-recon`, dll), bukan dari patch ini.
