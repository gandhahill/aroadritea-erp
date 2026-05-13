/**
 * Scheduled jobs schema — DB-driven cron configuration.
 * SD §35.1.4: schedules stored in DB, worker reads and syncs with pg-boss.
 * Admin manages via Settings UI without code changes or redeploy.
 */

import { boolean, index, jsonb, pgTable, text, timestamp, varchar } from 'drizzle-orm/pg-core';
import { auditCols, pk, tenantCol } from './common';

export const scheduledJobs = pgTable(
  'scheduled_jobs',
  {
    ...pk,
    ...tenantCol,

    // Unique job identifier — maps to worker handler name
    name: varchar('name', { length: 64 }).notNull().unique(),

    // Human-readable label + description
    label: varchar('label', { length: 255 }).notNull(),
    description: text('description'),

    // Cron expression + timezone (e.g., '0 0 2 * * *', 'Asia/Jakarta')
    // Format: 6-field cron (second minute hour day-of-month month day-of-week)
    cronExpression: varchar('cron_expression', { length: 64 }).notNull(),
    timezone: varchar('timezone', { length: 32 }).notNull().default('Asia/Jakarta'),

    // Job payload template — merged at runtime with runtime context
    jobData: jsonb('job_data').$type<Record<string, unknown>>(),

    // Enabled flag — worker only schedules enabled jobs
    enabled: boolean('enabled').notNull().default(true),

    // State tracking
    lastRunAt: timestamp('last_run_at', { withTimezone: true }),
    lastRunStatus: varchar('last_run_status', { length: 16 }), // 'success' | 'failed' | null
    lastRunError: text('last_run_error'),
    nextRunAt: timestamp('next_run_at', { withTimezone: true }),

    // Standard audit
    ...auditCols,
  },
  (t) => [
    index('scheduled_jobs_name_idx').on(t.name),
    index('scheduled_jobs_enabled_idx').on(t.enabled),
    index('scheduled_jobs_tenant_idx').on(t.tenantId),
  ],
);
