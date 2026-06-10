# ADR-0017: Public REST API (`/api/v1`) + Scalar documentation

- **Status**: Accepted
- **Date**: 2026-06-10
- **Deciders**: Lintang (PIC); implemented under T-0293.
- **Supersedes/related**: ADR-0001 (TypeScript stack), ADR-0002 (app split). Implements master-plan phase F8 (`docs/plans/cards/F8-public-api-cards.md`), brought forward at the user's explicit request ("kerjakan sekarang", 2026-06-10).

## Context

Third parties (external accountants, aggregators, partners) need programmatic,
documented access to ERP data. The 2026-06-10 request phrased it as "dokumentasi
API menggunakan Scala". Confirmed with the user: this means **Scalar**
(scalar.com — an OpenAPI-based API reference UI), **not** the Scala JVM
language. A Scala runtime would violate ADR-0001 (TypeScript stack) and the 2 GB
RAM budget; that interpretation is explicitly rejected.

## Decision

1. **Surface**: a versioned REST API under `/api/v1`, hosted on the **existing**
   Hono HTTP server in `apps/mcp` (`http-server.ts`). No new process/runtime —
   respects the 2 GB RAM budget.
2. **Auth**: Bearer token using the existing `api_tokens` infra (SHA-256 hash,
   `verifyToken`). The same tokens issued for MCP work here.
3. **Authorization**: every route calls the shared permission engine
   (`can(userId, code, { locationId })`) — identical to the UI/MCP. No new
   permissions minted.
4. **Service reuse**: routes call `packages/services` only; the sole direct DB
   reads are thin master-data queries (stock levels) mirroring existing tools.
5. **Rate limiting**: in-memory fixed-window per token (default 120 req/min, env
   `PUBLIC_API_RATE_LIMIT`). No Redis.
6. **Errors**: uniform `{ error: { code, message } }` with stable codes
   (`UNAUTHENTICATED`, `FORBIDDEN`, `RATE_LIMITED`, `VALIDATION_ERROR`,
   `NOT_FOUND`, `INTERNAL`). No internal leakage.
7. **Money**: returned as integer strings (Rupiah), never JS numbers; a bigint
   replacer guards JSON serialization.
8. **Audit**: every API request writes `audit_log` with `metadata.source =
   'public_api'` (fire-and-forget).
9. **Spec & docs**: an OpenAPI 3.1 document served at `/api/v1/openapi.json`,
   and a public read-only **Scalar** reference at `/docs`.

### Deviation from the F8 card (documented)

The card suggested generating the spec via `@hono/zod-openapi` and serving Scalar
via `@scalar/hono-api-reference`. The workspace pins **zod v4**, while
`@hono/zod-openapi` carries a zod-v3 peer dependency — a real compatibility risk.
To avoid it and to keep `node_modules` small (CLAUDE.md §5.7), we instead:

- **define the OpenAPI document in code** (`api/v1/openapi-document.ts`) — the
  code still owns the contract, kept in lockstep with the handlers by tests; and
- **embed the Scalar bundle from a CDN** (`cdn.jsdelivr.net/npm/@scalar/api-reference`)
  on the `/docs` page, with a route-scoped relaxed CSP — **no new npm dependency**.

If a future need (e.g. many endpoints) makes hand-authoring the spec costly, we
can revisit adopting `@hono/zod-openapi` once its zod-v4 support is confirmed.

## Consequences

- **Positive**: no new runtime/deps; one auth + permission + audit path for UI,
  MCP, and API; live self-serve docs; spec shipped with the server.
- **Negative**: the OpenAPI document is maintained by hand — contract tests must
  assert it covers each route. Scalar UI depends on a public CDN at view time.
- **Deployment**: set `MCP_SERVER_URL` (and `MCP_HTTP_ALLOWED_HOSTS`) to the
  public API host so the spec advertises the correct server and the DNS-rebinding
  Host guard admits it. The reverse proxy (Caddy/Cloudflare) terminates TLS.

## Status of the rest of F8

This ADR + the foundation (F8.1/F8.2: 3 read endpoints, auth, rate limit, audit,
spec, Scalar docs) are done. **Follow-ups** remain as the rest of phase F8:
more read endpoints (F8.3), idempotent/approval-aware mutations (F8.4), the
onboarding runbook polish + Settings link (F8.5), and the API security sweep +
blind onboarding simulation (F8.6).
