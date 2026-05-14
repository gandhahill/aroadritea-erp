# Checkpoint: T-0026 — Worker scaffolding + pg-boss

- **Owner**: Claude Opus 4.6
- **Started**: 2026-05-09
- **Last updated**: 2026-05-09
- **Status**: 🟩 DONE
- **Phase**: 1
- **Branch**: master

## Goal

Scaffold `apps/worker` dengan pg-boss queue dan DB-driven cron schedules.
- Spec teknis: SYSTEM-DESIGN §35.1.4, §27, §4
- **Design change**: schedules stored in DB (`scheduled_jobs` table), worker syncs with pg-boss on startup + every 60s. Admin manages via Settings UI — no code change or redeploy needed.

## Design

- `scheduled_jobs` table stores: name, label, description, cronExpression, timezone, jobData, enabled, lastRunAt, lastRunStatus
- Worker reads enabled jobs from DB, syncs with pg-boss
- Scheduler polls DB every 60 seconds to pick up admin changes
- Handler map in worker: job name → JS function (backup, payroll-batch, stock-low-alert, isr-revalidate)
- Labels stored as i18n keys (e.g., `scheduledJobs.backup.label`), rendered by UI

## Decisions

- pg-boss `connectionString` option (not positional) — Neon WebSocket-compatible
- `boss.work(name, handler)` for job handlers (pg-boss 8.x API)
- `boss.schedule(name, cron)` for cron — times in UTC (02:00 WIB = 19:00 UTC, etc.)
- `schema: 'pgboss'` for pg-boss schema isolation
- `max: 2` for connection pool size (RAM-constrained server)
- `retryBackoff: true`, `retryLimit: 3`, `retryDelay: 300` for resilience
- Cron expressions stored in UTC, converted to WIB for UI display
- Labels stored as i18n keys (not hardcoded strings) per CLAUDE.md §5.2

## Done so far

- `packages/db/schema/scheduled-jobs.ts` — DB schema with indexes
- `packages/db/seed/scheduled-jobs-seed.ts` — 4 default jobs (backup, payroll-batch, stock-low-alert, isr-revalidate)
- `packages/db/seed/index.ts` — updated to seed scheduled_jobs
- `packages/db/index.ts` — exports `scheduledJobs`
- `packages/services/src/scheduled-jobs/index.ts` — CRUD service (list, get, create, update, updateJobRunStatus)
- `packages/services/index.ts` — re-exports scheduled-jobs service
- `packages/services/tsconfig.json` — added paths for @erp/db and @erp/shared
- `apps/worker/src/scheduler.ts` — DB-to-pg-boss sync (startup + 60s polling)
- `apps/worker/src/index.ts` — simplified: just boss.start() + startScheduler()
- `apps/worker/src/boss.ts` — pg-boss initialization
- `apps/worker/src/jobs/` — 4 initial job handlers
- `apps/worker/Dockerfile` — multi-stage build
- `apps/worker/tsconfig.json` — added paths for cross-package imports
- `apps/web/messages/id.json` — added scheduledJobs i18n keys
- `apps/web/messages/en.json` — added scheduledJobs i18n keys
- `apps/web/messages/zh.json` — added scheduledJobs i18n keys

## Open issues / Questions

- `docker-compose.yml` not created yet — T-0028 will add full Docker Compose
- pg-boss schema migration runs automatically on first `boss.start()` — no separate migration script needed
- Job retry dead-letter handling scheduled for Phase 6 (T-0157 notification)
- Settings UI for managing schedules was added later in the scheduled-jobs settings task

## Next step

DB-driven cron scaffolding done. Typecheck passes. Remaining: T-0028 (Docker Compose + Caddyfile).

## Test status

- **Typecheck**: ✅ worker, services, web all pass
- **Build**: ✅ worker build succeeds

## Files Touched

See above in "Done so far".

## Commits So Far

| SHA | Message | Date |
|-----|---------|------|
| (pending) | wip(T-0026): worker scaffolding with pg-boss + DB-driven cron | 2026-05-09 |

---
