# Checkpoint: T-0027 — Healthz endpoints

- **Owner**: Claude Opus 4.6
- **Started**: 2026-05-09
- **Last updated**: 2026-05-09
- **Status**: 🟩 DONE
- **Phase**: 1
- **Branch**: master

## Goal

Add `/healthz` endpoint to apps/web, apps/site, and apps/mcp.
- Spec: SD §35.1.5, §28.2
- web: DB check + version
- site: lightweight, no DB
- mcp: HTTP server on port 3002

## Plan

1. [x] Create `apps/web/app/api/healthz/route.ts`
2. [x] Create `apps/site/app/api/healthz/route.ts`
3. [x] Create `apps/mcp/src/http-server.ts` (Hono, port 3002)
4. [x] Wire http-server into `apps/mcp/src/server.ts`
5. [x] Typecheck passes

## Decisions

- MCP HTTP health server runs alongside stdio MCP transport on port 3002 (`MCP_HTTP_PORT` env var)
- web healthz uses `db.execute(sql`SELECT 1`)` from `@erp/db` (not `drizzle-orm` directly)
- site healthz is lightweight (no DB dependency — can be deployed independently)

## Done so far

- `apps/web/app/api/healthz/route.ts` — DB check + version, returns 503 if DB fails
- `apps/site/app/api/healthz/route.ts` — lightweight, no auth
- `apps/mcp/src/http-server.ts` — Hono HTTP server, `/healthz` + `/` routes
- `apps/mcp/src/server.ts` — starts HTTP server alongside stdio MCP

## Next step

Task done. Next task: T-0028 (Docker Compose + Caddyfile).

## Test status

- **Typecheck**: ✅ web + mcp pass

## Files Touched

| Path | Action | Note |
|------|--------|------|
| `apps/web/app/api/healthz/route.ts` | created | DB check + version |
| `apps/site/app/api/healthz/route.ts` | created | lightweight |
| `apps/mcp/src/http-server.ts` | created | Hono healthz |
| `apps/mcp/src/server.ts` | modified | starts HTTP server |

## Commits So Far

| SHA | Message | Date |
|-----|---------|------|
| (pending) | wip(T-0027): healthz endpoints for web, site, mcp | 2026-05-09 |

---
