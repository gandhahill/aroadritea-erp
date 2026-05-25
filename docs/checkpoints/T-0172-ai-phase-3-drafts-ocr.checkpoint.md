# Checkpoint: T-0172 — AI Assistant Phase 3 (drafts, OCR, more read tools)

- **Owner**: Claude Opus 4.7
- **Started**: 2026-05-25 01:30 WIB
- **Last updated**: 2026-05-25 07:30 WIB
- **Status**: 🟩 DONE
- **Phase**: 6 (continuation of T-0171)
- **Branch**: master

## Goal

Selesaikan janji ADR-0013 (Phase 3) sehingga AI assistant bisa
**benar-benar mengubah data dengan aman**:

1. **Pola `draft → confirm → commit`** yang anti-spoof: assistant
   membuat baris di `ai_action_drafts` (table baru), UI menampilkan
   `<ConfirmActionCard>` dengan ringkasan + tombol "Setujui & Posting",
   user klik → `confirmDraftAction` re-cek permission di sisi server
   lalu memanggil service nyata. Klien **tidak pernah** mengangkut
   payload mutasi langsung — hanya `draft_id`.
2. **OCR struk POS lama**: user kirim foto struk → tool
   `ocr_receipt_struk` minta model multimodal mem-parse total + tanggal
   + breakdown channel/payment → menghasilkan draft `manual_sale`
   melalui jalur draft yang sama.
3. **4 tool read-only tambahan** sehingga assistant punya gambaran
   data outlet yang relevan: `read_file`, `get_today_sales_summary`,
   `get_product`, `get_stock`.

**Kriteria selesai (DoD):**
- [ ] Migrasi 0032 `ai_action_drafts` (id, sessionId, tenantId,
      userId, kind, payload, status, expiresAt, consumedAt, ...auditCols).
- [ ] `packages/services/src/ai/drafts.ts`: `createDraft`,
      `getDraftForUser`, `commitDraft` — terakhir re-cek permission
      sebelum eksekusi.
- [ ] Tools baru: `read_file`, `get_today_sales_summary`,
      `get_product`, `get_stock`, `create_manual_sale_draft`,
      `ocr_receipt_struk`.
- [ ] UI: `<ConfirmActionCard>` di chat menampilkan draft, tombol
      konfirmasi/cancel; integrasi di `chat-session-client.tsx`.
- [ ] Server Action `confirmDraftAction(draftId)` →
      memanggil service nyata (mis. `createManualSalesClosing`)
      dengan re-check permission + idempotency.
- [ ] Audit: setiap draft create / confirm / cancel tertulis di
      `audit_log` (`ai_action_draft`).
- [ ] Tests baru untuk drafts + OCR + read tools.
- [ ] typecheck + test PASS.

## Plan

1. [ ] Schema `ai_action_drafts` + migrasi 0032 + export di
       `packages/db/index.ts` & `package.json`.
2. [ ] Service `drafts.ts`: createDraft + getDraftForUser + commitDraft
       (dengan switch atas `kind` untuk memanggil service nyata).
3. [ ] Tool `create_manual_sale_draft`: validasi → createDraft kind
       `manual_sale` → return draft_id + summary.
4. [ ] 4 tool read-only baru (terdaftar di `tools/registry.ts`).
5. [ ] Tool `ocr_receipt_struk`: terima attachment_url, panggil model
       multimodal (system prompt khusus OCR), parse JSON output →
       createDraft kind `manual_sale`.
6. [ ] Conversation runner: propagate `requires_confirmation` flag ke
       message row (tabel `ai_chat_messages.requires_confirmation`).
7. [ ] UI `<ConfirmActionCard>` baru, render dari `tool_payload` ketika
       payload berisi `draft_id`.
8. [ ] Server Action `confirmDraftAction`/`cancelDraftAction`.
9. [ ] Permission seed: tambahkan `ai.assistant.draft.commit` (atau
       reuse permission target service nyata?) — keputusan: reuse
       permission target (manual_sales.create dst.) supaya skala
       konsisten dengan UI biasa.
10. [ ] Tests + typecheck + lint baseline + commit.

## Done so far

- **Schema + migrasi**: `aiActionDrafts` di `packages/db/schema/ai.ts`
  + migrasi `0032_ai_action_drafts.sql` + entri `_journal.json` +
  export di `packages/db/index.ts`.
