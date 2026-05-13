/**
 * Scheduled Jobs Server Actions — SD §21.10, §35.1.4
 * CRUD operations for the scheduled_jobs table.
 * Admin manages cron schedules via Settings UI — worker polls every 60s.
 */

'use server';

import { db, desc, eq } from '@erp/db';
import { scheduledJobs } from '@erp/db/schema/scheduled-jobs';

export interface ScheduledJobItem {
  id: string;
  name: string;
  label: string;
  description: string | null;
  cronExpression: string;
  timezone: string;
  enabled: boolean;
  lastRunAt: Date | null;
  lastRunStatus: string | null;
  lastRunError: string | null;
  nextRunAt: Date | null;
  updatedAt: Date | null;
}

/**
 * Fetch all scheduled jobs for a tenant.
 */
export async function fetchScheduledJobs(tenantId: string): Promise<ScheduledJobItem[]> {
  const rows = await db
    .select({
      id: scheduledJobs.id,
      name: scheduledJobs.name,
      label: scheduledJobs.label,
      description: scheduledJobs.description,
      cronExpression: scheduledJobs.cronExpression,
      timezone: scheduledJobs.timezone,
      enabled: scheduledJobs.enabled,
      lastRunAt: scheduledJobs.lastRunAt,
      lastRunStatus: scheduledJobs.lastRunStatus,
      lastRunError: scheduledJobs.lastRunError,
      nextRunAt: scheduledJobs.nextRunAt,
      updatedAt: scheduledJobs.updatedAt,
    })
    .from(scheduledJobs)
    .where(eq(scheduledJobs.tenantId, tenantId))
    .orderBy(desc(scheduledJobs.enabled), scheduledJobs.name);

  return rows;
}

/**
 * Toggle the enabled state of a scheduled job.
 */
export async function toggleScheduledJob(
  tenantId: string,
  jobId: string,
  enabled: boolean,
): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await db
      .update(scheduledJobs)
      .set({
        enabled,
        updatedAt: new Date(),
      })
      .where(eq(scheduledJobs.id, jobId))
      .returning({ id: scheduledJobs.id });

    if (result.length === 0) {
      return { success: false, error: 'Job not found' };
    }

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/**
 * Update the cron expression of a scheduled job.
 */
export async function updateJobSchedule(
  tenantId: string,
  jobId: string,
  cronExpression: string,
): Promise<{ success: boolean; error?: string }> {
  // Basic cron expression validation (5 or 6 fields)
  const fields = cronExpression.trim().split(/\s+/);
  if (fields.length < 5 || fields.length > 6) {
    return { success: false, error: 'Invalid cron expression: expected 5 or 6 fields' };
  }

  try {
    const result = await db
      .update(scheduledJobs)
      .set({
        cronExpression: cronExpression.trim(),
        updatedAt: new Date(),
      })
      .where(eq(scheduledJobs.id, jobId))
      .returning({ id: scheduledJobs.id });

    if (result.length === 0) {
      return { success: false, error: 'Job not found' };
    }

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}
