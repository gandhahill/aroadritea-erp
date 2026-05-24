import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { fetchAssignableRoles, fetchEmployeeLocationOptions } from '../actions';
import { EmployeeForm } from './employee-form';
import { PageHeader } from "@/components/page-header";

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
      <PageHeader 
            title={<>{t('addTitle')}</>}
            description={<>{t('addSubtitle')}</>}
          />
      <EmployeeForm assignableRoles={roles} locationOptions={locations} />
    </div>
  );
}
