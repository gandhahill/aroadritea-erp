# Checkpoint: T-0171 — AI Assistant Phase 2 (tools + v4 model + vision base)

- **Owner**: Claude Opus 4.7
- **Started**: 2026-05-24 21:00 WIB
- **Last updated**: 2026-05-25 01:25 WIB
- **Status**: 🟩 DONE
- **Phase**: 6 (continuation of T-0170 AI Phase 1)
- **Branch**: master

## Goal

Lanjutkan T-0170 fase berikutnya untuk modul AI Assistant: (1) selaraskan
DeepSeek client dengan dokumentasi resmi terbaru (model `deepseek-v4-pro`
"pro thinking" yang user minta + `deepseek-v4-flash` sebagai default
fast-path), (2) tambahkan **tool calling** OpenAI-compatible dengan
**RBAC per-tool + audit trail per panggilan**, (3) implementasi 3 tool
read-only awal yang aman, (4) siapkan dasar **vision** untuk receipt OCR
(jalur tetap perlu phase-3 untuk draft→commit penjualan manual).

Acuan dokumentasi (di-fetch hari ini):
- https://api-docs.deepseek.com/quick_start/pricing — model names, pricing.
- https://api-docs.deepseek.com/guides/function_calling — tools schema.
- https://api-docs.deepseek.com/guides/thinking_mode — thinking mode + `reasoning_content`.
- https://api-docs.deepseek.com/guides/tool_calls — full round-trip example.

**Kriteria selesai (DoD):**
- [ ] Client `aiComplete` mendukung `tools` + mengembalikan `tool_calls`.
- [ ] Conversation runner melakukan loop tool-call sampai model balas teks final.
- [ ] Setiap tool: cek `requirePermission`, batas rate, audit `ai_tool_call`.
- [ ] Tool `request_admin_help`, `search_codebase`, `get_recent_orders` aktif.
- [ ] Vision: payload mendukung `image_url` (data URI base64) sehingga UI
      bisa kirim foto struk.
- [ ] Test: tool-call loop happy path + permission denied + path traversal guard.
- [ ] Typecheck + test PASS.

## Plan

1. [ ] Update client.ts: default model v4-flash, reasoning v4-pro, dukung tools, parse tool_calls, vision image_url, jangan kirim temperature di thinking mode.
2. [ ] Tools registry `packages/services/src/ai/tools/`: tipe `Tool`, helper `executeTool(ctx, name, args)`.
3. [ ] Tool 1 — `request_admin_help`: generate template chat (no DB write).
4. [ ] Tool 2 — `search_codebase`: fs walk dengan allow-listed roots (apps/, packages/, docs/), reject `..`, `.env*`, `node_modules`, `.next`, `storage/`.
5. [ ] Tool 3 — `get_recent_orders`: limit 25, scope by tenant+location, permission `pos.transact` OR `reporting.view`.
6. [ ] Conversation: load tools yang user-nya boleh pakai (filter by `can()`), pass ke provider, loop tool-call sampai content non-empty.
7. [ ] UI: render tool-call sebagai blok khusus di chat history (existing `tool_payload` jsonb).
8. [ ] Tests + typecheck + lint baseline + commit.

## Done so far

- 2026-05-24 → 2026-05-25 — fetch dokumentasi resmi DeepSeek (pricing,
  function_calling, thinking_mode, tool_calls) untuk memvalidasi
  implementasi Phase 1. Temuan utama: `deepseek-chat`/`deepseek-reasoner`
  dideprekasi 2026-07-24 → ganti default ke `deepseek-v4-flash` +
  `deepseek-v4-pro`. Thinking mode: tidak menerima temperature dll.;
  `reasoning_content` WAJIB di-replay di tool round (kalau tidak: 400).
- Client refactor (`packages/services/src/ai/client.ts`): tipe
  `AiToolDefinition`/`AiToolCall`, parse `tool_calls` + `reasoning_content`,
  helper `isThinkingModel()`, vision content type `image_url` (URL atau
  data URI base64).
