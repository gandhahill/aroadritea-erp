# Checkpoint: T-0026 — Worker scaffolding + pg-boss

- **Owner**: Claude Opus 4.6
- **Started**: 2026-05-09
- **Last updated**: 2026-05-09
- **Status**: 🟩 DONE
- **Phase**: 1
- **Branch**: master

## Goal

Scaffold `apps/worker` dengan pg-boss queue, job handlers, dan Docker setup.
- Spec teknis: SYSTEM-DESIGN §35.1.4, §27, §4
- Job handlers: backup, payroll-batch, stock-low-alert, isr-revalidate

**Kriteria selesai (Definition of Done):**
- [x] pg-boss initialized with Neon PostgreSQL connection
- [x] Job handlers: backup.ts, payroll-batch.ts, stock-low-alert.ts, isr-revalidate.ts
- [x] Scheduler (cron) wiring for periodic jobs
- [x] Docker configuration (Dockerfile)
- [x] TypeScript typecheck passes
- [x] Docker build succeeds

## Plan

1. [x] Install pg-boss in apps/worker
2. [x] Create worker app structure: src/index.ts, src/boss.ts, src/jobs/
3. [x] Implement backup.ts job (pg_dump pattern, no-op placeholder for S3)
4. [x] Implement payroll-batch.ts job (placeholder, Phase 4)
5. [x] Implement stock-low-alert.ts job (placeholder, Phase 2)
6. [x] Implement isr-revalidate.ts job (placeholder, Phase 5)
7. [x] Wire up scheduler in index.ts with boss.work() pattern
8. [x] Create Dockerfile for worker
9. [x] Typecheck passes
10. [x] Build succeeds

## Decisions

- pg-boss `connectionString` option (not positional) — Neon WebSocket-compatible
- `boss.work(name, handler)` for job handlers (pg-boss 8.x API)
- `boss.schedule(name, cron)` for cron — times in UTC (02:00 WIB = 19:00 UTC, etc.)
- `schema: 'pgboss'` for pg-boss schema isolation
- `max: 2` for connection pool size (RAM-constrained server)
- `retryBackoff: true`, `retryLimit: 3`, `retryDelay: 300` for resilience

## Done so far

- `apps/worker/package.json` — added pg-boss, pg, drizzle-orm, neon, types
- `apps/worker/src/boss.ts` — pg-boss initialization with Neon connection
- `apps/worker/src/jobs/backup.ts` — placeholder backup job (S3 upload Phase 1+)
- `apps/worker/src/jobs/payroll-batch.ts` — placeholder (Phase 4)
- `apps/worker/src/jobs/stock-low-alert.ts` — placeholder (Phase 2)
- `apps/worker/src/jobs/isr-revalidate.ts` — placeholder (Phase 5)
- `apps/worker/src/jobs/index.ts` — barrel export
- `apps/worker/src/index.ts` — main entry: boss.start(), cron schedules, graceful shutdown
- `apps/worker/Dockerfile` — multi-stage build with dumb-init
- `apps/worker/tsconfig.json` — existing, no changes needed

## Open issues / Questions

- `docker-compose.yml` not created yet — T-0028 will add full Docker Compose
- pg-boss schema migration runs automatically on first `boss.start()` — no separate migration script needed
- Job retry dead-letter handling deferred to Phase 6 (T-0157 notification)

## Next step

Task done. Typecheck and build both pass. Next task: T-0027 (healthz endpoints) — in progress.

## Test status

- **Typecheck**: ✅ passes (`pnpm --filter @erp/worker typecheck`)
- **Build**: ✅ succeeds (`pnpm --filter @erp/worker build`)

## Files Touched

| Path | Action | Note |
|------|--------|------|
| `apps/worker/package.json` | modified | added pg-boss, pg, neon, drizzle-orm |
| `apps/worker/tsconfig.json` | read | existing, compatible |
| `apps/worker/src/boss.ts` | created | pg-boss initialization |
| `apps/worker/src/jobs/backup.ts` | created | placeholder |
| `apps/worker/src/jobs/payroll-batch.ts` | created | placeholder |
| `apps/worker/src/jobs/stock-low-alert.ts` | created | placeholder |
| `apps/worker/src/jobs/isr-revalidate.ts` | created | placeholder |
| `apps/worker/src/jobs/index.ts` | created | barrel |
| `apps/worker/src/index.ts` | modified | full implementation |
| `apps/worker/Dockerfile` | created | multi-stage |

## Commits So Far

| SHA | Message | Date |
|-----|---------|------|
| (pending) | wip(T-0026): worker scaffolding with pg-boss | 2026-05-09 |

---
