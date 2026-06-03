# Checkpoint: T-0270 - Production rclone backup cron repair

- **Owner**: Codex
- **Started**: 2026-06-03 12:54 WIB
- **Last updated**: 2026-06-03 13:00 WIB
- **Status**: DONE

## Goal
Investigate why the scheduled production PostgreSQL backup via rclone did not run, then make the fix permanent.

## Findings
- `cron` service was active and invoked the backup job at 02:00 WIB.
- The job was installed under user `aroadritea`.
- The backup script, `logs/`, and `backups/` directories are owned by `root`.
- User `aroadritea` could read `.env`, but could not write `logs/` or `backups/`.
- rclone remote `remote:` is configured for `root` at `/root/.config/rclone/rclone.conf`.
- User `aroadritea` has no rclone config at `/home/aroadritea/.config/rclone/rclone.conf`.
- Result: cron fired, but could not create `logs/backup.log`, could not write local dumps, and could not upload via rclone.

## Actions
- Backed up existing root and `aroadritea` crontabs under `/root/cron-backups/`.
- Installed the backup job under root crontab:
  - `0 2 * * * /home/aroadritea/web/aroadritea.com/public_html/aroadritea-erp/scripts/db-backup.sh >> /home/aroadritea/web/aroadritea.com/public_html/aroadritea-erp/logs/backup.log 2>&1`
- Removed the failing `db-backup.sh` line from the `aroadritea` user crontab.
- Kept `logs/`, `backups/`, and `scripts/db-backup.sh` root-owned and mode `755`, matching the root cron/rclone setup.
- Updated backup/restore documentation to reflect local PostgreSQL 18 + root cron + rclone off-site backup.

## Verification
- Manual root execution succeeded:
  - Created local backup `db_backup_2026-06-03_12-59-54.sql.gz`.
  - Uploaded it to rclone `remote:/backup/aroadritea-erp`.
  - `logs/backup.log` ended with `Backup process completed successfully.`
- Remote rclone listing contains:
  - `db_backup_2026-06-02_06-32-05.sql.gz`
  - `db_backup_2026-06-03_12-59-54.sql.gz`
- Root crontab now contains the 02:00 WIB backup schedule.
- `aroadritea` crontab no longer contains the failing backup job.

## Next step
Tomorrow after 02:00 WIB, verify the automatic run with:

```bash
tail -n 80 /home/aroadritea/web/aroadritea.com/public_html/aroadritea-erp/logs/backup.log
rclone lsf remote:/backup/aroadritea-erp | tail -n 20
```
