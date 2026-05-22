'use server';

import { getSession } from '@/lib/auth';
import { and, db, eq, gte, lte, sql } from '@erp/db';
import { auditLog } from '@erp/db/schema/audit';
import { employees, shiftAssignments, shiftDefinitions } from '@erp/db/schema/hr';
import { requirePermission } from '@erp/services/iam';
import { generateId } from '@erp/shared/id';
import type { AuditContext } from '@erp/shared/types';
import { revalidatePath } from 'next/cache';

async function buildCtx(): Promise<AuditContext | null> {
  const session = await getSession();
  if (!session?.user) return null;
  const user = session.user as Record<string, unknown>;
  return {
    userId: String(user.id ?? ''),
    tenantId: String(user.tenantId ?? 'default'),
    locationId: String(user.locationId ?? ''),
  };
}

export interface RosterAssignment {
  id: string;
  employeeId: string;
  employeeName: string;
  workDate: string;
  kind: 'shift' | 'off';
  shiftDefinitionId: string | null;
  shiftCode: string | null;
  shiftLabel: string | null;
}

export interface RosterOptions {
  shifts: Array<{ id: string; code: string; label: string; time: string }>;
  employees: Array<{ id: string; name: string }>;
}

export async function fetchRoster(weekStart: string): Promise<{
  options: RosterOptions;
  assignments: RosterAssignment[];
}> {
  const ctx = await buildCtx();
  if (!ctx) return { options: { shifts: [], employees: [] }, assignments: [] };

  const start = new Date(weekStart);
  const end = new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000);
  const startStr = start.toISOString().slice(0, 10);
  const endStr = end.toISOString().slice(0, 10);

  const [shiftRows, empRows, asnRows] = await Promise.all([
    db
      .select({
        id: shiftDefinitions.id,
        code: shiftDefinitions.code,
        name: shiftDefinitions.name,
        startTime: shiftDefinitions.startTime,
        endTime: shiftDefinitions.endTime,
      })
      .from(shiftDefinitions)
      .where(and(eq(shiftDefinitions.tenantId, ctx.tenantId), eq(shiftDefinitions.isActive, true)))
      .orderBy(shiftDefinitions.startTime),
    db
      .select({ id: employees.id, name: employees.name, status: employees.status })
      .from(employees)
      .where(
        and(
          eq(employees.tenantId, ctx.tenantId),
          sql`${employees.status} in ('active','probation')`,
        ),
      )
      .orderBy(employees.name),
    db
      .select({
        id: shiftAssignments.id,
        employeeId: shiftAssignments.employeeId,
        workDate: shiftAssignments.workDate,
        kind: shiftAssignments.kind,
        shiftDefinitionId: shiftAssignments.shiftDefinitionId,
      })
      .from(shiftAssignments)
      .where(
        and(
          eq(shiftAssignments.tenantId, ctx.tenantId),
          gte(shiftAssignments.workDate, startStr),
          lte(shiftAssignments.workDate, endStr),
        ),
      ),
  ]);

  const shiftMap = new Map(shiftRows.map((s) => [s.id, s]));
  const empMap = new Map(empRows.map((e) => [e.id, e.name]));

  const assignments: RosterAssignment[] = asnRows.map((r) => {
    const shift = r.shiftDefinitionId ? shiftMap.get(r.shiftDefinitionId) : null;
    return {
      id: r.id,
      employeeId: r.employeeId,
      employeeName: empMap.get(r.employeeId) ?? r.employeeId,
      workDate: String(r.workDate).slice(0, 10),
      kind: r.kind as 'shift' | 'off',
      shiftDefinitionId: r.shiftDefinitionId,
      shiftCode: shift?.code ?? null,
      shiftLabel: shift?.name ?? null,
    };
  });

  return {
    options: {
      shifts: shiftRows.map((s) => ({
        id: s.id,
        code: s.code,
        label: s.name,
        time: `${s.startTime}-${s.endTime}`,
      })),
      employees: empRows.map((e) => ({ id: e.id, name: e.name })),
    },
    assignments,
  };
}

export async function upsertAssignmentAction(input: {
  employeeId: string;
  workDate: string;
  kind: 'shift' | 'off';
  shiftDefinitionId?: string | null;
  notes?: string;
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  const ctx = await buildCtx();
  if (!ctx) return { ok: false, error: 'Unauthenticated' };
  const perm = await requirePermission(ctx.userId, 'hr.manage_attendance');
  if (!perm.ok) return { ok: false, error: 'Forbidden' };

  if (input.kind === 'shift' && !input.shiftDefinitionId) {
    return { ok: false, error: 'Shift wajib dipilih.' };
  }
  if (input.kind === 'off') {
    // For 'off' rows we still upsert one row per (employee,date) with no shift.
  }

  // Find existing
  const conditions = [
    eq(shiftAssignments.employeeId, input.employeeId),
    eq(shiftAssignments.workDate, input.workDate),
  ];
  if (input.shiftDefinitionId) {
    conditions.push(eq(shiftAssignments.shiftDefinitionId, input.shiftDefinitionId));
  } else {
    conditions.push(sql`${shiftAssignments.shiftDefinitionId} is null`);
  }
  const existing = await db
    .select({ id: shiftAssignments.id })
    .from(shiftAssignments)
    .where(and(...conditions))
    .limit(1);

  if (existing[0]) {
    await db
      .update(shiftAssignments)
      .set({
        kind: input.kind,
        shiftDefinitionId: input.shiftDefinitionId ?? null,
        notes: input.notes ?? null,
        updatedBy: ctx.userId,
        updatedAt: new Date(),
      })
      .where(eq(shiftAssignments.id, existing[0].id));

    await db.insert(auditLog).values({
      id: generateId(),
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      action: 'update',
      entityType: 'shift_assignment',
      entityId: existing[0].id,
      after: {
        kind: input.kind,
        shiftDefinitionId: input.shiftDefinitionId ?? null,
      },
    });

    revalidatePath('/hr/schedule');
    return { ok: true, id: existing[0].id };
  }

  const id = generateId();
  await db.insert(shiftAssignments).values({
    id,
    tenantId: ctx.tenantId,
    locationId: ctx.locationId,
    employeeId: input.employeeId,
    workDate: input.workDate,
    kind: input.kind,
    shiftDefinitionId: input.shiftDefinitionId ?? null,
    notes: input.notes ?? null,
    createdBy: ctx.userId,
    updatedBy: ctx.userId,
  });

  await db.insert(auditLog).values({
    id: generateId(),
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: 'create',
    entityType: 'shift_assignment',
    entityId: id,
    after: {
      employeeId: input.employeeId,
      workDate: input.workDate,
      kind: input.kind,
      shiftDefinitionId: input.shiftDefinitionId ?? null,
    },
  });

  revalidatePath('/hr/schedule');
  return { ok: true, id };
}

export async function deleteAssignmentAction(id: string): Promise<{ ok: boolean; error?: string }> {
  const ctx = await buildCtx();
  if (!ctx) return { ok: false, error: 'Unauthenticated' };
  const perm = await requirePermission(ctx.userId, 'hr.manage_attendance');
  if (!perm.ok) return { ok: false, error: 'Forbidden' };
  await db.delete(shiftAssignments).where(eq(shiftAssignments.id, id));

  await db.insert(auditLog).values({
    id: generateId(),
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: 'delete',
    entityType: 'shift_assignment',
    entityId: id,
  });

  revalidatePath('/hr/schedule');
  return { ok: true };
}
