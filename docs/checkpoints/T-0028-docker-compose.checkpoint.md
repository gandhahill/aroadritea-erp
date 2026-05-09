# Checkpoint: T-0028 — Docker Compose + Dockerfile + Caddyfile + CI Workflow

## Status: 🟩 DONE
- **Started**: 2026-05-09
- **Last Updated**: 2026-05-09
- **Completed**: 2026-05-09

## Scope
Per SYSTEM-DESIGN §26 + §32:
1. `docker/Dockerfile.web` — multi-stage Next.js standalone ✅
2. `docker/Dockerfile.site` — multi-stage Next.js standalone ✅
3. `docker/Dockerfile.mcp` — tsx production build ✅
4. `docker/Dockerfile.worker` — tsx production build ✅
5. `docker/docker-compose.yml` — 5 services (site, web, mcp, worker, caddy) ✅
6. `docker/Caddyfile` — reverse proxy per domain routing ✅
7. `.github/workflows/ci.yml` — lint → typecheck → test → build → push GHCR ✅
8. `.github/workflows/deploy.yml` — staging auto, prod manual ✅

## Changes Made

### Dockerfiles (improved from previous session)
- Added `NODE_OPTIONS="--max-old-space-size=N"` per SD §4.3 memory targets
- Added `HEALTHCHECK` instructions for Docker auto-restart monitoring
- Fixed MCP user from `nextjs` → `mcpuser`, worker user → `workeruser`
- Fixed MCP Dockerfile: removed unused `node_modules_only_mcp` copy
- Removed migration from worker CMD (migrations run separately per SD §26.4)

### docker-compose.yml
- 5 services: caddy (96M), site (384M), web (640M), mcp (192M), worker (256M)
- Memory limits matching SD §4.3
- All services `restart: unless-stopped` per SD §35
- HTTP/3 support via Caddy UDP port
- No local DB container (Neon managed)

### Caddyfile
- Per SD §32.3: aroadritea.com → site:3000, erp → web:3001, mcp → mcp:3002
- Auto TLS via Let's Encrypt
- Cache headers for static assets, no-store for member portal
- gzip + zstd compression

### CI Workflow (.github/workflows/ci.yml)
- Per SD §26.1: lint → typecheck → test → build Docker → push GHCR
- Matrix strategy builds all 4 app images in parallel
- Concurrency groups cancel stale runs
- GHA cache for Docker layer caching

### Deploy Workflow (.github/workflows/deploy.yml)
- Staging: auto-deploy from `develop` branch
- Production: requires manual approval from `main` branch
- SSH-based deployment with migration run before restart
- Health check verification post-deploy

### Bug Fix
- Fixed `apps/mcp/package.json` build script from `tsc && tsx src/server.ts` → `tsc`

## Verification
- MCP typecheck: ✅ pass
- Services typecheck: ✅ pass
- Web typecheck: ✅ pass
- Pre-existing issue: `@erp/db` has argon2 type error (not related to this task)
