/**
 * Worker entry point — Aroadri Tea ERP Worker.
 * SD §35.1.4: pg-boss queue with DB-driven cron schedules.
 *
 * Schedules are read from the `scheduled_jobs` table.
 * Admins manage schedules via Settings UI — no code change or redeploy needed.
 */

import { boss } from './boss';
import { startScheduler } from './scheduler';

async function main() {
  console.info('[worker] Starting Aroadri Tea ERP Worker...');

  // --- Register pg-boss event handlers ---
  boss.on('error', (error: Error) => {
    console.error('[worker] pg-boss error', { error: error.message });
  });

  boss.on('stopped', () => {
    console.info('[worker] pg-boss stopped');
  });

  // --- Start the queue ---
  await boss.start();
  console.info('[worker] pg-boss started');

  // --- Start DB-driven scheduler ---
  await startScheduler();

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
  console.error('[worker] Fatal startup error', {
    error: err instanceof Error ? err.message : String(err),
  });
  process.exit(1);
});
