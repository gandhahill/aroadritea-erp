import { db } from '@erp/db';
import { absenceDispensations, attendance, employees, shiftAssignments, shiftDefinitions } from '@erp/db/schema/hr';
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
  dispensedDays: number;
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

  // Query elapsed scheduled days: only shifts whose end time has already passed (WIB).
  // JOIN with shift_definitions to get end_time, then compare (work_date + end_time) <= now().
  const elapsedShiftConds = [
    eq(shiftAssignments.tenantId, ctx.tenantId),
    eq(shiftAssignments.kind, 'shift'),
    sql`${shiftAssignments.workDate} >= ${periodStart}`,
    sql`${shiftAssignments.workDate} <= ${periodEnd}`,
    // Only shifts whose end time has already passed in WIB
    sql`(${shiftAssignments.workDate} || ' ' || coalesce(${shiftDefinitions.endTime}, '23:59'))::timestamp at time zone 'Asia/Jakarta' <= now()`,
  ];
  if (locationFilter) elapsedShiftConds.push(locationFilter);

  const elapsedRows = await db
    .select({
      employeeId: shiftAssignments.employeeId,
      elapsedDays: sql<number>`cast(count(*) as int)`,
    })
    .from(shiftAssignments)
    .leftJoin(shiftDefinitions, eq(shiftAssignments.shiftDefinitionId, shiftDefinitions.id))
    .where(and(...elapsedShiftConds))
    .groupBy(shiftAssignments.employeeId);

  const elapsedMap = new Map(elapsedRows.map((r) => [r.employeeId, r.elapsedDays]));

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

  // Fetch dispensed absence dates per employee
  const { getDispensedCountsForPeriod } = await import('./absence-dispensation-service');
  const dispensedMap = await getDispensedCountsForPeriod(
    ctx.tenantId,
    allEmployeeIds,
    periodStart,
    periodEnd,
  );

  const result: AttendanceSummaryRow[] = allEmployeeIds
    .filter((id) => empNameMap.has(id))
    .map((id) => {
      const scheduled = scheduledMap.get(id) ?? 0;
      const elapsed = elapsedMap.get(id) ?? 0;
      const att = attMap.get(id) ?? { presentDays: 0, lateCount: 0, totalLateMinutes: 0 };
      const dispensed = dispensedMap.get(id) ?? 0;
      // absentDays based only on elapsed shifts (shifts whose end time has passed)
      const rawAbsent = Math.max(0, elapsed - att.presentDays);
      return {
        employeeId: id,
        employeeName: empNameMap.get(id) ?? 'Unknown',
        scheduledDays: scheduled,
        presentDays: att.presentDays,
        absentDays: Math.max(0, rawAbsent - dispensed),
        dispensedDays: Math.min(dispensed, rawAbsent),
        lateCount: att.lateCount,
        totalLateMinutes: att.totalLateMinutes,
      };
    })
    .sort((a, b) => a.employeeName.localeCompare(b.employeeName));

  return ok(result);
}

/**
 * Returns, for each employee in the period, the list of dates they were
 * absent (scheduled but not present) and not yet dispensed.
 *
 * Used by the dispensation modal to populate a dropdown of selectable dates.
 */
export async function getAbsentDatesForPeriod(
  input: { periodMonth: string; locationId?: string; locationIds?: string[] },
  ctx: AuditContext,
): Promise<Result<Map<string, string[]>>> {
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

  // 1. All scheduled shift dates per employee — only shifts whose end time has passed.
  // JOIN with shift_definitions to get end_time so we can check if the shift has ended.
  const shiftConds = [
    eq(shiftAssignments.tenantId, ctx.tenantId),
    eq(shiftAssignments.kind, 'shift'),
    sql`${shiftAssignments.workDate} >= ${periodStart}`,
    sql`${shiftAssignments.workDate} <= ${periodEnd}`,
    // Only shifts whose end time has already passed in WIB
    sql`(${shiftAssignments.workDate} || ' ' || coalesce(${shiftDefinitions.endTime}, '23:59'))::timestamp at time zone 'Asia/Jakarta' <= now()`,
  ];
  if (locationFilter) shiftConds.push(locationFilter);

  const shiftRows = await db
    .select({
      employeeId: shiftAssignments.employeeId,
      workDate: shiftAssignments.workDate,
    })
    .from(shiftAssignments)
    .leftJoin(shiftDefinitions, eq(shiftAssignments.shiftDefinitionId, shiftDefinitions.id))
    .where(and(...shiftConds));

  // Group shift dates per employee
  const scheduledByEmp = new Map<string, Set<string>>();
  for (const row of shiftRows) {
    const set = scheduledByEmp.get(row.employeeId) ?? new Set();
    set.add(row.workDate);
    scheduledByEmp.set(row.employeeId, set);
  }

  const allEmployeeIds = [...scheduledByEmp.keys()];
  if (allEmployeeIds.length === 0) return ok(new Map());

  // 2. Attendance dates per employee (distinct dates they checked in)
  const attLocationFilter = input.locationId
    ? eq(attendance.locationId, input.locationId)
    : input.locationIds && input.locationIds.length > 0
      ? inArray(attendance.locationId, input.locationIds)
      : undefined;

  const attConds = [
    eq(attendance.tenantId, ctx.tenantId),
    isNull(attendance.deletedAt),
    sql`${attendance.checkInAt} >= ${periodStartTz}`,
    sql`${attendance.checkInAt} <= ${periodEndTz}`,
    inArray(attendance.employeeId, allEmployeeIds),
  ];
  if (attLocationFilter) attConds.push(attLocationFilter);

  const attRows = await db
    .select({
      employeeId: attendance.employeeId,
      workDate: sql<string>`date(${attendance.checkInAt} at time zone 'Asia/Jakarta')`,
    })
    .from(attendance)
    .where(and(...attConds));

  const presentByEmp = new Map<string, Set<string>>();
  for (const row of attRows) {
    const set = presentByEmp.get(row.employeeId) ?? new Set();
    set.add(row.workDate);
    presentByEmp.set(row.employeeId, set);
  }

  // 3. Already-dispensed dates per employee
  const dispRows = await db
    .select({
      employeeId: absenceDispensations.employeeId,
      workDate: absenceDispensations.workDate,
    })
    .from(absenceDispensations)
    .where(
      and(
        eq(absenceDispensations.tenantId, ctx.tenantId),
        inArray(absenceDispensations.employeeId, allEmployeeIds),
        sql`${absenceDispensations.workDate} >= ${periodStart}`,
        sql`${absenceDispensations.workDate} <= ${periodEnd}`,
      ),
    );

  const dispensedByEmp = new Map<string, Set<string>>();
  for (const row of dispRows) {
    const set = dispensedByEmp.get(row.employeeId) ?? new Set();
    set.add(row.workDate);
    dispensedByEmp.set(row.employeeId, set);
  }

  // 4. Compute absent = elapsed scheduled - present - dispensed
  const result = new Map<string, string[]>();
  for (const [empId, scheduledDates] of scheduledByEmp) {
    const present = presentByEmp.get(empId) ?? new Set();
    const dispensed = dispensedByEmp.get(empId) ?? new Set();
    const absentDates: string[] = [];
    for (const d of scheduledDates) {
      if (!present.has(d) && !dispensed.has(d)) {
        absentDates.push(d);
      }
    }
    if (absentDates.length > 0) {
      result.set(empId, absentDates.sort());
    }
  }

  return ok(result);
}
