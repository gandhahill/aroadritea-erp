# Runbook — Restore Postgres + assets from backup

> RPO target: **24 h for catalog / 0 for POS via offline queue**. ADR-0009.

## When to use this

- Catastrophic data loss (accidental DROP TABLE, ransomware).
- Restoring staging from production for a freeze test.
- Drill exercise to verify the backup chain works.

## Inventory

| What                  | Where                                        | Frequency  |
| --------------------- | -------------------------------------------- | ---------- |
| Postgres logical dump | `/var/backups/aroadri/db/aroadri_YYYY-MM-DD.sql.gz` | Daily 02:00 WIB |
| Postgres WAL          | Neon point-in-time (managed)                 | Continuous |
| Uploaded assets       | `/var/backups/aroadri/uploads/`              | Daily 02:30 WIB |
| Backup retention      | 7 daily, 4 weekly, 6 monthly                  | Rolling    |
| Off-site copy         | rclone to S3-compatible bucket (env: `BACKUP_S3_*`) | Daily |

The cron job lives in `scripts/cron-backup.sh` (T-0157).

## Step 1 — Stop writes

```bash
pm2 stop aroadri-web aroadri-mcp aroadri-worker
```

Leave `aroadri-site` running so customers see the marketing site.

## Step 2 — Pick the snapshot

```bash
ls -lh /var/backups/aroadri/db/
```

Use the most recent dump that pre-dates the corruption. If unsure, use
yesterday's 02:00 dump.

## Step 3 — Restore the database

```bash
# Drop and recreate the target DB (PRODUCTION: this destroys current state)
psql "$ADMIN_DATABASE_URL" -c "DROP DATABASE aroadri WITH (FORCE);"
psql "$ADMIN_DATABASE_URL" -c "CREATE DATABASE aroadri OWNER aroadri_app;"

# Restore the dump
gunzip -c /var/backups/aroadri/db/aroadri_2026-05-18.sql.gz \
  | psql "$DATABASE_URL"
```

For point-in-time restore (Neon), use the Neon console: pick a target
branch + timestamp; new branch becomes the new primary after promote.

## Step 4 — Restore uploaded assets

```bash
sudo rsync -a --delete \
  /var/backups/aroadri/uploads/ \
  /var/www/aroadritea/uploads/
```

## Step 5 — Re-run migrations (idempotent)

```bash
cd /var/www/aroadritea/repo
pnpm --filter @erp/db migrate
```

Catches the case where the backup pre-dates a schema migration.

## Step 6 — Restart services

```bash
pm2 start aroadri-web aroadri-mcp aroadri-worker
pm2 status
```

Watch logs for the first POS sale to confirm journal posting works.

## Step 7 — Replay queued POS orders

Each cashier PWA has an offline queue (IndexedDB). After restart:

1. Cashier clicks "Sync now" on the offline banner.
2. Server creates the matching sales orders via the `idempotencyKey`
   uniqueness on `sales_orders.idempotencyKey` (per location).

Duplicates are silently rejected by the unique index — no data loss
beyond the snapshot window.

## Step 8 — Reconcile period

If the restore crosses a period closing boundary:

1. Compare `general_ledger` totals to the last closed period.
2. If they disagree, open `accountingPeriods` for the affected month
   (`status = 'open'`) and re-run reporting jobs.

## Drill schedule

Quarterly, on the first Saturday of Jan/Apr/Jul/Oct. Drill restores into
a staging DB (`aroadri_drill_<date>`); does NOT touch production. Log
the drill in `TASK.md` under "Backup drills".
