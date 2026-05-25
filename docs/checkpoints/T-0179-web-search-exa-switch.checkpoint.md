# Checkpoint: T-0179 — Switch web_search backend Brave → Exa

- **Owner**: Claude Opus 4.7
- **Started**: 2026-05-25 18:50 WIB
- **Last updated**: 2026-05-25 19:00 WIB
- **Status**: 🟩 DONE
- **Phase**: AI assistant polish

## Done

- **`web-search.ts` rewrite** — Exa Search API (POST
  `https://api.exa.ai/search`) per
  https://exa.ai/docs/reference/search-api-guide-for-coding-agents.
  - Auth header changed: `x-api-key` (was `X-Subscription-Token`).
  - Request: JSON body with `query`, `type: 'auto'`, `numResults`,
    `contents: { highlights: true, summary: true }`. We request both
    highlights and a summary because Exa returns whichever it has;
    the snippet falls back to first highlight → first 600 chars of
    `text`. Hard cap 600 chars so a single result doesn't blow up the
    next model turn.
  - Response mapping: `results[].title/url/publishedDate/summary/
    highlights/text` → `WebSearchHit { title, url, snippet,
    publishedDate }`. Same `WebSearchOutput` contract, so the
    conversation runner needs no change.
  - Same 15s `AbortSignal.timeout`, same `not_configured /
    rate_limited / upstream_error` reasons.
- **Env var**: `EXA_SEARCH_API_KEY` (was `BRAVE_SEARCH_API_KEY`).
  `.env.example` updated with a fresh comment block + link to the
  Exa dashboard.
- **Registry description** updated so the model's tool list reads
  "Exa Search" not "Brave Search".
- **Tests**: 3 new in `tests/web-search.test.ts` (`vi.stubEnv` +
  `fetch` stub). Covers: `not_configured`, `429 → rate_limited`,
  successful response mapping with snippet preference order.

## Notes / decisions

- Kept the `WebSearchHit` schema additive only (added optional
  `publishedDate`). Existing call sites continue to compile.
- `type: 'auto'` per Exa's recommendation for coding agents — lets
  Exa pick between fast/instant/deep based on the query shape.
- Summary preferred over highlights because Exa's summary is
  paragraph-shaped, easier for the model to quote back to the user.
- No PII goes to Exa — only the user's query string. The caller
  already had to opt in at session level.
- The Brave → Exa swap is backend-only; the UI checkbox label
  ("Izinkan pencarian web") and the session column
  (`ai_chat_sessions.allow_web_search`) stay as-is.

## Verification

- `pnpm --filter @erp/services typecheck` PASS.
- `pnpm --filter @erp/services test` 592/592 PASS (+3 web-search).

## Backlog (carry-over to T-0180+)

- T-0180 Verify purchase-return module exists, add if missing.
- T-0181 Employee attendance-history page (self-service).
- T-0182 Shift schedule override per specific date.
- T-0183 Member-data page for management.
- T-0184 Helpdesk/ticketing + AI integration.
- T-0185 Internal courier shipment tracking (BinderByte).