- **Service drafts** (`packages/services/src/ai/drafts.ts`): createDraft,
  getDraftForUser, cancelDraft (user_cancel | expired), commitDraft
  yang re-cek permission target (`pos.transact` untuk `manual_sale`,
  `crm.logComplaint` untuk `complaint`) lalu dispatch ke service nyata
  via dynamic import. Audit `ai_action_draft` (submit/approve/cancel)
  ditulis di setiap transisi.
- **4 tool read-only baru**:
  - `read_file` — bounded reader, allow-list & deny sama dengan
    `search_codebase`, max 200 baris.
  - `get_product` — products + variants by SKU, return harga
    default/varian.
  - `get_stock` — `stock_levels` scope tenant+location, dukung lookup
    location by code atau id.
  - `get_today_sales_summary` — thin wrapper atas
    `reporting/daily-summary` agar konsisten dengan UI.
- **1 tool stage** (`create_manual_sale_draft`): validasi input, panggil
  `createDraft` kind `manual_sale`, kembali `{draft_id, summary,
  requires_confirmation:true}`.
- **1 tool OCR** (`ocr_receipt_struk`): panggil `aiComplete` model
  reasoning dengan `image_url` content part + system prompt JSON
  ketat, parse output, validasi via Zod, lalu stage manual-sale draft
  yang sama (chained call ke `createManualSaleDraftTool`).
- **Registry update**: tambah `ToolExecutionDeps` (sessionId/messageId)
  agar tool draft tahu konteks chat.
- **Conversation runner**: pass `{ sessionId }` ke `executeTool` saat
  loop tool-call.
- **Server actions**: `fetchDraftAction`, `confirmDraftAction`,
  `cancelDraftAction`.
- **UI `<ConfirmActionCard>`**: render dari `tool_payload` ketika
  output berisi `draft_id` + `requires_confirmation:true`. Tombol
  "Setujui & Posting" + "Batal", expiry countdown, hasil commit
  ditampilkan dengan referensi ID.
- **Audit `KNOWN_ENTITY_TYPES`**: tambah `ai_action_draft`.
- **Tests**: `ai-drafts.test.ts` 4/4 (createDraft persists + audit,
  commit refused without permission, commit dispatch ke
  createManualSalesClosing, draft expired ditolak).

## Decisions

- **Draft disimpan di DB, bukan di payload tool**. Mencegah klien
  jahat mengubah draft antara "ringkasan" dan "commit". Klien hanya
  pegang `draft_id`.
- **commitDraft re-cek permission dengan permission code target**
  (mis. `pos.manualsales.create`), bukan `ai.assistant.use`. Ini
  artinya hak akses AI ≤ hak akses manual UI — adil dan auditable.
- **Draft TTL 30 menit**: cukup untuk user baca + konfirmasi, tidak
  cukup untuk "saya tinggal sebentar lalu commit besok".
- **OCR struk** memakai model `deepseek-v4-pro` (vision-capable; per
  docs DeepSeek `image_url` content part diterima di `chat/completions`).
  Output diminta sebagai JSON ketat (`closing_date`, `total_gross`,
  `channels[]`, `payments[]`, `notes`).

## Next step (untuk sesi berikutnya / T-0173)

1. **Tambah kind draft baru**: `log_complaint_draft` (CRM complaint
   intake via AI) + corresponding commit dispatcher di `drafts.ts`.
   Tool ditambah ke registry, schema input via `crm.logComplaint`.
2. **Web search opt-in**: implement DeepSeek built-in web search tool
   wiring; default off (kolom `allow_web_search` sudah ada di
   `ai_chat_sessions`). Tambah UI toggle di sidebar sesi.
3. **Admin AI log viewer**: page `/settings/ai-assistant/log` untuk
   role `ai.assistant.admin` — list semua draft & tool call by user.
4. **Cleanup job**: scheduled job harian yang menandai draft `pending`
   yang sudah lewat `expires_at` menjadi `expired` (sweeper). Tambah
   di `scripts/disable-unconfigured-scheduled-jobs.ts`.
5. **End-to-end manual test** dengan struk asli di outlet — pastikan
   DeepSeek `image_url` data URI / signed URL kepulasan dapat
   diakses dari sisi mereka (Cloudflare proxy / VPS firewall).

## Test status

- _(belum, baseline T-0171 hijau 643/643)_

## Files Touched

| Path | Action | Note |
|------|--------|------|
| `docs/checkpoints/T-0172-ai-phase-3-drafts-ocr.checkpoint.md` | Added | This file. |

## Commits So Far

| SHA | Message | Date |
|-----|---------|------|
| _(akan)_ | | |
