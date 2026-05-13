/**
 * Attendance List Page — SD §21.8 §Attendance
 *
 * Lists attendance records with employee + date filters.
 */

import { getSession } from '@/lib/auth';
import { db, desc, eq, sql } from '@erp/db';
import { attendance, employees, shiftDefinitions } from '@erp/db/schema/hr';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AttendanceListClient } from './attendance-list-client';

export const metadata: Metadata = { title: 'Attendance' };

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ employeeId?: string; dateFrom?: string; dateTo?: string; page?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');

  const tenantId = ((session.user as Record<string, unknown>)?.tenantId as string) ?? 'default';
  const params = await searchParams;
  const employeeId = params.employeeId ?? '';
  const dateFrom = params.dateFrom ?? '';
  const dateTo = params.dateTo ?? '';
  const page = Math.max(1, Number.parseInt(params.page ?? '1', 10));
  const limit = 20;
  const offset = (page - 1) * limit;

  const conditions = [eq(attendance.tenantId, tenantId)];
  if (employeeId) conditions.push(eq(attendance.employeeId, employeeId));
  if (dateFrom) conditions.push(sql`${attendance.checkInAt} >= ${dateFrom}`);
  if (dateTo) conditions.push(sql`${attendance.checkInAt} <= ${dateTo}`);

  const whereClause = sql.join(conditions, sql` AND `);

  const [totalRow] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(attendance)
    .where(whereClause);

  const total = totalRow?.count ?? 0;
  const totalPages = Math.ceil((Number(total) || 0) / limit);

  const rows = await db
    .select({
      id: attendance.id,
      employeeId: attendance.employeeId,
      checkInAt: attendance.checkInAt,
      checkOutAt: attendance.checkOutAt,
      checkInMethod: attendance.checkInMethod,
      isLate: attendance.isLate,
      lateMinutes: attendance.lateMinutes,
      workedMinutes: attendance.workedMinutes,
      shiftCode: attendance.shiftDefinitionCode,
    })
    .from(attendance)
    .where(whereClause)
    .orderBy(desc(attendance.checkInAt))
    .limit(limit)
    .offset(offset);

  // Batch-fetch employee names
  const empIds = [...new Set(rows.map((r) => r.employeeId))];
  let empNames: Map<string, string> = new Map();
  if (empIds.length > 0) {
    const empRows = await db
      .select({ id: employees.id, name: employees.name })
      .from(employees)
      .where(sql`${employees.id} = ANY(${empIds})`);
    empNames = new Map(empRows.map((r) => [r.id, r.name]));
  }

  const items = rows.map((r) => ({
    id: r.id,
    employeeId: r.employeeId,
    employeeName: empNames.get(r.employeeId) ?? 'Unknown',
    shiftCode: r.shiftCode,
    checkInAt: r.checkInAt?.toISOString() ?? '',
    checkOutAt: r.checkOutAt?.toISOString() ?? null,
    checkInMethod: r.checkInMethod,
    isLate: r.isLate,
    lateMinutes: Number(r.lateMinutes),
    workedMinutes: r.workedMinutes ? Number(r.workedMinutes) : null,
  }));

  // Load employees for filter dropdown
  const allEmployees = await db
    .select({ id: employees.id, name: employees.name })
    .from(employees)
    .where(eq(employees.tenantId, tenantId))
    .orderBy(employees.name);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brand-ink">Attendance</h1>
          <p className="mt-1 text-sm text-brand-ink-3">Check-in/out records — {total} entries</p>
        </div>
      </div>

      <AttendanceListClient
        items={items}
        total={Number(total) || 0}
        page={page}
        totalPages={totalPages}
        initialEmployeeId={employeeId}
        initialDateFrom={dateFrom}
        initialDateTo={dateTo}
        employees={allEmployees.map((e) => ({ value: e.id, label: e.name }))}
      />
    </div>
  );
}
