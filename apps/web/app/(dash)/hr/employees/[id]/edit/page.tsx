import { PageHeader } from '@/components/page-header';
import { getSession } from '@/lib/auth';
import { getEmployee } from '@erp/services/hr';
import type { AuditContext } from '@erp/shared/types';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { forbidden, notFound, redirect } from 'next/navigation';
import { fetchEmployeeLocationOptions } from '../../actions';
import { EmployeeForm } from '../../new/employee-form';

export const metadata: Metadata = {
  title: 'Edit Employee - Aroadri ERP',
};

export default async function EditEmployeePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');

  const { id } = await params;
  const user = session.user as Record<string, unknown>;
  const ctx: AuditContext = {
    userId: String(user.id ?? ''),
    tenantId: String(user.tenantId ?? 'default'),
    locationId: String(user.locationId ?? ''),
  };

  const [result, locations, t] = await Promise.all([
    getEmployee(id, ctx),
    fetchEmployeeLocationOptions(),
    getTranslations('hr.employees'),
  ]);

  if (!result.ok) {
    if (result.error.code === 'NOT_FOUND') notFound();
    if (result.error.code === 'FORBIDDEN') forbidden();
    throw new Error(result.error.message ?? result.error.messageKey ?? 'Failed to load employee');
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title={t('editTitle', { name: result.value.name })}
        description={t('editSubtitle')}
      />
      <EmployeeForm employee={result.value} locationOptions={locations} />
    </div>
  );
}
