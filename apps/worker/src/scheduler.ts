/**
 * Scheduler — DB-driven cron sync for pg-boss.
 * SD §35.1.4: reads schedules from `scheduled_jobs` table,
 * syncs with pg-boss at startup and periodically.
 */

import { db } from '@erp/db';
import { scheduledJobs } from '@erp/db/schema/scheduled-jobs';
import { eq } from 'drizzle-orm';
import { boss } from './boss';
import {
  backupHandler,
  isrRevalidateHandler,
  outageMonitorHandler,
  payrollBatchHandler,
  stockLowAlertHandler,
} from './jobs/index';
import type {
  BackupJobData,
  IsrRevalidateJobData,
  OutageMonitorJobData,
  PayrollJobData,
  StockAlertJobData,
} from './jobs/index';

// --- Handler map ---
// Maps job name (from DB) to actual handler function.
// When a new job is added, add its handler here.

type JobHandler = (data: Record<string, unknown>) => Promise<void>;

const handlerMap: Record<string, JobHandler> = {
  backup: (data) => backupHandler(data as BackupJobData),
  'payroll-batch': (data) => payrollBatchHandler(data as unknown as PayrollJobData),
  'stock-low-alert': (data) => stockLowAlertHandler(data as unknown as StockAlertJobData),
  'isr-revalidate': (data) => isrRevalidateHandler(data as unknown as IsrRevalidateJobData),
  'outage-monitor': (data) => outageMonitorHandler(data as unknown as OutageMonitorJobData),
};

// --- Sync state ---
// Tracks which jobs are currently scheduled in pg-boss.
const scheduled = new Map<string, string>(); // name → cron expression

/**
 * Sync all enabled scheduled jobs from DB to pg-boss.
 * Called on startup and periodically (every 60 seconds).
 */
export async function syncSchedules(): Promise<void> {
  const jobs = await db.select().from(scheduledJobs).where(eq(scheduledJobs.enabled, true));

  const dbJobNames = new Set(jobs.map((j) => j.name));

  // Unschedule jobs that are no longer in DB or disabled
  for (const [name, cron] of scheduled) {
    if (!dbJobNames.has(name)) {
      try {
        await boss.unschedule(name);
        scheduled.delete(name);
        console.info(`[scheduler] Unscheduled job: ${name}`);
      } catch (err) {
        console.error(`[scheduler] Failed to unschedule ${name}`, {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  // Schedule new or changed jobs
  for (const job of jobs) {
    const handler = handlerMap[job.name];
    if (!handler) {
      console.warn(`[scheduler] No handler registered for job: ${job.name}`);
      continue;
    }

    const currentCron = scheduled.get(job.name);

    if (currentCron !== job.cronExpression) {
      // Unschedule first (ignore error if not scheduled)
      if (scheduled.has(job.name)) {
        try {
          await boss.unschedule(job.name);
        } catch {
          /* ignore */
        }
      }

      // Register handler (pg-boss needs handler registered before scheduling)
      await boss.work(job.name, async (pgJob) => {
        try {
          const mergedData = {
            ...(job.jobData ?? {}),
            ...(pgJob.data ?? {}),
            _scheduledJobId: job.id,
            _runAt: new Date().toISOString(),
          };
          await handler(mergedData);
        } catch (err) {
          console.error(`[scheduler] Job ${job.name} failed`, {
            error: err instanceof Error ? err.message : String(err),
          });
          throw err; // re-throw so pg-boss marks job as failed
        }
      });

      // Schedule with cron
      await boss.schedule(job.name, job.cronExpression);
      scheduled.set(job.name, job.cronExpression);
      console.info(`[scheduler] Scheduled job: ${job.name} (cron: ${job.cronExpression})`);
    }
  }

  console.info(`[scheduler] Sync complete. ${scheduled.size} job(s) active.`);
}

/**
 * Start the scheduler: initial sync, then poll periodically.
 */
export async function startScheduler(): Promise<void> {
  await syncSchedules();

  // Poll every 60 seconds to pick up DB changes (admin UI updates)
  setInterval(async () => {
    try {
      await syncSchedules();
    } catch (err) {
      console.error('[scheduler] Periodic sync failed', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }, 60_000);
}
