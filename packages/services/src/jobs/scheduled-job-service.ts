import { db } from '@erp/db';
import { scheduledJobs } from '@erp/db/schema/scheduled-jobs';
import { auditLog } from '@erp/db/schema/audit';
import { AppError } from '@erp/shared/errors';
import { type Result, err, ok } from '@erp/shared/result';
import type { AuditContext } from '@erp/shared/types';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { requirePermission } from '../iam/require-permission';
import { generateId } from '@erp/shared/id';

export const RunJobInputSchema = z.object({
  jobId: z.string().min(1),
});

export type RunJobInput = z.infer<typeof RunJobInputSchema>;

export async function runScheduledJob(input: RunJobInput, ctx: AuditContext): Promise<Result<{ historyId: string }>> {
  const parsed = RunJobInputSchema.safeParse(input);
  if (!parsed.success) return err(AppError.validation(parsed.error.message));

  // T-0253: Require permission to run jobs
  const permCheck = await requirePermission(ctx.userId, 'settings.manage');
  if (!permCheck.ok) return permCheck;

  const [job] = await db
    .select()
    .from(scheduledJobs)
    .where(and(eq(scheduledJobs.id, input.jobId), eq(scheduledJobs.tenantId, ctx.tenantId)));

  if (!job) return err(AppError.notFound('jobs.not_found'));
  if (!job.enabled) return err(AppError.businessRule('jobs.not_active'));

  const historyId = generateId();


  // T-0253: Write audit log
  await db.insert(auditLog).values({
    id: generateId(),
    tenantId: ctx.tenantId,
    entityType: 'job',
    entityId: job.id,
    action: 'start_job',
    userId: ctx.userId,
    after: { historyId },
  });

  // Simulated execution logic would go here.
  // For the service we just mark it complete
  

  await db.update(scheduledJobs)
    .set({
      lastRunAt: new Date(),
      lastRunStatus: 'success',
      updatedBy: ctx.userId,
    })
    .where(eq(scheduledJobs.id, job.id));

  return ok({ historyId });
}
