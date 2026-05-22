import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { fetchAssignableRoles, fetchEmployeeLocationOptions } from '../actions';
import { EmployeeForm } from './employee-form';

export const metadata: Metadata = {
  title: 'Tambah Karyawan - Aroadri ERP',
};

export default async function NewEmployeePage() {
  const [roles, locations, t] = await Promise.all([
    fetchAssignableRoles(),
    fetchEmployeeLocationOptions(),
    getTranslations('hr.employees'),
  ]);
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <Link
          href="/hr/employees"
          className="text-sm font-medium text-brand-ink-3 transition-colors hover:text-brand-ink"
        >
          {t('backToEmployees')}
        </Link>
        <h1 className="mt-3 text-2xl font-bold text-brand-ink">{t('addTitle')}</h1>
        <p className="mt-1 text-sm text-brand-ink-3">{t('addSubtitle')}</p>
      </div>
      <EmployeeForm assignableRoles={roles} locationOptions={locations} />
    </div>
  );
}
