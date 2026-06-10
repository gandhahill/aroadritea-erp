/**
 * Scheduled Jobs Server Actions — SD §21.10, §35.1.4
 * CRUD operations for the scheduled_jobs table.
 * Admin manages cron schedules via Settings UI — worker polls every 60s.
 */

'use server';

import { getSession } from '@/lib/auth';
import { and, auditLog, db, desc, eq } from '@erp/db';
import { scheduledJobs } from '@erp/db/schema/scheduled-jobs';
import { requirePermission } from '@erp/services/iam';
import { generateId } from '@erp/shared/id';
import { revalidatePath } from 'next/cache';

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

async function requireContext(
  tenantId: string,
): Promise<{ userId: string; tenantId: string } | null> {
  const session = await getSession();
  if (!session?.user) return null;
  const user = session.user as Record<string, unknown>;
  const currentTenantId = (user.tenantId as string | undefined) ?? 'default';
  if (currentTenantId !== tenantId) return null;

  const userId = String(user.id ?? '');
  const perm = await requirePermission(userId, 'settings.manage');
  if (!perm.ok) return null;

  return { userId, tenantId: currentTenantId };
}

/**
 * Fetch all scheduled jobs for a tenant.
 */
export async function fetchScheduledJobs(tenantId: string): Promise<ScheduledJobItem[]> {
  const ctx = await requireContext(tenantId);
  if (!ctx) return [];
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
    const ctx = await requireContext(tenantId);
    if (!ctx) return { success: false, error: 'Forbidden' };

    const [before] = await db
      .select({ enabled: scheduledJobs.enabled })
      .from(scheduledJobs)
      .where(and(eq(scheduledJobs.id, jobId), eq(scheduledJobs.tenantId, tenantId)))
      .limit(1);

    if (!before) {
      return { success: false, error: 'Job not found' };
    }

    await db
      .update(scheduledJobs)
      .set({
        enabled,
        updatedAt: new Date(),
      })
      .where(and(eq(scheduledJobs.id, jobId), eq(scheduledJobs.tenantId, tenantId)));

    await db.insert(auditLog).values({
      id: generateId(),
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      action: 'update',
      entityType: 'scheduled_job',
      entityId: jobId,
      before: { enabled: before.enabled } as never,
      after: { enabled } as never,
    });

    revalidatePath('/settings/scheduled-jobs');
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
  const ctx = await requireContext(tenantId);
  if (!ctx) return { success: false, error: 'Forbidden' };

  // Basic cron expression validation (5 or 6 fields)
  const fields = cronExpression.trim().split(/\s+/);
  if (fields.length < 5 || fields.length > 6) {
    return { success: false, error: 'Invalid cron expression: expected 5 or 6 fields' };
  }

  try {
    const [before] = await db
      .select({ cronExpression: scheduledJobs.cronExpression })
      .from(scheduledJobs)
      .where(and(eq(scheduledJobs.id, jobId), eq(scheduledJobs.tenantId, tenantId)))
      .limit(1);

    if (!before) {
      return { success: false, error: 'Job not found' };
    }

    await db
      .update(scheduledJobs)
      .set({
        cronExpression: cronExpression.trim(),
        updatedAt: new Date(),
      })
      .where(and(eq(scheduledJobs.id, jobId), eq(scheduledJobs.tenantId, tenantId)));

    await db.insert(auditLog).values({
      id: generateId(),
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      action: 'update',
      entityType: 'scheduled_job',
      entityId: jobId,
      before: { cronExpression: before.cronExpression } as never,
      after: { cronExpression: cronExpression.trim() } as never,
    });

    revalidatePath('/settings/scheduled-jobs');
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}
