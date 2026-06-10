# Checkpoint: T-0293 - Public REST API /api/v1 + Scalar docs

- **Owner**: Claude Opus 4.8
- **Started**: 2026-06-10 23:05 WIB
- **Last updated**: 2026-06-10 23:20 WIB
- **Status**: DONE
- **Phase**: F8 (brought forward from after-F5 at user request)
- **Branch**: `master`

## Goal

User request #4 (2026-06-10): "dokumentasi API komprehensif agar dapat digunakan
pihak ketiga, menggunakan Scala". Clarified via AskUserQuestion → **"Scalar —
kerjakan sekarang"**. Build a third-party-usable public REST API with live
Scalar docs, now, on the existing apps/mcp Hono server.

## Done

- **ADR-0017** (`docs/adr/0017-public-rest-api-scalar.md`, Accepted): public REST
  `/api/v1` on apps/mcp; Bearer `api_tokens`; permission engine; rate limit;
  uniform errors; audit `source=public_api`; OpenAPI 3.1 in code; Scalar at
  `/docs`. Documents the deviation from the F8 card (no `@hono/zod-openapi` /
  `@scalar/hono-api-reference` — avoids zod v3 peer; spec in code + Scalar CDN).
- **`apps/mcp/src/api/v1/index.ts`**: Hono sub-app. Middleware chain CORS →
  Bearer auth (`verifyToken`) → per-token fixed-window rate limit (default 120/min,
  env `PUBLIC_API_RATE_LIMIT`) → handler → fire-and-forget audit. Uniform
  `{error:{code,message}}` envelope. bigint→string replacer on all responses.
  Routes (read-only, service-backed, paginated):
  - `GET /products` (perm `inventory.view`) → `listProducts`
  - `GET /stock?locationId=` (perm `inventory.view` location-scoped) → stockLevels
  - `GET /reports/daily-summary?locationId=&date=` (perm `reporting.view`) → `getDailySummary`
- **`apps/mcp/src/api/v1/openapi-document.ts`**: hand-authored OpenAPI 3.1 doc.
- **`apps/mcp/src/api/docs.ts`**: Scalar reference page (CDN embed) + relaxed CSP.
- **`apps/mcp/src/http-server.ts`**: mounted `/api/v1`; public `/api/v1/openapi.json`
  + `/docs` (registered before the mount so they stay unauthenticated).
- **Runbook** `docs/runbook/public-api-onboarding.md`: base URL, token issuance,
  auth, endpoints, error codes, rate limit, versioning, roadmap.
- Updated `docs/adr/README.md` (ADR-0017) and the F8 card status header.

## Decisions

- Spec defined in code + Scalar via CDN (no new npm dep) to dodge the
  `@hono/zod-openapi` zod-v3 peer conflict (workspace is zod v4) and keep
  node_modules small (CLAUDE.md §5.7). Revisit if endpoint count grows.
- Reused `verifyToken`/`hashToken` (auth.ts) and `can` (services/iam) — one auth
  + permission + audit path across UI/MCP/API. No new permissions minted.
- openapi.json + /docs are public (no auth); only `/api/v1/*` data routes are
  authenticated.

## Verification

- Typecheck PASS: `@erp/mcp` (= its build script).
- Tests PASS (11; 8 new + 3 existing): `apps/mcp/tests/api-v1.test.ts` covers
  OpenAPI doc shape, 401 (no/invalid token), 403 (no permission), 200 products,
  400 validation (stock/daily-summary), 429 burst + Retry-After.
- Biome PASS on all new/changed files.

## Deployment notes

- Set `MCP_SERVER_URL` (and `MCP_HTTP_ALLOWED_HOSTS`) to the public API host so
  the spec advertises the right server and the DNS-rebinding Host guard admits
  the public hostname. TLS terminated by Caddy/Cloudflare.

## Next Step

DONE for this increment. Remaining F8 cards (separate tasks): F8.3 more read
endpoints (journals/invoices/PO/financial statements/XLSX), F8.4 idempotent
approval-aware mutations, F8.5 link from Settings → API Token, F8.6 API security
sweep + blind onboarding simulation + register to pentest F6.4.
