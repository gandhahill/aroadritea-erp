'use server';

import { getSession } from '@/lib/auth';
import {
  and,
  asc,
  auditLog,
  db,
  desc,
  employees,
  eq,
  isNull,
  leaveBalances,
  leaveRequests,
  leaveTypes,
} from '@erp/db';
import { notifyByPermission } from '@erp/services/notification';
import { requirePermission } from '@erp/services/iam';
import { generateId } from '@erp/shared/id';
import { revalidatePath } from 'next/cache';

export interface LeaveDashboardData {
  types: Array<{
    id: string;
    code: string;
    name: Record<string, string>;
    annualQuotaDays: number;
    isPaid: boolean;
    requiresApproval: boolean;
    isActive: boolean;
  }>;
  requests: Array<{
    id: string;
    employeeName: string | null;
    leaveTypeName: Record<string, string> | null;
    startDate: Date;
    endDate: Date;
    totalDays: string;
    status: string;
    reason: string | null;
  }>;
  balances: Array<{
    id: string;
    employeeName: string | null;
    leaveTypeName: Record<string, string> | null;
    year: number;
    totalDays: string;
    usedDays: string;
    pendingDays: string;
  }>;
  /** Employee + active-leave-type options for the request form. */
  employees: Array<{ id: string; name: string }>;
  activeLeaveTypes: Array<{ id: string; code: string; nameId: string }>;
  /** Whether the current user can approve/reject (gates UI). */
  canApprove: boolean;
  /** Latest request rows include id for action wiring. */
  requestsFull: Array<{
    id: string;
    employeeName: string | null;
    leaveTypeName: Record<string, string> | null;
    startDate: Date;
    endDate: Date;
    totalDays: string;
    status: string;
    reason: string | null;
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

export async function fetchLeaveDashboard(): Promise<LeaveDashboardData | null> {
  const ctx = await getContext();
  if (!ctx) return null;
  const perm = await requirePermission(ctx.userId, 'hr.view');
  if (!perm.ok) return null;

  const [typeRows, requestRows, balanceRows] = await Promise.all([
    db
      .select({
        id: leaveTypes.id,
        code: leaveTypes.code,
        name: leaveTypes.name,
        annualQuotaDays: leaveTypes.annualQuotaDays,
        isPaid: leaveTypes.isPaid,
        requiresApproval: leaveTypes.requiresApproval,
        isActive: leaveTypes.isActive,
      })
      .from(leaveTypes)
      .where(and(eq(leaveTypes.tenantId, ctx.tenantId), isNull(leaveTypes.deletedAt)))
      .orderBy(asc(leaveTypes.code)),
    db
      .select({
        id: leaveRequests.id,
        employeeName: employees.name,
        leaveTypeName: leaveTypes.name,
        startDate: leaveRequests.startDate,
        endDate: leaveRequests.endDate,
        totalDays: leaveRequests.totalDays,
        status: leaveRequests.status,
        reason: leaveRequests.reason,
      })
      .from(leaveRequests)
      .leftJoin(
        employees,
        and(eq(leaveRequests.employeeId, employees.id), eq(employees.tenantId, ctx.tenantId)),
      )
      .leftJoin(
        leaveTypes,
        and(eq(leaveRequests.leaveTypeId, leaveTypes.id), eq(leaveTypes.tenantId, ctx.tenantId)),
      )
      .where(eq(leaveRequests.tenantId, ctx.tenantId))
      .orderBy(desc(leaveRequests.createdAt))
      .limit(50),
    db
      .select({
        id: leaveBalances.id,
        employeeName: employees.name,
        leaveTypeName: leaveTypes.name,
        year: leaveBalances.year,
        totalDays: leaveBalances.totalDays,
        usedDays: leaveBalances.usedDays,
        pendingDays: leaveBalances.pendingDays,
      })
      .from(leaveBalances)
      .leftJoin(
        employees,
        and(eq(leaveBalances.employeeId, employees.id), eq(employees.tenantId, ctx.tenantId)),
      )
      .leftJoin(
        leaveTypes,
        and(eq(leaveBalances.leaveTypeId, leaveTypes.id), eq(leaveTypes.tenantId, ctx.tenantId)),
      )
      .where(eq(leaveBalances.tenantId, ctx.tenantId))
      .orderBy(desc(leaveBalances.year))
      .limit(100),
  ]);

  const empRows = await db
    .select({ id: employees.id, name: employees.name, status: employees.status })
    .from(employees)
    .where(eq(employees.tenantId, ctx.tenantId))
    .orderBy(asc(employees.name));
  const approvePerm = await requirePermission(ctx.userId, 'hr.approve_leave');

  return {
    types: typeRows.map((row) => ({ ...row, name: row.name as Record<string, string> })),
    requests: requestRows.map((row) => ({
      ...row,
      leaveTypeName: row.leaveTypeName as Record<string, string> | null,
      totalDays: String(row.totalDays),
    })),
    requestsFull: requestRows.map((row) => ({
      ...row,
      leaveTypeName: row.leaveTypeName as Record<string, string> | null,
      totalDays: String(row.totalDays),
    })),
    balances: balanceRows.map((row) => ({
      ...row,
      leaveTypeName: row.leaveTypeName as Record<string, string> | null,
      totalDays: String(row.totalDays),
      usedDays: String(row.usedDays),
      pendingDays: String(row.pendingDays),
    })),
    employees: empRows
      .filter((r) => r.status !== 'terminated')
      .map((r) => ({ id: r.id, name: r.name })),
    activeLeaveTypes: typeRows
      .filter((t) => t.isActive)
      .map((t) => {
        const name = t.name as Record<string, string>;
        return { id: t.id, code: t.code, nameId: name.id ?? name.en ?? t.code };
      }),
    canApprove: approvePerm.ok,
  };
}

export async function saveLeaveTypeAction(formData: FormData): Promise<void> {
  const ctx = await getContext();
  if (!ctx) return;
  const perm = await requirePermission(ctx.userId, 'hr.approve_leave');
  if (!perm.ok) return;

  const id = String(formData.get('id') ?? '').trim();
  const code = String(formData.get('code') ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '_');
  const nameId = String(formData.get('nameId') ?? '').trim();
  const nameEn = String(formData.get('nameEn') ?? '').trim() || nameId;
  const nameZh = String(formData.get('nameZh') ?? '').trim() || nameId;
  const quota = Number(formData.get('annualQuotaDays') ?? 0);

  if (!/^[a-z0-9_-]{2,40}$/.test(code)) {
    return;
  }
  if (!nameId) return;
  if (!Number.isFinite(quota) || quota < 0 || quota > 365) {
    return;
  }

  const values = {
    code,
    name: { id: nameId, en: nameEn, zh: nameZh },
    annualQuotaDays: Math.trunc(quota),
    isPaid: formData.get('isPaid') === 'on',
    requiresApproval: formData.get('requiresApproval') === 'on',
    isActive: formData.get('isActive') === 'on',
    updatedAt: new Date(),
    updatedBy: ctx.userId || null,
  };

  try {
    if (id) {
      const [before] = await db
        .select()
        .from(leaveTypes)
        .where(and(eq(leaveTypes.tenantId, ctx.tenantId), eq(leaveTypes.id, id)))
        .limit(1);
      if (!before || before.deletedAt) return;

      await db
        .update(leaveTypes)
        .set(values)
        .where(and(eq(leaveTypes.tenantId, ctx.tenantId), eq(leaveTypes.id, id)));

      await db.insert(auditLog).values({
        id: generateId(),
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        action: 'update',
        entityType: 'leave_type',
        entityId: id,
        before: before as never,
        after: values as never,
      });
    } else {
      const newId = generateId();
      await db.insert(leaveTypes).values({
        id: newId,
        tenantId: ctx.tenantId,
        ...values,
        createdBy: ctx.userId || null,
      });

      await db.insert(auditLog).values({
        id: generateId(),
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        action: 'create',
        entityType: 'leave_type',
        entityId: newId,
        before: null,
        after: values as never,
      });
    }

    revalidatePath('/hr/leave');
    return;
  } catch {
    return;
  }
}

export async function deleteLeaveTypeAction(formData: FormData): Promise<void> {
  const ctx = await getContext();
  if (!ctx) return;
  const perm = await requirePermission(ctx.userId, 'hr.approve_leave');
  if (!perm.ok) return;

  const id = String(formData.get('id') ?? '').trim();
  if (!id) return;

  const [before] = await db
    .select()
    .from(leaveTypes)
    .where(and(eq(leaveTypes.tenantId, ctx.tenantId), eq(leaveTypes.id, id)))
    .limit(1);
  if (!before || before.deletedAt) return;

  const [usedRequest] = await db
    .select({ id: leaveRequests.id })
    .from(leaveRequests)
    .where(and(eq(leaveRequests.tenantId, ctx.tenantId), eq(leaveRequests.leaveTypeId, id)))
    .limit(1);
  const [usedBalance] = await db
    .select({ id: leaveBalances.id })
    .from(leaveBalances)
    .where(and(eq(leaveBalances.tenantId, ctx.tenantId), eq(leaveBalances.leaveTypeId, id)))
    .limit(1);

  const deletedAt = new Date();
  await db
    .update(leaveTypes)
    .set({
      isActive: false,
      deletedAt,
      updatedAt: deletedAt,
      updatedBy: ctx.userId || null,
    })
    .where(and(eq(leaveTypes.tenantId, ctx.tenantId), eq(leaveTypes.id, id)));

  await db.insert(auditLog).values({
    id: generateId(),
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: usedRequest || usedBalance ? 'deactivate' : 'delete',
    entityType: 'leave_type',
    entityId: id,
    before: before as never,
    after: { deletedAt: deletedAt.toISOString(), isActive: false } as never,
  });

  revalidatePath('/hr/leave');
}

// ─── Leave Requests CRUD ────────────────────────────────────────────────────

function diffDaysInclusive(start: Date, end: Date): number {
  const ms = end.getTime() - start.getTime();
  // Inclusive of both ends, in whole days.
  return Math.max(1, Math.round(ms / 86_400_000) + 1);
}

export async function createLeaveRequestAction(formData: FormData): Promise<void> {
  const ctx = await getContext();
  if (!ctx) return;
  const perm = await requirePermission(ctx.userId, 'hr.view');
  if (!perm.ok) return;

  const employeeId = String(formData.get('employeeId') ?? '').trim();
  const leaveTypeId = String(formData.get('leaveTypeId') ?? '').trim();
  const startStr = String(formData.get('startDate') ?? '').trim();
  const endStr = String(formData.get('endDate') ?? '').trim();
  const reason = String(formData.get('reason') ?? '').trim();
  if (!employeeId || !leaveTypeId || !startStr || !endStr) return;

  const start = new Date(`${startStr}T00:00:00+07:00`);
  const end = new Date(`${endStr}T23:59:59+07:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return;

  const id = generateId();
  await db.insert(leaveRequests).values({
    id,
    tenantId: ctx.tenantId,
    locationId: ctx.locationId,
    employeeId,
    leaveTypeId,
    startDate: start,
    endDate: end,
    totalDays: String(diffDaysInclusive(start, end)),
    reason: reason || null,
    status: 'pending',
    createdBy: ctx.userId,
    updatedBy: ctx.userId,
  });

  // Notify every user that holds hr.approve_leave so they see it in the
  // bell icon. Best-effort; never blocks the request creation.
  notifyByPermission({
    tenantId: ctx.tenantId,
    kind: 'leave',
    title: `Pengajuan cuti menunggu persetujuan`,
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
    after: { employeeId, leaveTypeId, startStr, endStr, status: 'pending' } as never,
  });
  revalidatePath('/hr/leave');
}

export async function decideLeaveRequestAction(formData: FormData): Promise<void> {
  const ctx = await getContext();
  if (!ctx) return;
  const perm = await requirePermission(ctx.userId, 'hr.approve_leave');
  if (!perm.ok) return;

  const id = String(formData.get('id') ?? '').trim();
  const decision = String(formData.get('decision') ?? '').trim();
  const rejectReason = String(formData.get('rejectReason') ?? '').trim();
  if (!id || !['approved', 'rejected', 'cancelled'].includes(decision)) return;

  const [before] = await db
    .select()
    .from(leaveRequests)
    .where(and(eq(leaveRequests.tenantId, ctx.tenantId), eq(leaveRequests.id, id)))
    .limit(1);
  if (!before || before.deletedAt) return;

  await db
    .update(leaveRequests)
    .set({
      status: decision,
      approvedBy: ctx.userId || null,
      approvedAt: new Date(),
      rejectReason: decision === 'rejected' ? rejectReason || null : null,
      updatedBy: ctx.userId || null,
      updatedAt: new Date(),
    })
    .where(and(eq(leaveRequests.tenantId, ctx.tenantId), eq(leaveRequests.id, id)));

  await db.insert(auditLog).values({
    id: generateId(),
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: decision,
    entityType: 'leave_request',
    entityId: id,
    before: before as never,
    after: { status: decision, approvedAt: new Date().toISOString() } as never,
  });
  revalidatePath('/hr/leave');
}

export async function deleteLeaveRequestAction(formData: FormData): Promise<void> {
  const ctx = await getContext();
  if (!ctx) return;
  const perm = await requirePermission(ctx.userId, 'hr.approve_leave');
  if (!perm.ok) return;
  const id = String(formData.get('id') ?? '').trim();
  if (!id) return;

  const [before] = await db
    .select()
    .from(leaveRequests)
    .where(and(eq(leaveRequests.tenantId, ctx.tenantId), eq(leaveRequests.id, id)))
    .limit(1);
  if (!before) return;

  const deletedAt = new Date();
  await db
    .update(leaveRequests)
    .set({ deletedAt, updatedAt: deletedAt, updatedBy: ctx.userId || null })
    .where(and(eq(leaveRequests.tenantId, ctx.tenantId), eq(leaveRequests.id, id)));

  await db.insert(auditLog).values({
    id: generateId(),
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: 'delete',
    entityType: 'leave_request',
    entityId: id,
    before: before as never,
    after: { deletedAt: deletedAt.toISOString() } as never,
  });
  revalidatePath('/hr/leave');
}
