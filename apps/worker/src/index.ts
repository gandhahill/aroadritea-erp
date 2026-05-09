/**
 * Worker entry point — Aroadri Tea ERP Worker.
 * SD §35.1.4: pg-boss queue + cron jobs.
 *
 * Jobs:
 * - backup (daily 02:00 WIB): pg_dump → S3/R2
 * - payroll-batch (7th monthly 23:00 WIB): monthly payroll
 * - stock-low-alert (Mondays 08:00 WIB): inventory check
 * - isr-revalidate (daily 04:00 WIB): cache invalidation
 */

import { boss, QUEUE_BACKUP, QUEUE_PAYROLL, QUEUE_STOCK_ALERT, QUEUE_ISR_REVALIDATE } from './boss';
import {
  backupHandler,
  payrollBatchHandler,
  stockLowAlertHandler,
  isrRevalidateHandler,
} from './jobs/index';
import type {
  BackupJobData,
  PayrollJobData,
  StockAlertJobData,
  IsrRevalidateJobData,
} from './jobs/index';

async function main() {
  console.info('[worker] Starting Aroadri Tea ERP Worker...');

  // --- Register event handlers ---
  boss.on('error', (error: Error) => {
    console.error('[worker] pg-boss error', { error: error.message });
  });

  boss.on('stopped', () => {
    console.info('[worker] pg-boss stopped');
  });

  // --- Register job handlers via boss.work() ---
  // pg-boss calls these when a job is fetched from the queue.
  // Scheduled jobs (via boss.schedule) land in the queue and get picked up by these handlers.

  await boss.work<BackupJobData, void>(QUEUE_BACKUP, async (job) => {
    await backupHandler(job.data);
  });

  await boss.work<PayrollJobData, void>(QUEUE_PAYROLL, async (job) => {
    await payrollBatchHandler(job.data);
  });

  await boss.work<StockAlertJobData, void>(QUEUE_STOCK_ALERT, async (job) => {
    await stockLowAlertHandler(job.data);
  });

  await boss.work<IsrRevalidateJobData, void>(QUEUE_ISR_REVALIDATE, async (job) => {
    await isrRevalidateHandler(job.data);
  });

  // --- Register cron schedules ---
  // Cron format: second minute hour day-of-month month day-of-week
  // pg-boss cron is evaluated server-side in UTC, so we use UTC times.
  //   02:00 WIB = 19:00 UTC   →  '0 0 19 * * *'
  //   23:00 WIB (7th) = 16:00 UTC →  '0 0 16 7 * *'
  //   08:00 WIB Monday = 01:00 UTC →  '0 0 1 * * 1'
  //   04:00 WIB = 21:00 UTC   →  '0 0 21 * * *'
  await boss.schedule(QUEUE_BACKUP, '0 0 19 * * *');
  await boss.schedule(QUEUE_PAYROLL, '0 0 16 7 * *');
  await boss.schedule(QUEUE_STOCK_ALERT, '0 0 1 * * 1');
  await boss.schedule(QUEUE_ISR_REVALIDATE, '0 0 21 * * *');

  // --- Start the queue ---
  await boss.start();
  console.info('[worker] pg-boss started, all handlers registered');

  // --- Graceful shutdown ---
  const shutdown = async (signal: string) => {
    console.info(`[worker] Received ${signal}, shutting down gracefully...`);
    await boss.stop();
    console.info('[worker] pg-boss stopped. Exiting.');
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  console.error('[worker] Fatal startup error', { error: err instanceof Error ? err.message : String(err) });
  process.exit(1);
});
