import { db } from '@erp/db';
import { absenceDispensations } from '@erp/db/schema/hr';
import { users } from '@erp/db/schema/auth';
import { AppError } from '@erp/shared/errors';
import { type Result, err, ok } from '@erp/shared/result';
import type { AuditContext } from '@erp/shared/types';
import { generateId } from '@erp/shared/id';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { requirePermission } from '../iam';
import { auditRecord } from '../audit';

export async function createAbsenceDispensation(
  input: { employeeId: string; dates: string[]; reason: string },
  ctx: AuditContext,
): Promise<Result<{ count: number }>> {
  if (!input.dates.length || !input.reason || input.reason.trim().length < 3) {
    return err(AppError.validation('hr.attendance.dispensationValidation'));
  }

  const permCheck = await requirePermission(ctx.userId, 'hr.manage_attendance', {
    locationId: ctx.locationId,
  });
  if (!permCheck.ok) return permCheck;

  const values = input.dates.map((d) => ({
    id: generateId(),
    tenantId: ctx.tenantId,
    employeeId: input.employeeId,
    workDate: d,
    reason: input.reason.trim(),
    createdBy: ctx.userId,
    updatedBy: ctx.userId,
  }));

  await db
    .insert(absenceDispensations)
    .values(values)
    .onConflictDoNothing();

  await auditRecord({
    action: 'forgive_late',
    entityType: 'absence_dispensation',
    entityId: input.employeeId,
    before: null,
    after: { dates: input.dates, reason: input.reason },
    metadata: {},
    ctx,
  });

  return ok({ count: values.length });
}

export async function getDispensedDates(
  tenantId: string,
  employeeId: string,
  periodStart: string,
  periodEnd: string,
): Promise<Set<string>> {
  const rows = await db
    .select({ workDate: absenceDispensations.workDate })
    .from(absenceDispensations)
    .where(
      and(
        eq(absenceDispensations.tenantId, tenantId),
        eq(absenceDispensations.employeeId, employeeId),
        sql`${absenceDispensations.workDate} >= ${periodStart}`,
        sql`${absenceDispensations.workDate} <= ${periodEnd}`,
      ),
    );
  return new Set(rows.map((r) => r.workDate));
}

export async function getDispensedCountsForPeriod(
  tenantId: string,
  employeeIds: string[],
  periodStart: string,
  periodEnd: string,
): Promise<Map<string, number>> {
  if (employeeIds.length === 0) return new Map();

  const rows = await db
    .select({
      employeeId: absenceDispensations.employeeId,
      count: sql<number>`cast(count(*) as int)`,
    })
    .from(absenceDispensations)
    .where(
      and(
        eq(absenceDispensations.tenantId, tenantId),
        inArray(absenceDispensations.employeeId, employeeIds),
        sql`${absenceDispensations.workDate} >= ${periodStart}`,
        sql`${absenceDispensations.workDate} <= ${periodEnd}`,
      ),
    )
    .groupBy(absenceDispensations.employeeId);

  return new Map(rows.map((r) => [r.employeeId, r.count]));
}

export interface DispensationDetail {
  workDate: string;
  reason: string;
  givenBy?: string | null;
}

export async function getDispensedDetailsForPeriod(
  tenantId: string,
  employeeIds: string[],
  periodStart: string,
  periodEnd: string,
): Promise<Map<string, DispensationDetail[]>> {
  if (employeeIds.length === 0) return new Map();

  const rows = await db
    .select({
      employeeId: absenceDispensations.employeeId,
      workDate: absenceDispensations.workDate,
      reason: absenceDispensations.reason,
      givenBy: users.displayName,
    })
    .from(absenceDispensations)
    .leftJoin(users, eq(absenceDispensations.createdBy, users.id))
    .where(
      and(
        eq(absenceDispensations.tenantId, tenantId),
        inArray(absenceDispensations.employeeId, employeeIds),
        sql`${absenceDispensations.workDate} >= ${periodStart}`,
        sql`${absenceDispensations.workDate} <= ${periodEnd}`,
      ),
    )
    .orderBy(absenceDispensations.workDate);

  const map = new Map<string, DispensationDetail[]>();
  for (const r of rows) {
    const list = map.get(r.employeeId) ?? [];
    list.push({ workDate: r.workDate, reason: r.reason, givenBy: r.givenBy });
    map.set(r.employeeId, list);
  }
  return map;
}

export async function revokeAbsenceDispensation(
  input: { employeeId: string; dates: string[] },
  ctx: AuditContext,
): Promise<Result<{ count: number }>> {
  if (!input.dates.length) return ok({ count: 0 });

  const permCheck = await requirePermission(ctx.userId, 'hr.manage_attendance', {
    locationId: ctx.locationId,
  });
  if (!permCheck.ok) return permCheck;

  await db
    .delete(absenceDispensations)
    .where(
      and(
        eq(absenceDispensations.tenantId, ctx.tenantId),
        eq(absenceDispensations.employeeId, input.employeeId),
        inArray(absenceDispensations.workDate, input.dates)
      )
    );

  await auditRecord({
    action: 'delete',
    entityType: 'absence_dispensation',
    entityId: input.employeeId,
    before: { dates: input.dates },
    after: null,
    metadata: {},
    ctx,
  });

  return ok({ count: input.dates.length });
}
