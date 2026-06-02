'use server';

import { getSession } from '@/lib/auth';
import { authorizedLocationIdsForTenant } from '@/lib/authz';
import { and, db, eq, gte, inArray, lte, sql, isNull } from '@erp/db';
import { auditLog } from '@erp/db/schema/audit';
import { locations } from '@erp/db/schema/auth';
import {
  employees,
  scheduleOverrides,
  shiftAssignments,
  shiftDefinitions,
} from '@erp/db/schema/hr';
import { requirePermission } from '@erp/services/iam';
import { notifyUserByEmail } from '@erp/services/notification';
import { generateId } from '@erp/shared/id';
import type { AuditContext } from '@erp/shared/types';
import { revalidatePath } from 'next/cache';

/**
 * T-0175 — fan-out a shift change notification (in-app + email) to the
 * affected employee. Best-effort: the schedule mutation must not fail
 * just because email is unreachable.
 *
 * `action` describes the change so the email can read naturally:
 *   - 'created'  → "Shift baru ditambahkan untuk Anda"
 *   - 'updated'  → "Shift Anda diperbarui"
 *   - 'deleted'  → "Shift Anda dihapus"
 */
async function notifyShiftChange(args: {
  tenantId: string;
  employeeId: string;
  action: 'created' | 'updated' | 'deleted';
  workDate: string;
  shiftLabel: string | null;
  kind: 'shift' | 'off';
  locationLabel: string | null;
  notes?: string | null;
}): Promise<void> {
  try {
    const [employee] = await db
      .select({ name: employees.name, email: employees.email })
      .from(employees)
      .where(and(eq(employees.tenantId, args.tenantId), eq(employees.id, args.employeeId)))
      .limit(1);
    if (!employee?.email) return;

    const labels = {
      created: {
        id: 'Jadwal shift baru',
        en: 'New shift scheduled',
        zh: '新班次已安排',
      },
      updated: {
        id: 'Jadwal shift diperbarui',
        en: 'Shift schedule updated',
        zh: '班次安排已更新',
      },
      deleted: {
        id: 'Jadwal shift dibatalkan',
        en: 'Shift schedule cancelled',
        zh: '班次安排已取消',
      },
    } as const;
    const verb = labels[args.action];

    const shiftLine =
      args.kind === 'off' ? 'Status: hari libur (off)' : `Shift: ${args.shiftLabel ?? '—'}`;

    const titleBahasa = `${verb.id} — ${args.workDate}`;
    const bodyBahasa = [
      `Hai ${employee.name},`,
      '',
      `${verb.id} untuk tanggal ${args.workDate}.`,
      shiftLine,
      args.locationLabel ? `Lokasi: ${args.locationLabel}` : null,
      args.notes ? `Catatan: ${args.notes}` : null,
      '',
      'Mohon dicek di Aroadri Tea ERP → HR → Schedule. Jika ada pertanyaan, hubungi atasan langsung.',
    ]
      .filter(Boolean)
      .join('\n');

    const html =
      `<p>Hai <strong>${escapeHtml(employee.name)}</strong>,</p>` +
      `<p>${escapeHtml(verb.id)} untuk tanggal <strong>${escapeHtml(args.workDate)}</strong>.</p>` +
      `<ul>` +
      `<li>${escapeHtml(shiftLine)}</li>` +
      (args.locationLabel ? `<li>Lokasi: ${escapeHtml(args.locationLabel)}</li>` : '') +
      (args.notes ? `<li>Catatan: ${escapeHtml(args.notes)}</li>` : '') +
      `</ul>` +
      `<p>Buka aplikasi Aroadri Tea ERP → HR → Schedule untuk detail.</p>`;

    await notifyUserByEmail({
      tenantId: args.tenantId,
      email: employee.email,
      kind: 'shift',
      title: titleBahasa,
      body: bodyBahasa,
      link: '/hr/schedule',
      email_template: {
        subject: `[Aroadri Tea] ${titleBahasa}`,
        text: bodyBahasa,
        html,
      },
    });
  } catch {
    // Notification is best-effort.
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function resolveShiftLabel(
  shiftDefinitionId: string | null | undefined,
): Promise<string | null> {
  if (!shiftDefinitionId) return null;
  const [s] = await db
    .select({
      code: shiftDefinitions.code,
      name: shiftDefinitions.name,
      startTime: shiftDefinitions.startTime,
      endTime: shiftDefinitions.endTime,
    })
    .from(shiftDefinitions)
    .where(eq(shiftDefinitions.id, shiftDefinitionId))
    .limit(1);
  if (!s) return null;
  // shift_definitions.name is plain text in the schema (per locale
  // staff naming convention), so no LocaleString unwrap needed.
  const label = s.name || s.code;
  return `${label} ${s.startTime}-${s.endTime}`;
}

async function resolveLocationLabel(locationId: string | null | undefined): Promise<string | null> {
  if (!locationId) return null;
  const [loc] = await db
    .select({ name: locations.name, code: locations.code })
    .from(locations)
    .where(eq(locations.id, locationId))
    .limit(1);
  if (!loc) return null;
  const localised = loc.name as unknown as Record<string, string> | null;
  return localised?.id ?? localised?.en ?? loc.code;
}

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
  locationId: string;
  workDate: string;
  kind: 'shift' | 'off';
  shiftDefinitionId: string | null;
  shiftCode: string | null;
  shiftLabel: string | null;
}

export interface RosterOptions {
  shifts: Array<{ id: string; code: string; label: string; time: string; locationId: string }>;
  employees: Array<{ id: string; name: string; locationId: string; locationName?: string }>;
}

export async function fetchRoster(
  weekStart: string,
  locationId?: string,
): Promise<{
  options: RosterOptions;
  assignments: RosterAssignment[];
}> {
  const ctx = await buildCtx();
  if (!ctx) return { options: { shifts: [], employees: [] }, assignments: [] };
  const locationScope = await authorizedLocationIdsForTenant(
    ctx.userId,
    'hr.manage_attendance',
    ctx.tenantId,
  );
  if (!locationScope.global && locationScope.locationIds.length === 0) {
    return { options: { shifts: [], employees: [] }, assignments: [] };
  }
  // For global scope without specific location, we need all locations
  const isGlobal = locationScope.global;
  const allowedLocationIds = locationId
    ? isGlobal || locationScope.locationIds.includes(locationId)
      ? [locationId]
      : []
    : isGlobal
      ? null // null = no location filter (global access)
      : locationScope.locationIds;
  if (allowedLocationIds !== null && allowedLocationIds.length === 0) {
    return { options: { shifts: [], employees: [] }, assignments: [] };
  }

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
        locationId: shiftDefinitions.locationId,
        locationName: locations.name,
      })
      .from(shiftDefinitions)
      .leftJoin(locations, eq(shiftDefinitions.locationId, locations.id))
      .where(
        and(
          eq(shiftDefinitions.tenantId, ctx.tenantId),
          eq(shiftDefinitions.isActive, true),
          isNull(shiftDefinitions.deletedAt),
          ...(allowedLocationIds
            ? [inArray(shiftDefinitions.locationId, allowedLocationIds)]
            : []),
        ),
      )
      .orderBy(shiftDefinitions.startTime),
    db
      .select({
        id: employees.id,
        name: employees.name,
        status: employees.status,
        locationId: employees.locationId,
        locationName: locations.name,
      })
      .from(employees)
      .leftJoin(locations, eq(employees.locationId, locations.id))
      .where(
        and(
          eq(employees.tenantId, ctx.tenantId),
          sql`${employees.status} in ('active','probation')`,
          ...(allowedLocationIds
            ? [inArray(employees.locationId, allowedLocationIds)]
            : []),
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
        locationId: shiftAssignments.locationId,
      })
      .from(shiftAssignments)
      .where(
        and(
          eq(shiftAssignments.tenantId, ctx.tenantId),
          isNull(shiftAssignments.deletedAt),
          ...(allowedLocationIds
            ? [inArray(shiftAssignments.locationId, allowedLocationIds)]
            : []),
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
      locationId: r.locationId,
      workDate: String(r.workDate).slice(0, 10),
      kind: r.kind as 'shift' | 'off',
      shiftDefinitionId: r.shiftDefinitionId,
      shiftCode: shift?.code ?? null,
      shiftLabel: shift?.name ?? null,
    };
  });

  return {
    options: {
      shifts: shiftRows.map((s) => {
        const locNameRaw = s.locationName as Record<string, string> | null;
        const locStr = locNameRaw ? locNameRaw['id'] || locNameRaw['en'] || '' : '';
        const suffix = locStr ? ` (${locStr})` : '';
        return {
          id: s.id,
          code: s.code,
          label: `${s.name} ${s.startTime}-${s.endTime}${suffix}`,
          time: `${s.startTime}-${s.endTime}`,
          locationId: s.locationId,
        };
      }),
      employees: empRows.map((e) => {
        const locNameRaw = e.locationName as Record<string, string> | null;
        const locStr = locNameRaw ? locNameRaw['id'] || locNameRaw['en'] || '' : '';
        return {
          id: e.id,
          name: e.name,
          locationId: e.locationId,
          locationName: locStr,
        };
      }),
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

  if (input.kind === 'shift' && !input.shiftDefinitionId) {
    return { ok: false, error: 'Shift wajib dipilih.' };
  }
  if (input.kind === 'off') {
    // For 'off' rows we still upsert one row per (employee,date) with no shift.
  }

  const [employee] = await db
    .select({ id: employees.id, locationId: employees.locationId })
    .from(employees)
    .where(and(eq(employees.tenantId, ctx.tenantId), eq(employees.id, input.employeeId)))
    .limit(1);
  if (!employee) return { ok: false, error: 'Employee not found' };

  let targetLocationId = employee.locationId;
  if (input.shiftDefinitionId) {
    const [sd] = await db
      .select({ locationId: shiftDefinitions.locationId })
      .from(shiftDefinitions)
      .where(
        and(
          eq(shiftDefinitions.tenantId, ctx.tenantId),
          eq(shiftDefinitions.id, input.shiftDefinitionId),
          eq(shiftDefinitions.isActive, true),
          isNull(shiftDefinitions.deletedAt),
        ),
      );
    if (!sd) return { ok: false, error: 'Shift not found' };
    if (sd.locationId !== employee.locationId) {
      return { ok: false, error: 'hr.schedule.errors.shiftLocationMismatch' };
    }
    targetLocationId = sd.locationId;
  }
  const perm = await requirePermission(ctx.userId, 'hr.manage_attendance', {
    locationId: targetLocationId,
  });
  if (!perm.ok) return { ok: false, error: 'Forbidden' };

  // Find existing
  const conditions = [
    eq(shiftAssignments.tenantId, ctx.tenantId),
    eq(shiftAssignments.employeeId, input.employeeId),
    eq(shiftAssignments.workDate, input.workDate),
    isNull(shiftAssignments.deletedAt),
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
        locationId: targetLocationId,
        shiftDefinitionId: input.shiftDefinitionId ?? null,
        notes: input.notes ?? null,
        updatedBy: ctx.userId,
        updatedAt: new Date(),
      })
      .where(
        and(eq(shiftAssignments.tenantId, ctx.tenantId), eq(shiftAssignments.id, existing[0].id)),
      );

    await db.insert(auditLog).values({
      id: generateId(),
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      action: 'update',
      entityType: 'shift_assignment',
      entityId: existing[0].id,
      after: {
        kind: input.kind,
        locationId: targetLocationId,
        shiftDefinitionId: input.shiftDefinitionId ?? null,
      },
    });

    // T-0175 — notify the affected employee. Resolve label data in
    // parallel so the notification fan-out adds < 100 ms.
    const [shiftLabel, locationLabel] = await Promise.all([
      resolveShiftLabel(input.shiftDefinitionId),
      resolveLocationLabel(targetLocationId),
    ]);
    void notifyShiftChange({
      tenantId: ctx.tenantId,
      employeeId: input.employeeId,
      action: 'updated',
      workDate: input.workDate,
      shiftLabel,
      kind: input.kind,
      locationLabel,
      notes: input.notes ?? null,
    });

    revalidatePath('/hr/schedule');
    return { ok: true, id: existing[0].id };
  }

  const id = generateId();
  await db.insert(shiftAssignments).values({
    id,
    tenantId: ctx.tenantId,
    locationId: targetLocationId,
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

  // T-0175 — same fan-out for the brand-new assignment branch.
  const [shiftLabel, locationLabel] = await Promise.all([
    resolveShiftLabel(input.shiftDefinitionId),
    resolveLocationLabel(targetLocationId),
  ]);
  void notifyShiftChange({
    tenantId: ctx.tenantId,
    employeeId: input.employeeId,
    action: 'created',
    workDate: input.workDate,
    shiftLabel,
    kind: input.kind,
    locationLabel,
    notes: input.notes ?? null,
  });

  revalidatePath('/hr/schedule');
  return { ok: true, id };
}

export async function deleteAssignmentAction(id: string): Promise<{ ok: boolean; error?: string }> {
  const ctx = await buildCtx();
  if (!ctx) return { ok: false, error: 'Unauthenticated' };

  // Snapshot the row BEFORE deletion so we can still resolve the
  // employee + work date for the notification.
  const [snapshot] = await db
    .select({
      employeeId: shiftAssignments.employeeId,
      workDate: shiftAssignments.workDate,
      kind: shiftAssignments.kind,
      shiftDefinitionId: shiftAssignments.shiftDefinitionId,
      locationId: shiftAssignments.locationId,
      notes: shiftAssignments.notes,
    })
    .from(shiftAssignments)
    .where(and(eq(shiftAssignments.tenantId, ctx.tenantId), eq(shiftAssignments.id, id)))
    .limit(1);
  if (!snapshot) return { ok: false, error: 'Not found' };
  const perm = await requirePermission(ctx.userId, 'hr.manage_attendance', {
    locationId: snapshot.locationId,
  });
  if (!perm.ok) return { ok: false, error: 'Forbidden' };

  await db
    .delete(shiftAssignments)
    .where(and(eq(shiftAssignments.tenantId, ctx.tenantId), eq(shiftAssignments.id, id)));

  await db.insert(auditLog).values({
    id: generateId(),
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: 'delete',
    entityType: 'shift_assignment',
    entityId: id,
  });

  if (snapshot) {
    const [shiftLabel, locationLabel] = await Promise.all([
      resolveShiftLabel(snapshot.shiftDefinitionId),
      resolveLocationLabel(snapshot.locationId),
    ]);
    void notifyShiftChange({
      tenantId: ctx.tenantId,
      employeeId: snapshot.employeeId,
      action: 'deleted',
      workDate: String(snapshot.workDate).slice(0, 10),
      shiftLabel,
      kind: snapshot.kind as 'shift' | 'off',
      locationLabel,
      notes: snapshot.notes ?? null,
    });
  }

  revalidatePath('/hr/schedule');
  return { ok: true };
}

/**
 * Swap a shift assignment to a different employee for the same date —
 * T-0182. Records the swap in `schedule_overrides` for traceability
 * and fans out a "schedule changed" notification to BOTH the original
 * employee (now off) and the substitute (now on).
 *
 * Permission: `hr.manage_attendance` — same as upsert/delete.
 */
export async function swapShiftAssignmentAction(input: {
  assignmentId: string;
  substituteEmployeeId: string;
  reason: string;
}): Promise<{ ok: boolean; error?: string; newAssignmentId?: string }> {
  const ctx = await buildCtx();
  if (!ctx) return { ok: false, error: 'Unauthenticated' };

  if (!input.reason?.trim() || input.reason.trim().length < 3) {
    return { ok: false, error: 'Alasan minimal 3 karakter.' };
  }
  if (!input.substituteEmployeeId) {
    return { ok: false, error: 'Pilih karyawan pengganti.' };
  }

  // Load the original assignment so we know who/what to swap.
  const [original] = await db
    .select()
    .from(shiftAssignments)
    .where(
      and(
        eq(shiftAssignments.tenantId, ctx.tenantId),
        eq(shiftAssignments.id, input.assignmentId),
        isNull(shiftAssignments.deletedAt),
      ),
    )
    .limit(1);
  if (!original) {
    return { ok: false, error: 'Assignment tidak ditemukan.' };
  }
  const perm = await requirePermission(ctx.userId, 'hr.manage_attendance', {
    locationId: original.locationId,
  });
  if (!perm.ok) return { ok: false, error: 'Forbidden' };
  if (original.employeeId === input.substituteEmployeeId) {
    return { ok: false, error: 'Karyawan pengganti sama dengan asal.' };
  }
  const [substitute] = await db
    .select({ id: employees.id, locationId: employees.locationId })
    .from(employees)
    .where(and(eq(employees.tenantId, ctx.tenantId), eq(employees.id, input.substituteEmployeeId)))
    .limit(1);
  if (!substitute) return { ok: false, error: 'Karyawan pengganti tidak ditemukan.' };
  const substitutePerm = await requirePermission(ctx.userId, 'hr.manage_attendance', {
    locationId: substitute.locationId,
  });
  if (!substitutePerm.ok) return { ok: false, error: 'Forbidden' };
  if (substitute.locationId !== original.locationId) {
    return { ok: false, error: 'hr.schedule.errors.swapLocationMismatch' };
  }

  // Disallow swap if the substitute already has a row for the same
  // date+shift — they can't work the same slot twice.
  const conflictConds = [
    eq(shiftAssignments.tenantId, ctx.tenantId),
    eq(shiftAssignments.employeeId, input.substituteEmployeeId),
    eq(shiftAssignments.workDate, original.workDate),
    isNull(shiftAssignments.deletedAt),
  ];
  if (original.shiftDefinitionId) {
    conflictConds.push(eq(shiftAssignments.shiftDefinitionId, original.shiftDefinitionId));
  } else {
    conflictConds.push(sql`${shiftAssignments.shiftDefinitionId} is null`);
  }
  const conflicting = await db
    .select({ id: shiftAssignments.id })
    .from(shiftAssignments)
    .where(and(...conflictConds))
    .limit(1);
  if (conflicting.length > 0) {
    return { ok: false, error: 'Karyawan pengganti sudah punya shift di slot ini.' };
  }

  // Re-point the assignment to the substitute. We mutate in place
  // (rather than delete+insert) so all downstream FKs (attendance,
  // notifications) keep pointing at the same row id.
  const updated = await db
    .update(shiftAssignments)
    .set({
      employeeId: input.substituteEmployeeId,
      updatedBy: ctx.userId,
      updatedAt: new Date(),
    })
    .where(and(eq(shiftAssignments.tenantId, ctx.tenantId), eq(shiftAssignments.id, original.id)))
    .returning({ id: shiftAssignments.id });
  if (!updated || updated.length === 0) {
    return { ok: false, error: 'Gagal memperbarui assignment.' };
  }

  // Record the override for traceability.
  const overrideId = generateId();
  await db.insert(scheduleOverrides).values({
    id: overrideId,
    tenantId: ctx.tenantId,
    locationId: original.locationId,
    workDate: original.workDate,
    shiftDefinitionId: original.shiftDefinitionId ?? null,
    originalEmployeeId: original.employeeId,
    substituteEmployeeId: input.substituteEmployeeId,
    reason: input.reason.trim(),
    newAssignmentId: original.id,
    createdBy: ctx.userId,
    updatedBy: ctx.userId,
  });

  // Audit — use the shared helper so the immutable trigger + entity-type
  // whitelist + PII scrub all apply uniformly.
  await db.insert(auditLog).values({
    id: generateId(),
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: 'update',
    entityType: 'schedule_override',
    entityId: overrideId,
    before: { employeeId: original.employeeId, assignmentId: original.id } as Record<
      string,
      unknown
    >,
    after: {
      substituteEmployeeId: input.substituteEmployeeId,
      workDate: String(original.workDate).slice(0, 10),
      reason: input.reason.trim(),
    } as Record<string, unknown>,
    metadata: null,
  });

  // Notify both sides.
  const [shiftLabel, locationLabel] = await Promise.all([
    resolveShiftLabel(original.shiftDefinitionId),
    resolveLocationLabel(original.locationId),
  ]);
  const workDateStr = String(original.workDate).slice(0, 10);
  void notifyShiftChange({
    tenantId: ctx.tenantId,
    employeeId: original.employeeId,
    action: 'deleted',
    workDate: workDateStr,
    shiftLabel,
    kind: original.kind as 'shift' | 'off',
    locationLabel,
    notes: `Digantikan: ${input.reason.trim()}`,
  });
  void notifyShiftChange({
    tenantId: ctx.tenantId,
    employeeId: input.substituteEmployeeId,
    action: 'created',
    workDate: workDateStr,
    shiftLabel,
    kind: original.kind as 'shift' | 'off',
    locationLabel,
    notes: `Menggantikan rekan: ${input.reason.trim()}`,
  });

  revalidatePath('/hr/schedule');
  return { ok: true, newAssignmentId: original.id };
}
