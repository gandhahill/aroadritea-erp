# Runbook - Restore PostgreSQL + assets from backup

> RPO target: 24 h for catalog / 0 for POS via offline queue. ADR-0009.

## When to use this

- Catastrophic data loss, such as accidental `DROP TABLE` or corrupted data.
- Restoring staging from production for a freeze test.
- Drill exercise to verify the backup chain works.

## Current production topology

Production uses local PostgreSQL 18 on the VPS, not Neon. ADR-0014 supersedes older Neon references for production runtime and restore.

All production PM2 apps must use the local `.env` `DATABASE_URL` pointing at `127.0.0.1:5432/aroadritea_erp`. After changing PM2 environment, always run `pm2 save` so `pm2 resurrect` keeps the local DB setting.

## Backup inventory

| What | Where | Frequency |
| --- | --- | --- |
| Postgres logical dump | `/home/aroadritea/web/aroadritea.com/public_html/aroadritea-erp/backups/db_backup_*.sql.gz` | Daily 02:00 WIB |
| Backup log | `/home/aroadritea/web/aroadritea.com/public_html/aroadritea-erp/logs/backup.log` | Per run |
| Off-site copy | rclone `remote:/backup/aroadritea-erp` | Daily 02:00 WIB |
| Local retention | Files older than 1 day | Rolling |
| Remote retention | Files older than 7 days | Rolling |

The backup cron must run as `root`, not `aroadritea`, because the production rclone config lives at `/root/.config/rclone/rclone.conf` and the backup/log directories are root-owned.

Expected root crontab:

```cron
MAILTO=""
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
0 2 * * * /home/aroadritea/web/aroadritea.com/public_html/aroadritea-erp/scripts/db-backup.sh >> /home/aroadritea/web/aroadritea.com/public_html/aroadritea-erp/logs/backup.log 2>&1
```

The `aroadritea` user crontab must not contain `db-backup.sh`.

## Backup health check

```bash
crontab -u root -l
crontab -u aroadritea -l
tail -n 80 /home/aroadritea/web/aroadritea.com/public_html/aroadritea-erp/logs/backup.log
rclone lsf remote:/backup/aroadritea-erp | tail -n 20
ls -lah /home/aroadritea/web/aroadritea.com/public_html/aroadritea-erp/backups
```

A healthy run ends with:

```text
Backup process completed successfully.
```

## Step 1 - Stop writes

```bash
pm2 stop aroadri-web aroadri-mcp aroadri-worker
```

Leave `aroadri-site` running so customers see the marketing site.

## Step 2 - Pick the snapshot

Prefer the latest dump before the corruption time.

```bash
rclone lsf remote:/backup/aroadritea-erp | tail -n 20
ls -lah /home/aroadritea/web/aroadritea.com/public_html/aroadritea-erp/backups
```

If the snapshot only exists off-site, download it first:

```bash
mkdir -p /root/aroadri-db-backups
rclone copy remote:/backup/aroadritea-erp/db_backup_YYYY-MM-DD_HH-MM-SS.sql.gz /root/aroadri-db-backups/
```

## Step 3 - Safety backup current DB

Before destructive restore, create a final dump of the current local DB.

```bash
cd /home/aroadritea/web/aroadritea.com/public_html/aroadritea-erp
set -a
. ./.env
set +a
mkdir -p /root/aroadri-db-backups
pg_dump -Fc "$DATABASE_URL" > "/root/aroadri-db-backups/before_restore_$(date +%Y%m%d_%H%M%S).dump"
```

## Step 4 - Restore the database

This destroys current production database contents.

```bash
sudo -u postgres dropdb --if-exists aroadritea_erp --force
sudo -u postgres createdb -O aroadritea aroadritea_erp
gunzip -c /root/aroadri-db-backups/db_backup_YYYY-MM-DD_HH-MM-SS.sql.gz | psql "$DATABASE_URL"
```

The daily backup excludes the `pgboss` schema. The worker should recreate it because the restored database is owned by the app database user.

## Step 5 - Re-run migrations

```bash
cd /home/aroadritea/web/aroadritea.com/public_html/aroadritea-erp
pnpm --filter @erp/db migrate
```

This catches the case where the backup pre-dates a schema migration.

## Step 6 - Restart services

```bash
pm2 restart aroadri-web aroadri-mcp aroadri-worker --update-env
pm2 save
pm2 status
```

Watch logs for the first POS sale to confirm journal posting works.

## Step 7 - Replay queued POS orders

Each cashier PWA has an offline queue in IndexedDB. After service is restored:

1. Cashier clicks "Sync now" on the offline banner.
2. Server creates the matching sales orders via the `idempotencyKey` uniqueness on `sales_orders.idempotencyKey` per location.

Duplicates are rejected by the unique index, so POS orders that were stored offline can be replayed safely.

## Step 8 - Reconcile period

If the restore crosses a period closing boundary:

1. Compare `general_ledger` totals to the last closed period.
2. If they disagree, open `accountingPeriods` for the affected month (`status = 'open'`) and re-run reporting jobs.

## Drill schedule

Quarterly, on the first Saturday of Jan/Apr/Jul/Oct. Drill restores into a staging DB (`aroadri_drill_<date>`); do not touch production. Log the drill in `TASK.md` under "Backup drills".