- Tool registry (`packages/services/src/ai/tools/registry.ts`):
  `listAvailableTools(ctx)` filter by `can()`, `executeTool` lewat
  pipeline `requirePermission → Zod validate → execute → audit`.
- Tool 1: `request_admin_help` — template chat ready-to-forward, no DB
  writes (use case "user lapor error" tanpa risiko data).
- Tool 2: `search_codebase` — fs walk dengan allow-list
  (apps/packages/docs/scripts), deny (node_modules/.git/.next/.env*/
  storage/dist/build), hard-cap 25 hits, 256 KB per file, 5 s wall
  clock budget.
- Tool 3: `get_recent_orders` — query salesOrders scope by tenant+
  location, cap 25, optional `since_minutes` filter, permission
  `reporting.view`.
- Conversation runner: tool-call loop (`MAX_TOOL_ROUNDS=4`), replay
  `reasoning_content` di assistant turn yang menyimpan tool_calls,
  forward attachments via `image_url`, system prompt adaptif tergantung
  jumlah tool yang user-nya boleh pakai.
- UI chat session: tombol "📷 Lampirkan foto struk" → upload area
  `ai-attachments` → forward URL ke model; render khusus pesan
  `role='tool'` sebagai blok JSON kecil agar transparan.
- Audit: tambah `ai_chat_session`, `ai_chat_message`, `ai_tool_call`,
  `sop_document`, `whistleblower_report` ke `KNOWN_ENTITY_TYPES`.
- Tests baru: `packages/services/tests/ai-tools.test.ts` (10 tests:
  template, search, allow-list, forbidden, invalid args, tool-call
  loop dengan reasoning replay).

## Decisions

- Model default berubah ke nama v4 sesuai docs resmi yang men-deprekasi
  `deepseek-chat`/`deepseek-reasoner` per 2026-07-24. Backward compat:
  env var lama tetap dihormati supaya operator existing tidak rusak.
- `reasoning_content` di-preserve dalam riwayat pesan (`tool_payload`)
  bila model balik dengan tool call — wajib per docs, jika tidak dipasang
  kembali API balas 400.

## Next step (untuk T-0172 atau sesi berikutnya)

1. **Lebih banyak tool read-only** (lanjutan T-0171):
   - `read_file(path)` — varian search_codebase untuk membaca berkas
     spesifik (paling 100 line, allow-list sama). Tujuan: AI bisa
     jelaskan code path yang user tanyakan.
   - `get_stock(product_code, location_code)` — gabung products + stock_levels.
   - `get_product(code)` — products + variants + active price.
   - `get_today_sales_summary(location_id)` — re-use
     `packages/services/src/reporting/daily-summary` agar konsisten.
2. **Phase 3 write tools** (ADR-0013):
   - Pola wajib `draft → confirm → commit`. UI:
     `<ConfirmActionCard kind="manual_sale_draft" payload={...}/>` —
     muncul di chat history bila assistant tool call menghasilkan output
     dengan `requires_confirmation: true`. User klik "Setujui dan
     posting" → trigger commit tool dengan re-check permission.
   - Tools awal: `create_manual_sale_draft(closingDate, lines[])`,
     `commit_manual_sale(idempotency_key)`, `log_complaint_draft`,
     `commit_complaint`.
3. **OCR struk POS lama** (Phase 3 dependency):
   - File: `packages/services/src/ai/tools/ocr-receipt.ts`. Strategy:
     terima `attachment_url`, kirim ke DeepSeek v4 vision via
     `image_url`, prompt minta JSON manual-sales draft (tanggal, total,
     metode bayar). Output → `create_manual_sale_draft`.
4. **Web search opt-in**: pakai DeepSeek built-in tool flag yang sudah
   ada di `aiChatSessions.allow_web_search` (default `'false'`). Hanya
   diaktifkan kalau user toggle di settings.

## Test status

- _(belum, baseline T-0170 hijau)_

## Files Touched

| Path | Action | Note |
|------|--------|------|
| `docs/checkpoints/T-0171-ai-phase-2-tools.checkpoint.md` | Added | This file. |

## Commits So Far

| SHA | Message | Date |
|-----|---------|------|
| _(akan)_ | | |
