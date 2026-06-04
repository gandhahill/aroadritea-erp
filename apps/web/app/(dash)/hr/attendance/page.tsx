/**
 * Attendance Page — SD §21.8 §Attendance
 *
 * Two tabs:
 * - "Daftar" (default): individual check-in/out records
 * - "Ringkasan": monthly per-employee summary (scheduled vs present vs absent)
 */

import { PageHeader } from '@/components/page-header';
import { getSession } from '@/lib/auth';
import { authorizedLocationIdsForTenant } from '@/lib/authz';
import { and, db, desc, eq, inArray, isNull, sql } from '@erp/db';
import { attendance, employees } from '@erp/db/schema/hr';
import { locations } from '@erp/db/schema/auth';
import { users } from '@erp/db/schema/auth';
import { listAttendanceSummary } from '@erp/services/hr';
import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { AttendanceListClient } from './attendance-list-client';
import { AttendanceSummaryClient } from './attendance-summary-client';

export const metadata: Metadata = { title: 'Attendance' };

function pickName(name: unknown, locale: string, fallback: string = ''): string {
  if (!name || typeof name !== 'object') return fallback;
  const value = name as Record<string, string | undefined>;
  return value[locale] ?? value.id ?? value.en ?? value.zh ?? fallback;
}

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    employeeId?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: string;
    period?: string;
    locationId?: string;
  }>;
}) {
  const session = await getSession();
  if (!session?.user) redirect('/login');

  const user = session.user as Record<string, unknown>;
  const userId = String(user.id ?? '');
  const tenantId = String(user.tenantId ?? 'default');
  const scope = await authorizedLocationIdsForTenant(userId, 'hr.attendance.read', tenantId);
  if (!scope.global && scope.locationIds.length === 0) redirect('/dashboard');

  const params = await searchParams;
  const activeTab = params.tab === 'ringkasan' ? 'ringkasan' : 'daftar';

  const t = await getTranslations('hr.attendance');
  const locale = await getLocale();

  // Fetch locations for the summary tab filter
  const locConds = [eq(locations.tenantId, tenantId)];
  if (!scope.global) locConds.push(inArray(locations.id, scope.locationIds));
  const locRows = await db
    .select({ id: locations.id, name: locations.name, code: locations.code })
    .from(locations)
    .where(and(...locConds))
    .orderBy(locations.name);
  const locationOptions = locRows.map((l) => ({
    id: l.id,
    name: pickName(l.name, locale, l.code),
  }));

  if (activeTab === 'ringkasan') {
    const now = new Date();
    const defaultPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const period = params.period || defaultPeriod;
    const locationId = params.locationId || '';

    const ctx = {
      tenantId,
      userId,
      locationId: locationId || String(user.locationId ?? ''),
    };

    const summaryResult = await listAttendanceSummary(
      {
        periodMonth: period,
        locationId: locationId || undefined,
        locationIds: !locationId && !scope.global ? scope.locationIds : undefined,
      },
      ctx,
    );

    const summaryItems = summaryResult.ok ? summaryResult.value : [];

    return (
      <div className="space-y-6">
        <PageHeader title={<>{t('title')}</>} description={<>{t('subtitle', { total: summaryItems.length })}</>} />

        <AttendanceSummaryClient
          items={summaryItems}
          locations={locationOptions}
          initialPeriod={period}
          initialLocationId={locationId}
        />
      </div>
    );
  }

  // === Default "daftar" tab — existing attendance list ===
  const employeeId = params.employeeId ?? '';
  const dateFrom = params.dateFrom ?? '';
  const dateTo = params.dateTo ?? '';
  const page = Math.max(1, Number.parseInt(params.page ?? '1', 10));
  const limit = 20;
  const offset = (page - 1) * limit;

  const baseConds = [eq(attendance.tenantId, tenantId), isNull(attendance.deletedAt)];
  if (!scope.global) baseConds.push(inArray(attendance.locationId, scope.locationIds));
  if (employeeId) baseConds.push(eq(attendance.employeeId, employeeId));
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
