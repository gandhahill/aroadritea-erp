/**
 * pg-boss initialization — Aroadri Tea ERP Worker.
 * SD §35.1.4: BullMQ-like queue (pg-boss) on same Postgres DB.
 * Uses WebSocket connection for LISTEN/NOTIFY support (Neon-compatible).
 */

import PgBoss from 'pg-boss';

// Queue names
export const QUEUE_BACKUP = 'backup';
export const QUEUE_PAYROLL = 'payroll-batch';
export const QUEUE_STOCK_ALERT = 'stock-low-alert';
export const QUEUE_ISR_REVALIDATE = 'isr-revalidate';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('[worker] DATABASE_URL not set — cannot start pg-boss');
  process.exit(1);
}

// pg-boss uses the standard PostgreSQL connection string.
// Neon supports WebSocket connections via the same connection string.
// pg-boss creates its own schema (pgboss) for job tables.
const boss = new PgBoss({
  connectionString: DATABASE_URL,
  max: 2,
  retentionDays: 7,
  retryLimit: 3,
  retryDelay: 300,
  retryBackoff: true,
  schema: 'pgboss',
});

export type Boss = PgBoss;

export { boss };
