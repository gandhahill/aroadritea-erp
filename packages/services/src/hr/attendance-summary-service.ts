import { db } from '@erp/db';
import { attendance, employees, shiftAssignments } from '@erp/db/schema/hr';
import { AppError } from '@erp/shared/errors';
import { type Result, err, ok } from '@erp/shared/result';
import type { AuditContext } from '@erp/shared/types';
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { requirePermission } from '../iam';

export interface AttendanceSummaryRow {
  employeeId: string;
  employeeName: string;
  scheduledDays: number;
  presentDays: number;
  absentDays: number;
  lateCount: number;
  totalLateMinutes: number;
}

export async function listAttendanceSummary(
  input: { periodMonth: string; locationId?: string; locationIds?: string[] },
  ctx: AuditContext,
): Promise<Result<AttendanceSummaryRow[]>> {
  const permCheck = await requirePermission(ctx.userId, 'hr.attendance.read', {
    locationId: input.locationId ?? ctx.locationId,
  });
  if (!permCheck.ok) return permCheck;

  const [yearStr, monthStr] = input.periodMonth.split('-');
  if (!yearStr || !monthStr) {
    return err(AppError.validation('hr.attendance.invalidPeriod'));
  }
  const year = Number.parseInt(yearStr, 10);
  const month = Number.parseInt(monthStr, 10);
  const periodStart = `${yearStr}-${monthStr.padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const periodEnd = `${yearStr}-${monthStr.padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  const periodStartTz = `${periodStart}T00:00:00+07:00`;
  const periodEndTz = `${periodEnd}T23:59:59+07:00`;

  const locationFilter = input.locationId
    ? eq(shiftAssignments.locationId, input.locationId)
    : input.locationIds && input.locationIds.length > 0
      ? inArray(shiftAssignments.locationId, input.locationIds)
      : undefined;

  const attLocationFilter = input.locationId
    ? eq(attendance.locationId, input.locationId)
    : input.locationIds && input.locationIds.length > 0
      ? inArray(attendance.locationId, input.locationIds)
      : undefined;

  const shiftConds = [
    eq(shiftAssignments.tenantId, ctx.tenantId),
    eq(shiftAssignments.kind, 'shift'),
    sql`${shiftAssignments.workDate} >= ${periodStart}`,
    sql`${shiftAssignments.workDate} <= ${periodEnd}`,
  ];
  if (locationFilter) shiftConds.push(locationFilter);

  const scheduledRows = await db
    .select({
      employeeId: shiftAssignments.employeeId,
      scheduledDays: sql<number>`cast(count(*) as int)`,
    })
    .from(shiftAssignments)
    .where(and(...shiftConds))
    .groupBy(shiftAssignments.employeeId);

  const scheduledMap = new Map(scheduledRows.map((r) => [r.employeeId, r.scheduledDays]));

  const attConds = [
    eq(attendance.tenantId, ctx.tenantId),
    isNull(attendance.deletedAt),
    sql`${attendance.checkInAt} >= ${periodStartTz}`,
    sql`${attendance.checkInAt} <= ${periodEndTz}`,
  ];
  if (attLocationFilter) attConds.push(attLocationFilter);

  const attRows = await db
    .select({
      employeeId: attendance.employeeId,
      presentDays: sql<number>`cast(count(distinct date(${attendance.checkInAt} at time zone 'Asia/Jakarta')) as int)`,
      lateCount: sql<number>`cast(count(case when ${attendance.isLate} and not ${attendance.lateForgiven} then 1 end) as int)`,
      totalLateMinutes: sql<number>`coalesce(sum(case when not ${attendance.lateForgiven} then ${attendance.lateMinutes} else 0 end), 0)`,
    })
    .from(attendance)
    .where(and(...attConds))
    .groupBy(attendance.employeeId);

  const attMap = new Map(
    attRows.map((r) => [
      r.employeeId,
      {
        presentDays: r.presentDays,
        lateCount: r.lateCount,
        totalLateMinutes: r.totalLateMinutes,
      },
    ]),
  );

  const allEmployeeIds = [...new Set([...scheduledMap.keys(), ...attMap.keys()])];
  if (allEmployeeIds.length === 0) return ok([]);

  const empRows = await db
    .select({ id: employees.id, name: employees.name })
    .from(employees)
    .where(
      and(
        eq(employees.tenantId, ctx.tenantId),
        inArray(employees.id, allEmployeeIds),
        isNull(employees.deletedAt),
      ),
    );
  const empNameMap = new Map(empRows.map((e) => [e.id, e.name]));

  const result: AttendanceSummaryRow[] = allEmployeeIds
    .filter((id) => empNameMap.has(id))
    .map((id) => {
      const scheduled = scheduledMap.get(id) ?? 0;
      const att = attMap.get(id) ?? { presentDays: 0, lateCount: 0, totalLateMinutes: 0 };
      return {
        employeeId: id,
        employeeName: empNameMap.get(id) ?? 'Unknown',
        scheduledDays: scheduled,
        presentDays: att.presentDays,
        absentDays: Math.max(0, scheduled - att.presentDays),
        lateCount: att.lateCount,
        totalLateMinutes: att.totalLateMinutes,
      };
    })
    .sort((a, b) => a.employeeName.localeCompare(b.employeeName));

  return ok(result);
}
