import { and, db, eq, gte, lte } from '@erp/db';
import { shiftAssignments, shiftDefinitions } from '@erp/db/schema/hr';
import { Result } from '@erp/shared/result';
import type { AuditContext } from '@erp/shared/types';

export interface MyScheduleRow {
  id: string;
  workDate: string;
  kind: 'shift' | 'off';
  shiftCode: string | null;
  shiftName: string | null;
  startTime: string | null;
  endTime: string | null;
  notes: string | null;
}

/**
 * listMySchedule — Fetch upcoming and past shifts for the logged-in employee.
 * Does not require HR permissions, purely self-service based on ctx.userId.
 */
export async function listMySchedule(
  params: { dateFrom: string; dateTo: string },
  ctx: AuditContext,
): Promise<Result<MyScheduleRow[], string>> {
  try {
    const rows = await db
      .select({
        id: shiftAssignments.id,
        workDate: shiftAssignments.workDate,
        kind: shiftAssignments.kind,
        notes: shiftAssignments.notes,
        shiftCode: shiftDefinitions.code,
        shiftName: shiftDefinitions.name,
        startTime: shiftDefinitions.startTime,
        endTime: shiftDefinitions.endTime,
      })
      .from(shiftAssignments)
      .leftJoin(shiftDefinitions, eq(shiftAssignments.shiftDefinitionId, shiftDefinitions.id))
      .where(
        and(
          eq(shiftAssignments.tenantId, ctx.tenantId),
          // We map user.id to employee.id. In this system they match.
          eq(shiftAssignments.employeeId, ctx.userId),
          gte(shiftAssignments.workDate, params.dateFrom),
          lte(shiftAssignments.workDate, params.dateTo),
        ),
      )
      .orderBy(shiftAssignments.workDate);

    return Result.ok(
      rows.map((r) => ({
        id: r.id,
        workDate: String(r.workDate).slice(0, 10),
        kind: r.kind as 'shift' | 'off',
        notes: r.notes,
        shiftCode: r.shiftCode,
        shiftName: r.shiftName,
        startTime: r.startTime,
        endTime: r.endTime,
      })),
    );
  } catch (error: any) {
    return Result.err(error.message || 'Failed to list schedule');
  }
}
