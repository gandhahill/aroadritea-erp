/**
 * Disable scheduled jobs that must not run until production configuration exists.
 *
 * Usage:
 *   pnpm jobs:disable-unconfigured
 */

import { db } from '@erp/db';
import { scheduledJobs } from '@erp/db/schema/scheduled-jobs';
import { inArray } from 'drizzle-orm';

const UNCONFIGURED_JOB_NAMES = [
  'backup',
  'payroll-batch',
  'stock-low-alert',
  'isr-revalidate',
] as const;

async function main(): Promise<void> {
  await db
    .update(scheduledJobs)
    .set({ enabled: false, updatedAt: new Date() })
    .where(inArray(scheduledJobs.name, [...UNCONFIGURED_JOB_NAMES]));

  console.info(`[scheduled-jobs] Disabled unconfigured jobs: ${UNCONFIGURED_JOB_NAMES.join(', ')}`);
}

main().catch((error) => {
  console.error('[scheduled-jobs] Failed to disable unconfigured jobs:', error);
  process.exit(1);
});
