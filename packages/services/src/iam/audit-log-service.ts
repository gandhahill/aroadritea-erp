import { db } from '@erp/db';
import { auditLog, loginAttempts, users } from '@erp/db/schema/auth';
import { AppError } from '@erp/shared/errors';
import { type Result, err, ok } from '@erp/shared/result';
import type { AuditContext } from '@erp/shared/types';
import { eq, and, sql } from 'drizzle-orm';
import { z } from 'zod';
import { requirePermission } from './require-permission';

export const ExportAuditLogInputSchema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
});

export type ExportAuditLogInput = z.infer<typeof ExportAuditLogInputSchema>;

export async function exportAuditLog(input: ExportAuditLogInput, ctx: AuditContext): Promise<Result<{ csvData: string }>> {
  const parsed = ExportAuditLogInputSchema.safeParse(input);
  if (!parsed.success) return err(new Error(parsed.error.message));

  const permCheck = await requirePermission(ctx.userId, 'iam.audit.export');
  if (!permCheck.ok) return permCheck;

  const logs = await db
    .select()
    .from(auditLog)
    .where(
      and(
        eq(auditLog.tenantId, ctx.tenantId),
        sql`${auditLog.timestamp} >= ${new Date(input.startDate)}`,
        sql`${auditLog.timestamp} <= ${new Date(input.endDate)}`
      )
    )
    .orderBy(auditLog.timestamp);

  // In real implementation this would stream to a CSV, for now we just return a stub
  const csvData = `id,action,entity_type,entity_id,user_id,timestamp\n` +
    logs.map(l => `${l.id},${l.action},${l.entityType},${l.entityId},${l.userId},${l.timestamp.toISOString()}`).join('\n');

  return ok({ csvData });
}

export async function checkPasswordPolicy(userId: string, ctx: AuditContext): Promise<Result<{ isLocked: boolean }>> {
  // Check lockout from loginAttempts
  const recentFailures = await db
    .select()
    .from(loginAttempts)
    .where(and(eq(loginAttempts.userId, userId), eq(loginAttempts.status, 'failed')))
    .orderBy(sql`${loginAttempts.attemptedAt} DESC`)
    .limit(5);

  if (recentFailures.length >= 5) {
    // If 5 consecutive failures without success, lock out
    // Update user status
    await db.update(users).set({ isActive: false }).where(eq(users.id, userId));
    return ok({ isLocked: true });
  }

  return ok({ isLocked: false });
}
