# Checkpoint: T-0190 - Validasi AI tools DeepSeek + deploy VPS pentest patch

- **Owner**: Codex
- **Started**: 2026-05-26 23:43 WIB
- **Last updated**: 2026-05-27 00:14 WIB
- **Status**: IN_PROGRESS

## Goal

Menutup follow-up user setelah patch pentest:
- Buktikan masalah AI tools lewat tes nyata sebelum klaim selesai.
- Perbaiki copy "whistleblower" menjadi "whistleblowing system" pada surface user-facing.
- Pull, build, dan reload patch pentest di VPS lewat koneksi dari `C:\Users\ASUS\Desktop\connect_aroadri_erp.bat`.

Spec: AGENTS §5.8, SYSTEM-DESIGN §16, §25, §26, §37; ADR-0012 untuk runtime PM2/HestiaCP.

## Plan

1. [x] Reproduce `ocr_receipt_struk` dengan foto struk asli.
2. [x] Reproduce `web_search` saat key Exa kosong.
3. [x] Patch perilaku AI/OCR atau konfigurasi agar hasilnya tidak misleading.
4. [x] Ubah label user-facing "whistleblower" menjadi "whistleblowing system".
5. [x] Jalankan focused test/typecheck/build lokal.
6. [ ] Commit + push branch.
7. [ ] SSH VPS, pull branch/commit, build, migrate bila perlu, reload PM2, smoke test.

## Done so far

- Branch kerja dibuat: `codex/t-0190-ai-tool-vps-validation`.
- Reproduksi lokal:
  - `ocrReceiptStrukTool` dengan `D:/KERJA/Aroadri Tea/WhatsApp Image 2026-05-26 at 14.09.18.jpeg` dan `DEEPSEEK_API_KEY=test-key` menghasilkan `{"ok":false,"error":"vision_not_supported"}`.
  - `webSearchTool` dengan `EXA_SEARCH_API_KEY=''` menghasilkan `{"ok":false,"reason":"not_configured","hits":[]}`.
- Foto struk manual dibaca untuk baseline isi: Aroadri Tea Plaza Malioboro, Product Sales Report, cashier Kevin, start 2026-05-26 10:08:24, end 2026-05-26 14:07:11, total sales 5, amount received Rp230000.
- `web_search` sekarang memakai helper secret bersama yang membaca `EXA_SEARCH_API_KEY` dari environment atau `.env` fallback (`AROADRI_ENV_FILE` dapat mengarahkan file eksplisit), sehingga deploy PM2 tidak buntu bila key ada di file tapi belum masuk process env.
- `ocr_receipt_struk` sekarang mengonversi private upload AI milik user menjadi data URI internal untuk provider vision, mencoba fallback OCR lokal via `tesseract` saat provider tidak support vision, dan punya parser Product Sales Report lama yang teruji.
- Label dan docs user-facing diganti ke "Whistleblowing System"; route/permission/table code `whistleblower` tetap dipertahankan agar tidak perlu migrasi DB.
- Verifikasi lokal sudah hijau:
  - `pnpm -w lint` PASS (masih ada warning baseline).
  - `pnpm -w typecheck` PASS.
  - `pnpm -w test` PASS (690 tests total: shared 85, services 605).
  - `pnpm --filter @erp/web build`, `pnpm --filter @erp/site build`, `pnpm --filter @erp/mcp build`, `pnpm --filter @erp/worker build` PASS.

## Decisions

- Jangan klaim OCR/vision berhasil sebelum tool ERP sendiri diuji dengan gambar yang diberikan user.
- DeepSeek Chat Completion resmi masih text/tool schema; bila solusi butuh vision, harus berupa provider vision terpisah/konfigurasi eksplisit atau fallback OCR lokal yang teruji.

## Open issues

- Perlu cek secret/config VPS: `EXA_SEARCH_API_KEY` tersedia atau belum.
- Perlu cek apakah production akan deploy dari branch `codex/t-0190-ai-tool-vps-validation` atau tetap master. Karena patch pentest ada di branch T-0189, deploy harus memastikan commit T-0189 ikut terpasang.

## Next step

Commit + push branch `codex/t-0190-ai-tool-vps-validation`, lalu SSH VPS memakai detail dari `C:\Users\ASUS\Desktop\connect_aroadri_erp.bat`, pull branch itu, build, reload PM2, dan smoke test.

## Test status

- Reproduksi lokal: PASS (masalah terkonfirmasi).
- Focused tests: `pnpm --filter @erp/services exec vitest run tests/web-search.test.ts tests/ocr-receipt.test.ts` PASS (6 tests).
- Services typecheck: `pnpm --filter @erp/services typecheck` PASS.
- Workspace lint: `pnpm -w lint` PASS (854 warning baseline).
- Workspace typecheck: `pnpm -w typecheck` PASS.
- Workspace tests: `pnpm -w test` PASS (690 tests).
- Builds: `@erp/web`, `@erp/site`, `@erp/mcp`, `@erp/worker` PASS.
- VPS deploy: belum.
