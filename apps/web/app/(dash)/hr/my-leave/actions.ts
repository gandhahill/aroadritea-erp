'use server';

import { getSession } from '@/lib/auth';
import {
  and,
  asc,
  auditLog,
  db,
  desc,
  eq,
  isNull,
  leaveRequests,
  leaveTypes,
} from '@erp/db';
import { resolveEmployeeForUser } from '@erp/services/hr';
import { notifyByPermission } from '@erp/services/notification';
import { generateId } from '@erp/shared/id';
import { revalidatePath } from 'next/cache';

export interface MyLeaveData {
  employeeId: string;
  employeeName: string;
  activeLeaveTypes: Array<{ id: string; code: string; nameId: string }>;
  requests: Array<{
    id: string;
    leaveTypeName: Record<string, string> | null;
    startDate: Date;
    endDate: Date;
    totalDays: string;
    status: string;
    reason: string | null;
    rejectReason: string | null;
  }>;
}

async function getContext() {
  const session = await getSession();
  if (!session?.user) return null;
  const user = session.user as Record<string, unknown>;
  return {
    userId: String(user.id ?? ''),
    tenantId: String(user.tenantId ?? 'default'),
    locationId: String(user.locationId ?? ''),
  };
}

/** Self-service leave dashboard: the signed-in employee's own requests only. */
export async function fetchMyLeave(): Promise<MyLeaveData | null> {
  const ctx = await getContext();
  if (!ctx) return null;
  const emp = await resolveEmployeeForUser(ctx.tenantId, ctx.userId);
  if (!emp) return null;

  const [typeRows, requestRows] = await Promise.all([
    db
      .select({
        id: leaveTypes.id,
        code: leaveTypes.code,
        name: leaveTypes.name,
      })
      .from(leaveTypes)
      .where(
        and(
          eq(leaveTypes.tenantId, ctx.tenantId),
          eq(leaveTypes.isActive, true),
          isNull(leaveTypes.deletedAt),
        ),
      )
      .orderBy(asc(leaveTypes.code)),
    db
      .select({
        id: leaveRequests.id,
        leaveTypeName: leaveTypes.name,
        startDate: leaveRequests.startDate,
        endDate: leaveRequests.endDate,
        totalDays: leaveRequests.totalDays,
        status: leaveRequests.status,
        reason: leaveRequests.reason,
        rejectReason: leaveRequests.rejectReason,
      })
      .from(leaveRequests)
      .leftJoin(
        leaveTypes,
        and(eq(leaveRequests.leaveTypeId, leaveTypes.id), eq(leaveTypes.tenantId, ctx.tenantId)),
      )
      .where(
        and(
          eq(leaveRequests.tenantId, ctx.tenantId),
          eq(leaveRequests.employeeId, emp.id),
          isNull(leaveRequests.deletedAt),
        ),
      )
      .orderBy(desc(leaveRequests.createdAt))
      .limit(50),
  ]);

  return {
    employeeId: emp.id,
    employeeName: emp.name,
    activeLeaveTypes: typeRows.map((row) => {
      const name = row.name as Record<string, string>;
      return { id: row.id, code: row.code, nameId: name.id ?? name.en ?? row.code };
    }),
    requests: requestRows.map((row) => ({
      ...row,
      leaveTypeName: row.leaveTypeName as Record<string, string> | null,
      totalDays: String(row.totalDays),
    })),
  };
}

function diffDaysInclusive(start: Date, end: Date): number {
  const ms = end.getTime() - start.getTime();
  return Math.max(1, Math.round(ms / 86_400_000) + 1);
}

/**
 * Submit a leave request for the signed-in employee. Requires only
 * authentication (no HR permission) — this is self-service. The request
 * is created as `pending` and approvers are notified.
 */
export async function createMyLeaveRequestAction(formData: FormData): Promise<void> {
  const ctx = await getContext();
  if (!ctx) return;
  const emp = await resolveEmployeeForUser(ctx.tenantId, ctx.userId);
  if (!emp) return;

  const leaveTypeId = String(formData.get('leaveTypeId') ?? '').trim();
  const startStr = String(formData.get('startDate') ?? '').trim();
  const endStr = String(formData.get('endDate') ?? '').trim();
  const reason = String(formData.get('reason') ?? '').trim();
  if (!leaveTypeId || !startStr || !endStr) return;

  const start = new Date(`${startStr}T00:00:00+07:00`);
  const end = new Date(`${endStr}T23:59:59+07:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return;

  // Validate the leave type exists and is active for this tenant.
  const [leaveType] = await db
    .select({ id: leaveTypes.id })
    .from(leaveTypes)
    .where(
      and(
        eq(leaveTypes.tenantId, ctx.tenantId),
        eq(leaveTypes.id, leaveTypeId),
        eq(leaveTypes.isActive, true),
        isNull(leaveTypes.deletedAt),
      ),
    )
    .limit(1);
  if (!leaveType) return;

  const id = generateId();
  await db.insert(leaveRequests).values({
    id,
    tenantId: ctx.tenantId,
    locationId: emp.locationId,
    employeeId: emp.id,
    leaveTypeId,
    startDate: start,
    endDate: end,
    totalDays: String(diffDaysInclusive(start, end)),
    reason: reason || null,
    status: 'pending',
    createdBy: ctx.userId,
    updatedBy: ctx.userId,
  });

  notifyByPermission({
    tenantId: ctx.tenantId,
    kind: 'leave',
    title: `Pengajuan cuti dari ${emp.name}`,
    body: `${startStr} → ${endStr}${reason ? ` · ${reason}` : ''}`,
    link: `/hr/leave`,
    permission: 'hr.approve_leave',
  }).catch(() => {});

  await db.insert(auditLog).values({
    id: generateId(),
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: 'create',
    entityType: 'leave_request',
    entityId: id,
    before: null,
    after: { employeeId: emp.id, leaveTypeId, startStr, endStr, status: 'pending', selfService: true } as never,
  });

  revalidatePath('/hr/my-leave');
  revalidatePath('/hr/leave');
}

/** Cancel a still-pending self-submitted request. */
export async function cancelMyLeaveRequestAction(formData: FormData): Promise<void> {
  const ctx = await getContext();
  if (!ctx) return;
  const emp = await resolveEmployeeForUser(ctx.tenantId, ctx.userId);
  if (!emp) return;
  const id = String(formData.get('id') ?? '').trim();
  if (!id) return;

  const [before] = await db
    .select()
    .from(leaveRequests)
    .where(
      and(
        eq(leaveRequests.tenantId, ctx.tenantId),
        eq(leaveRequests.id, id),
        eq(leaveRequests.employeeId, emp.id),
      ),
    )
    .limit(1);
  // Employees may only cancel their OWN still-pending requests.
  if (!before || before.deletedAt || before.status !== 'pending') return;

  await db
    .update(leaveRequests)
    .set({
      status: 'cancelled',
      updatedBy: ctx.userId,
      updatedAt: new Date(),
    })
    .where(and(eq(leaveRequests.tenantId, ctx.tenantId), eq(leaveRequests.id, id)));

  await db.insert(auditLog).values({
    id: generateId(),
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: 'cancelled',
    entityType: 'leave_request',
    entityId: id,
    before: before as never,
    after: { status: 'cancelled', selfService: true } as never,
  });

  revalidatePath('/hr/my-leave');
  revalidatePath('/hr/leave');
}
