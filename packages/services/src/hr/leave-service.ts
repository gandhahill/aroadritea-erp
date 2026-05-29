import { db } from '@erp/db';
import { leaveRequests, leaveBalances, leaveTypes } from '@erp/db/schema/hr';
import { AppError } from '@erp/shared/errors';
import { type Result, err, ok } from '@erp/shared/result';
import type { AuditContext } from '@erp/shared/types';
import { generateId } from '@erp/shared/id';
import { eq, and, sql } from 'drizzle-orm';
import { z } from 'zod';
import { requirePermission } from '../iam';

export const RequestLeaveInputSchema = z.object({
  employeeId: z.string().min(1),
  leaveTypeId: z.string().min(1),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  reason: z.string(),
});

export type RequestLeaveInput = z.infer<typeof RequestLeaveInputSchema>;

export async function requestLeave(input: RequestLeaveInput, ctx: AuditContext): Promise<Result<{ id: string }>> {
  const parsed = RequestLeaveInputSchema.safeParse(input);
  if (!parsed.success) return err(AppError.validation('common.errors.validationFailed', { issues: parsed.error.issues }));

  const start = new Date(input.startDate);
  const end = new Date(input.endDate);
  const totalDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));

  const year = start.getFullYear();

  // Check balance if required
  const [balance] = await db
    .select()
    .from(leaveBalances)
    .where(
      and(
        eq(leaveBalances.employeeId, input.employeeId),
        eq(leaveBalances.leaveTypeId, input.leaveTypeId),
        eq(leaveBalances.year, year)
      )
    );

  if (balance) {
    const available = Number(balance.totalDays) - Number(balance.usedDays) - Number(balance.pendingDays);
    if (available < totalDays) {
      return err(AppError.businessRule('hr.leave.insufficient_balance'));
    }
  }

  const id = generateId();
  await db.insert(leaveRequests).values({
    id,
    tenantId: ctx.tenantId,
    locationId: ctx.locationId,
    employeeId: input.employeeId,
    leaveTypeId: input.leaveTypeId,
    startDate: start,
    endDate: end,
    totalDays: totalDays.toString(),
    reason: input.reason,
    status: 'pending',
    createdBy: ctx.userId,
    updatedBy: ctx.userId,
  });

  if (balance) {
    await db
      .update(leaveBalances)
      .set({ pendingDays: sql`${leaveBalances.pendingDays} + ${totalDays}` })
      .where(eq(leaveBalances.id, balance.id));
  }

  return ok({ id });
}

export async function approveLeave(leaveId: string, ctx: AuditContext): Promise<Result<{ id: string }>> {
  const [leave] = await db
    .select()
    .from(leaveRequests)
    .where(and(eq(leaveRequests.id, leaveId), eq(leaveRequests.tenantId, ctx.tenantId)));

  if (!leave) return err(AppError.notFound('hr.leave.not_found'));
  if (leave.status !== 'pending') return err(AppError.businessRule('hr.leave.not_pending'));

  const permCheck = await requirePermission(ctx.userId, 'hr.approve_leave', { locationId: leave.locationId });
  if (!permCheck.ok) return permCheck;

  await db
    .update(leaveRequests)
    .set({
      status: 'approved',
      approvedBy: ctx.userId,
      approvedAt: new Date(),
      updatedBy: ctx.userId,
    })
    .where(eq(leaveRequests.id, leaveId));

  const year = leave.startDate.getFullYear();
  const [balance] = await db
    .select()
    .from(leaveBalances)
    .where(
      and(
        eq(leaveBalances.employeeId, leave.employeeId),
        eq(leaveBalances.leaveTypeId, leave.leaveTypeId),
        eq(leaveBalances.year, year)
      )
    );

  if (balance) {
    await db
      .update(leaveBalances)
      .set({
        pendingDays: sql`${leaveBalances.pendingDays} - ${leave.totalDays}`,
        usedDays: sql`${leaveBalances.usedDays} + ${leave.totalDays}`,
      })
      .where(eq(leaveBalances.id, balance.id));
  }

  return ok({ id: leave.id });
}
