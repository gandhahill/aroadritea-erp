import type { Metadata } from 'next';
import Link from 'next/link';
import { fetchAssignableRoles, fetchEmployeeLocationOptions } from '../actions';
import { EmployeeForm } from './employee-form';

export const metadata: Metadata = {
  title: 'Tambah Karyawan - Aroadri ERP',
};

export default async function NewEmployeePage() {
  const [roles, locations] = await Promise.all([
    fetchAssignableRoles(),
    fetchEmployeeLocationOptions(),
  ]);
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <Link
          href="/hr/employees"
          className="text-sm font-medium text-brand-ink-3 transition-colors hover:text-brand-ink"
        >
          Kembali ke Employees
        </Link>
        <h1 className="mt-3 text-2xl font-bold text-brand-ink">Tambah karyawan</h1>
        <p className="mt-1 text-sm text-brand-ink-3">
          Data karyawan masuk ke HR, payroll, presensi, cuti, dan audit ERP. Isi juga sandi awal dan
          role bila ingin karyawan langsung dapat masuk ke ERP setelah disimpan.
        </p>
      </div>
      <EmployeeForm assignableRoles={roles} locationOptions={locations} />
    </div>
  );
}
