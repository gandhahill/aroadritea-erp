# Checkpoint: T-0268 - Local PostgreSQL PM2 env incident

- **Owner**: Codex
- **Started**: 2026-06-03 10:13 WIB
- **Last updated**: 2026-06-03 10:26 WIB
- **Status**: DONE

## Goal
Investigate missing ERP data after PostgreSQL 16 to 18 upgrade on production VPS, without using Neon.

## Findings
- PostgreSQL local clusters after upgrade:
  - `18/main` online on `127.0.0.1:5432`.
  - `16/main` online on `127.0.0.1:5433`.
- `pg_upgradecluster` copied the ERP database successfully; local `aroadritea_erp` on port 5432 has 149 public tables.
- Local data from the previous night exists:
  - `manual_sales_closings`: 28 rows, latest `2026-06-02 21:35:58 WIB`.
  - `stock_movements`: 87 rows, latest `2026-06-02 23:17:59 WIB`.
  - `attendance`: 4 rows, latest `2026-06-03 09:05:37 WIB`.
- Root cause: PM2 saved dump still carried an old non-local `DATABASE_URL`, while repo `.env` already pointed to local PostgreSQL.

## Actions
- Created local PostgreSQL 18 backup before env switch:
  - `/root/aroadri-db-backups/aroadritea_erp_local18_before_pm2_env_switch_20260603_102308.dump`
- Reloaded PM2 apps with `ecosystem.config.cjs --update-env` so `.env` local `DATABASE_URL` is used.
- Saved PM2 process list with `pm2 save`; `/root/.pm2/dump.pm2` no longer contains Neon.
- Granted app user `aroadritea` required `pgboss` privileges on local PostgreSQL, then reloaded worker.

## Verification
- All PM2 apps online: `aroadri-web`, `aroadri-worker`, `aroadri-mcp`, `aroadri-site`.
- All app processes now use `DATABASE_URL=local-5432`.
- Health checks passed:
  - `http://127.0.0.1:3000/api/healthz`
  - `http://127.0.0.1:3001/api/healthz`
  - `http://127.0.0.1:3002/healthz`
- Worker recovered: `pg-boss started` and scheduler sync active.
- Permanence check:
  - `pm2-root.service` is `enabled` and `active`.
  - Systemd starts PM2 with `pm2 resurrect` using `PM2_HOME=/root/.pm2`.
  - `/root/.pm2/dump.pm2` contains local `127.0.0.1:5432/aroadritea_erp` and no non-local database URL.
  - `/root/.pm2/dump.pm2.bak` also contains local `127.0.0.1:5432/aroadritea_erp` and no non-local database URL.
  - Live `aroadri-web`, `aroadri-worker`, `aroadri-mcp`, and `aroadri-site` process environments all use local `127.0.0.1:5432`.

## Next step
User should refresh/login to ERP and verify that manual sales/stock/attendance data from 2026-06-02 night is visible again.
