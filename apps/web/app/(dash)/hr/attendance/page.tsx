/**
 * Attendance List Page — SD §21.8 §Attendance
 *
 * Lists attendance records with employee + date filters.
 */

import { PageHeader } from '@/components/page-header';
import { getSession } from '@/lib/auth';
import { authorizedLocationIdsForTenant } from '@/lib/authz';
import { and, db, desc, eq, inArray, isNull, sql } from '@erp/db';
import { attendance, employees } from '@erp/db/schema/hr';
import { users } from '@erp/db/schema/auth';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { AttendanceListClient } from './attendance-list-client';

export const metadata: Metadata = { title: 'Attendance' };

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ employeeId?: string; dateFrom?: string; dateTo?: string; page?: string }>;
}) {
  const session = await getSession();
  if (!session?.user) redirect('/login');

  const user = session.user as Record<string, unknown>;
  const userId = String(user.id ?? '');
  const tenantId = String(user.tenantId ?? 'default');
  const scope = await authorizedLocationIdsForTenant(userId, 'hr.attendance.read', tenantId);
  if (!scope.global && scope.locationIds.length === 0) redirect('/dashboard');

  const params = await searchParams;
  const employeeId = params.employeeId ?? '';
  const dateFrom = params.dateFrom ?? '';
  const dateTo = params.dateTo ?? '';
  const page = Math.max(1, Number.parseInt(params.page ?? '1', 10));
  const limit = 20;
  const offset = (page - 1) * limit;

  // Build WHERE dynamically — use and() (not sql.join) so Drizzle
  // operators like isNull() are properly serialized. sql.join cannot
  // handle the SQLWrapper type returned by isNull/eq and calls
  // Object.entries on its internals, crashing with "Cannot convert
  // undefined or null to object" when the wrapper has no entries map.
  const baseConds = [eq(attendance.tenantId, tenantId), isNull(attendance.deletedAt)];
  if (!scope.global) baseConds.push(inArray(attendance.locationId, scope.locationIds));
  if (employeeId) baseConds.push(eq(attendance.employeeId, employeeId));
  // checkInAt is timestamptz (UTC). Bare date strings like '2026-06-02'
  // cast to midnight UTC, not WIB — a 09:00 WIB check-in (02:00 UTC) would
  // fall outside the range. Append +07:00 so PostgreSQL compares in WIB.
  if (dateFrom) baseConds.push(sql`${attendance.checkInAt} >= ${`${dateFrom}T00:00:00+07:00`}`);
  if (dateTo) baseConds.push(sql`${attendance.checkInAt} < ${`${dateTo}T00:00:00+07:00`}::timestamptz + interval '1 day'`);

  const whereClause = and(...baseConds);

  const [totalRow] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(attendance)
    .where(whereClause!);

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
      lateForgiven: attendance.lateForgiven,
      lateForgivenReason: attendance.lateForgivenReason,
      lateForgivenBy: attendance.lateForgivenBy,
      lateForgivenAt: attendance.lateForgivenAt,
    })
    .from(attendance)
    .where(whereClause!)
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
      .where(
        and(
          eq(employees.tenantId, tenantId),
          inArray(employees.id, empIds),
          isNull(employees.deletedAt),
        ),
      );
    empNames = new Map(empRows.map((r) => [r.id, r.name]));
  }

  // Batch-fetch forgiver display names
  const forgiverIds = [...new Set(rows.map((r) => r.lateForgivenBy).filter(Boolean))] as string[];
  let forgiverNames: Map<string, string> = new Map();
  if (forgiverIds.length > 0) {
    const forgiverRows = await db
      .select({ id: users.id, displayName: users.displayName })
      .from(users)
      .where(inArray(users.id, forgiverIds));
    forgiverNames = new Map(forgiverRows.map((r) => [r.id, r.displayName || r.id]));
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
    lateForgiven: r.lateForgiven,
    lateForgivenReason: r.lateForgivenReason,
    lateForgivenBy: r.lateForgivenBy ? (forgiverNames.get(r.lateForgivenBy) ?? r.lateForgivenBy) : null,
    lateForgivenAt: r.lateForgivenAt?.toISOString() ?? null,
  }));

  // Load employees for filter dropdown
  const employeeConds = [
    eq(employees.tenantId, tenantId),
    isNull(employees.deletedAt),
  ];
  if (!scope.global) employeeConds.push(inArray(employees.locationId, scope.locationIds));
  const allEmployees = await db
    .select({ id: employees.id, name: employees.name })
    .from(employees)
    .where(and(...employeeConds))
    .orderBy(employees.name);

  const t = await getTranslations('hr.attendance');

  return (
    <div className="space-y-6">
      <PageHeader title={<>{t('title')}</>} description={<>{t('subtitle', { total })}</>} />

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
