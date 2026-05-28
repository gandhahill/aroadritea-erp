/**
 * Payroll Run Page — SD §21.8 §Payroll Run
 *
 * Form to create a payroll run:
 * - Select period (YYYY-MM)
 * - Select location
 * - Preview summary (employee count)
 * - Run payroll → creates draft payroll
 */

import { PageHeader } from '@/components/page-header';
import { getSession } from '@/lib/auth';
import { authorizedLocationIdsForTenant } from '@/lib/authz';
import { and, db, eq, inArray, isNull } from '@erp/db';
import { locations } from '@erp/db/schema/auth';
import { employees, payrolls } from '@erp/db/schema/hr';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { PayrollRunClient } from './payroll-run-client';

export const metadata: Metadata = { title: 'Payroll | Aroadri ERP' };

export default async function PayrollPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const user = session.user as Record<string, unknown>;
  const tenantId = String(user.tenantId ?? 'default');
  const locationId = String(user.locationId ?? '');
  const userId = String(user.id ?? '');
  const locationScope = await authorizedLocationIdsForTenant(userId, 'hr.payroll.read', tenantId);
  if (!locationScope.global && locationScope.locationIds.length === 0) redirect('/dashboard');

  // Fetch locations for the tenant
  const locRows =
    locationScope.locationIds.length > 0
      ? await db
          .select({
            id: locations.id,
            code: locations.code,
            name: locations.name,
          })
          .from(locations)
          .where(
            and(
              eq(locations.tenantId, tenantId),
              isNull(locations.deletedAt),
              inArray(locations.id, locationScope.locationIds),
            ),
          )
      : [];

  // Fetch existing payrolls
  const payrollRows =
    locationScope.locationIds.length > 0
      ? await db
          .select({
            id: payrolls.id,
            periodCode: payrolls.periodCode,
            periodStart: payrolls.periodStart,
            periodEnd: payrolls.periodEnd,
            status: payrolls.status,
            totalEmployees: payrolls.totalEmployees,
            totalNet: payrolls.totalNet,
            approvedAt: payrolls.approvedAt,
            journalEntryId: payrolls.journalEntryId,
          })
          .from(payrolls)
          .where(
            and(
              eq(payrolls.tenantId, tenantId),
              inArray(payrolls.locationId, locationScope.locationIds),
            ),
          )
          .orderBy(payrolls.periodStart)
      : [];

  const employeeRows =
    locationScope.locationIds.length > 0
      ? await db
          .select({
            id: employees.id,
            name: employees.name,
            locationId: employees.locationId,
          })
          .from(employees)
          .where(
            and(
              eq(employees.tenantId, tenantId),
              eq(employees.status, 'active'),
              isNull(employees.deletedAt),
              inArray(employees.locationId, locationScope.locationIds),
            ),
          )
          .orderBy(employees.name)
      : [];

  const locations_ = locRows.map((l) => {
    const name = l.name as { id?: string; en?: string; zh?: string } | null;
    const label = [l.code, name?.id ?? name?.en ?? name?.zh].filter(Boolean).join(' - ');
    return { value: l.id, label: label || l.id };
  });

  const t = await getTranslations('hr.payroll');

  return (
    <div className="space-y-6">
      <PageHeader title={<>{t('title')}</>} description={<>{t('subtitle')}</>} />

      <PayrollRunClient
        locations={locations_}
        existingPayrolls={payrollRows.map((p) => ({
          id: p.id,
          periodCode: p.periodCode,
          periodStart: p.periodStart?.toISOString() ?? '',
          periodEnd: p.periodEnd?.toISOString() ?? '',
          status: p.status,
          totalEmployees: Number(p.totalEmployees),
          totalNet: String(p.totalNet),
          approvedAt: p.approvedAt?.toISOString() ?? null,
          journalEntryId: p.journalEntryId ?? null,
        }))}
        defaultLocationId={locationId}
        employees={employeeRows.map((employee) => ({
          id: employee.id,
          name: employee.name,
          locationId: employee.locationId,
        }))}
      />
    </div>
  );
}
