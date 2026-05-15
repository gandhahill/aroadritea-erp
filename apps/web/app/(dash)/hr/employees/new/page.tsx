import type { Metadata } from 'next';
import Link from 'next/link';
import { EmployeeForm } from './employee-form';

export const metadata: Metadata = {
  title: 'Tambah Karyawan - Aroadri ERP',
};

export default function NewEmployeePage() {
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
          Data karyawan masuk ke HR, payroll, attendance, cuti, dan audit ERP.
        </p>
      </div>
      <EmployeeForm />
    </div>
  );
}
