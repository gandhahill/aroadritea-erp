# T-0188 — Production hotfix: AI image upload, helpdesk draft UX, natural ERP lookup, AI settings UI

## Status

DONE

## Owner

Codex

## Started

2026-05-26 15:05 WIB

## Scope

- Fix `ai.provider.error` on image upload by aligning DeepSeek usage with official text-only Chat Completion behavior and preventing unsupported `image_url` payloads from reaching the provider.
- Fix helpdesk list/detail Neon `malformed array literal` caused by raw `ANY($1)` with a string parameter.
- Fix AI helpdesk ticket confirmation card so draft cards appear immediately after tool execution and disappear/refresh after commit/cancel.
- Move non-secret AI runtime settings into UI/database while keeping secrets in env.
- Improve AI ERP tools so product/location names can be resolved from natural language before asking user follow-up questions.

## Evidence

- Production log: `select "id", "display_name" from "users" where "users"."id" = ANY(($1))` with param `01KS6V5J3HQY6SMSQY6CGTG699` fails as malformed PostgreSQL array literal.
- DeepSeek official Chat Completion docs do not document OpenAI-style `image_url` content parts; current client forwards image parts directly.
- User observed helpdesk draft card requires refresh and stays visible after successful commit.
- User observed AI asks for product SKU/location ID for natural input `input penjualan osmanthus fresh tea di plaza 1`.

## Done

- Replaced raw PostgreSQL `ANY($1)` user-name lookup in `packages/services/src/helpdesk/index.ts` with Drizzle `inArray`, fixing Neon malformed array literal errors on `/helpdesk` and `/helpdesk/[id]`.
- Prevented unsupported DeepSeek image payloads from reaching chat completion. Uploaded images are now represented as text attachment notes unless a future provider setting explicitly supports vision; OCR tool returns a structured `vision_not_supported` response instead of `ai.provider.error`.
- Added SSE streaming route for AI chat so provider reasoning/content/tool events appear without refresh. The UI updates the final server message snapshot on `done`.
- Fixed helpdesk draft UX: draft confirmation cards appear immediately after the AI tool call and re-check draft status on render, so committed/cancelled/expired drafts no longer keep active buttons.
- Moved non-secret AI runtime configuration into `/settings/ai-assistant` backed by `cms_settings`; `.env` now keeps only secrets such as `DEEPSEEK_API_KEY` and `EXA_SEARCH_API_KEY`.
- Added natural-language product/location resolution tools so prompts like "Osmanthus Fresh Tea di Plaza 1" resolve fuzzy names before asking for SKU/location IDs.
- Added regression tests for AI SSE streaming and image attachment payload safety.

## Verification

- PASS: `pnpm -w typecheck`
- PASS: `pnpm -w lint` (warnings remain non-blocking baseline warnings)
- PASS: `pnpm -w test` (shared 85 + services 602 = 687 tests)
- PASS: `pnpm --filter @erp/web build`

## Next step

Continue the broader first-prompt audit backlog only if new user feedback arrives; this hotfix is complete.
