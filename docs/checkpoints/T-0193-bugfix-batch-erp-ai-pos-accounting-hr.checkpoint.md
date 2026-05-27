# T-0193 — Patch ERP Bug Batch

## Status

🟩 DONE

## Owner

Codex

## Started

2026-05-27 10:32 WIB

## Scope

Patch user-reported production bugs:

- BUG #7: Petty cash "Buka kas kecil" server render error.
- BUG #4: Product variant add form fails with unhelpful `inventory.variant.validationFailed`.
- BUG #5: Employee detail lacks edit route/button and shows encrypted PII.
- BUG #15: POS order history cannot infer active POS shift location.
- BUG #1: COA table row click does not load account into edit form.
- BUG #9: POS payment field shows duplicated `Rp`.
- BUG #11: Dashboard greeting uses email instead of user name.
- Journal location displays UUID.
- AI OCR tool still returns execution failure.
- AI chat attachments are not visible in conversation UI.

## Context

- Branch: `codex/t-0191-vps-ai-ui-fixes`.
- Existing unrelated dirty file: `.antigravitycli/09990fdd-3b9f-4914-9549-6da3a681286e.json`; leave untouched.
- Must preserve i18n parity (`id`, `en`, `zh`) for any UI strings.
- Must preserve audit trails for state-changing actions.

## Progress

- Created task/checkpoint.
- Patched petty cash Server Actions to return serializable action results for business errors; UI now renders translated errors instead of surfacing production Server Component crash.
- Fixed inventory variant creation by mirroring the submitted variant name across ID/EN/ZH, preserving failed form values, and showing field-level validation errors.
- Added HR employee edit route/button, reuse of employee form in edit mode, and safe PII decryption that never displays raw `enc:v1:*` ciphertext when the key cannot decrypt.
- Fixed POS order history location resolution by using the cashier's latest open shift before falling back to session/default store.
- Fixed COA table row click to dispatch the selected account into the edit form.
- Fixed duplicated `Rp` in POS payment placeholders.
- Fixed dashboard greeting to prefer staff display name from session/DB before falling back to generic user text.
- Fixed journal list/detail location display to show code/name labels instead of UUIDs.
- Patched OCR tool to return structured `location_required` / `draft_stage_failed:*` results instead of generic `ai.tool.executionFailed` after successful extraction.
- Patched AI chat attachment metadata/rendering so uploaded images/files remain visible in user messages.
- Confirmed previous sweeps: Scheduled Jobs sweeper label i18n exists and UI resolves DB label keys; quantity helper already strips trailing `.000`; Whistleblowing System copy remains user-facing while route/table names stay stable.

## Verification

- PASS: `pnpm --filter @erp/services typecheck`
- PASS: `pnpm --filter @erp/web typecheck`
- PASS: scoped `pnpm exec biome check ...` on touched files (exit 0; existing warnings remain in COA/HR service files).
- PASS: `pnpm --filter @erp/services test tests/ocr-receipt.test.ts tests/pos.test.ts tests/inventory-products.test.ts` (83 tests; inventory-products glob absent, Vitest ran matching OCR/POS files).
- PASS: `pnpm --filter @erp/services test` (42 files, 611 tests).
- PASS: `pnpm --filter @erp/web build`
- PASS: provided receipt image opened locally: `D:\KERJA\Aroadri Tea\WhatsApp Image 2026-05-26 at 14.09.18.jpeg`; visible values are Plaza Malioboro, `2026-05-26`, `Total sales: 5`, `Amount Received: Rp230000`.
- PASS: parser smoke with text transcribed from that image returned `sales_date=2026-05-26`, `gross_sales=230000`, `transaction_count=5`.
- PASS: commit `54b81ed` pushed to `origin/codex/t-0191-vps-ai-ui-fixes`.
- PASS: VPS already has `/usr/bin/tesseract` 5.3.4.
- PASS: VPS `git pull --ff-only origin codex/t-0191-vps-ai-ui-fixes`.
- PASS: VPS `pnpm --filter @erp/web build`.
- PASS: VPS `pm2 reload aroadri-web`, `aroadri-mcp`, `aroadri-worker`; all online.
- PASS: VPS local health: web `127.0.0.1:3000/api/healthz`, site `127.0.0.1:3001/api/healthz`, MCP `127.0.0.1:3002/healthz`.
- PASS: public health: `https://erp.aroadritea.com/api/healthz`.
- PASS: VPS OCR runtime on the provided real image via Tesseract + service parser returned `sales_date=2026-05-26`, `gross_sales=230000`, `transaction_count=5`.

## Next step

No pending next step for T-0193. If new UI regressions are found, open a new task/checkpoint with the affected module and exact reproduction path.
