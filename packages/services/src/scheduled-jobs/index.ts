/**
 * @erp/services/scheduled-jobs — DB-driven cron schedule management.
 *
 * Provides CRUD for scheduled_jobs table.
 * Worker reads from this table to configure pg-boss schedules dynamically.
 * Permission: system.manage_scheduled_jobs (admin only).
 */

import { db, sql } from '@erp/db';
import { scheduledJobs } from '@erp/db/schema/scheduled-jobs';
import { AppError } from '@erp/shared/errors';
import { generateId } from '@erp/shared/id';
import { type Result, err, ok } from '@erp/shared/result';
import type { AuditContext } from '@erp/shared/types';
import { and, desc, eq } from 'drizzle-orm';

// --- Zod schemas ---

import { z } from 'zod';

export const CreateScheduledJobSchema = z.object({
  name: z.string().min(1).max(64),
  label: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  cronExpression: z.string().min(9).max(64),
  timezone: z.string().max(32).default('Asia/Jakarta'),
  jobData: z.record(z.string(), z.unknown()).optional(),
  enabled: z.boolean().default(true),
});

export const UpdateScheduledJobSchema = z.object({
  label: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional(),
  cronExpression: z.string().min(9).max(64).optional(),
  timezone: z.string().max(32).optional(),
  jobData: z.record(z.string(), z.unknown()).optional(),
  enabled: z.boolean().optional(),
});

export type CreateScheduledJobInput = z.infer<typeof CreateScheduledJobSchema>;
export type UpdateScheduledJobInput = z.infer<typeof UpdateScheduledJobSchema>;

// --- Result types ---

export interface ScheduledJobResult {
  id: string;
  name: string;
  label: string;
  description: string | null;
  cronExpression: string;
  timezone: string;
  jobData: Record<string, unknown> | null;
  enabled: boolean;
  lastRunAt: string | null;
  lastRunStatus: string | null;
  lastRunError: string | null;
  nextRunAt: string | null;
  createdAt: string;
  updatedAt: string;
}

function toResult(row: Record<string, unknown>): ScheduledJobResult {
  return {
    id: row.id as string,
    name: row.name as string,
    label: row.label as string,
    description: row.description as string | null,
    cronExpression: row.cronExpression as string,
    timezone: row.timezone as string,
    jobData: (row.jobData as Record<string, unknown>) ?? null,
    enabled: row.enabled as boolean,
    lastRunAt: row.lastRunAt ? String(row.lastRunAt) : null,
    lastRunStatus: row.lastRunStatus as string | null,
    lastRunError: row.lastRunError as string | null,
    nextRunAt: row.nextRunAt ? String(row.nextRunAt) : null,
    createdAt: String(row.createdAt),
    updatedAt: String(row.updatedAt),
  };
}

// --- Service functions ---

/** List all scheduled jobs for a tenant. */
export async function listScheduledJobs(
  tenantId: string,
  _ctx?: AuditContext,
): Promise<Result<ScheduledJobResult[], AppError>> {
  const rows = await db
    .select()
    .from(scheduledJobs)
    .where(eq(scheduledJobs.tenantId, tenantId))
    .orderBy(desc(scheduledJobs.createdAt));

  return ok(rows.map(toResult));
}

/** Get a single scheduled job by ID. */
export async function getScheduledJob(
  id: string,
  tenantId: string,
): Promise<Result<ScheduledJobResult, AppError>> {
  const row = await db
    .select()
    .from(scheduledJobs)
    .where(and(eq(scheduledJobs.id, id), eq(scheduledJobs.tenantId, tenantId)))
    .limit(1);

  if (!row[0]) {
    return err(AppError.notFound('scheduledJobs.notFound', { id }));
  }

  return ok(toResult(row[0] as Record<string, unknown>));
}

/** Create a new scheduled job. */
export async function createScheduledJob(
  tenantId: string,
  input: CreateScheduledJobInput,
  _ctx?: AuditContext,
): Promise<Result<ScheduledJobResult, AppError>> {
  const parsed = CreateScheduledJobSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      AppError.validation('scheduledJobs.create.invalidInput', { issues: parsed.error.issues }),
    );
  }

  const data = parsed.data;

  // Check name uniqueness
  const existing = await db
    .select({ id: scheduledJobs.id })
    .from(scheduledJobs)
    .where(eq(scheduledJobs.name, data.name))
    .limit(1);
  if (existing[0]) {
    return err(AppError.conflict('scheduledJobs.create.duplicateName', { name: data.name }));
  }

  const id = generateId();
  await db.insert(scheduledJobs).values({
    id,
    tenantId,
    name: data.name,
    label: data.label,
    description: data.description,
    cronExpression: data.cronExpression,
    timezone: data.timezone,
    jobData: data.jobData ?? {},
    enabled: data.enabled,
  });

  return getScheduledJob(id, tenantId);
}

/** Update an existing scheduled job. */
export async function updateScheduledJob(
  id: string,
  tenantId: string,
  input: UpdateScheduledJobInput,
  _ctx?: AuditContext,
): Promise<Result<ScheduledJobResult, AppError>> {
  const parsed = UpdateScheduledJobSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      AppError.validation('scheduledJobs.update.invalidInput', { issues: parsed.error.issues }),
    );
  }

  const data = parsed.data;
  if (Object.keys(data).length === 0) {
    return err(AppError.validation('scheduledJobs.update.noFields'));
  }

  // Verify job exists
  const existing = await db
    .select({ id: scheduledJobs.id })
    .from(scheduledJobs)
    .where(and(eq(scheduledJobs.id, id), eq(scheduledJobs.tenantId, tenantId)))
    .limit(1);
  if (!existing[0]) {
    return err(new AppError('NOT_FOUND', 'Scheduled job not found', 404));
  }

  await db
    .update(scheduledJobs)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(and(eq(scheduledJobs.id, id), eq(scheduledJobs.tenantId, tenantId)));

  return getScheduledJob(id, tenantId);
}

/** Update job run status (called by worker after each run). */
export async function updateJobRunStatus(
  name: string,
  status: 'success' | 'failed',
  errorMessage?: string,
): Promise<Result<void, AppError>> {
  await db
    .update(scheduledJobs)
    .set({
      lastRunAt: new Date(),
      lastRunStatus: status,
      lastRunError: errorMessage ?? null,
    })
    .where(eq(scheduledJobs.name, name));

  return ok(void 0);
}
