/**
 * Backup job.
 *
 * Production backup is intentionally fail-closed unless the deployment states
 * that backups are handled by the managed database provider.
 */

export interface BackupJobData {
  tenantId?: string;
}

export async function backupHandler(data: BackupJobData): Promise<void> {
  const { tenantId } = data;
  console.info('[backup] Starting backup job', { tenantId });

  if (process.env.BACKUP_PROVIDER_MANAGED === 'true') {
    console.info('[backup] Provider-managed backup is enabled; no worker backup action required.');
    return;
  }

  throw new Error(
    'Backup job is not configured. Keep this scheduled job disabled unless BACKUP_PROVIDER_MANAGED=true is set or an off-site backup runner is implemented.',
  );
}
