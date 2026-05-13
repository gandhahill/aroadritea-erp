/**
 * Employee List Page — SD §9.6, §21.8
 *
 * Paginated employee list with search, status filter, department filter.
 */

import { getSession } from '@/lib/auth';
import { db, desc, eq, sql } from '@erp/db';
import { employees } from '@erp/db/schema/hr';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { EmployeeListClient } from './employee-list-client';

export const metadata: Metadata = { title: 'Employees' };

const STATUS_LABEL: Record<string, string> = {
  probation: 'Probation',
  active: 'Aktif',
  on_leave: 'Cuti',
  terminated: 'Diberhentikan',
};

const STATUS_COLOR: Record<string, { bg: string; text: string }> = {
  probation: { bg: 'bg-brand-gold/10', text: 'text-brand-gold' },
  active: { bg: 'bg-brand-jade/10', text: 'text-brand-jade' },
  on_leave: { bg: 'bg-blue-50', text: 'text-blue-600' },
  terminated: { bg: 'bg-rose-50', text: 'text-rose-500' },
};

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');

  const tenantId = ((session.user as Record<string, unknown>)?.tenantId as string) ?? 'default';
  const params = await searchParams;
  const q = params.q ?? '';
  const status = params.status ?? '';
  const page = Math.max(1, Number.parseInt(params.page ?? '1', 10));
  const limit = 20;
  const offset = (page - 1) * limit;

  const conditions = [eq(employees.tenantId, tenantId)];
  if (q) {
    conditions.push(
      sql`(${employees.name} ILIKE ${'%' + q + '%'} OR ${employees.nik} ILIKE ${'%' + q + '%'} OR ${employees.email} ILIKE ${'%' + q + '%'})`,
    );
  }
  if (status) {
    conditions.push(eq(employees.status, status));
  }

  const whereClause = sql.join(conditions, sql` AND `);

  // Count
  const [countRow] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(employees)
    .where(whereClause);

  // Fetch
  const rows = await db
    .select({
      id: employees.id,
      nik: employees.nik,
      name: employees.name,
      email: employees.email,
      status: employees.status,
      position: employees.position,
      department: employees.department,
      hireDate: employees.hireDate,
      contractType: employees.contractType,
    })
    .from(employees)
    .where(whereClause)
    .orderBy(employees.name)
    .limit(limit)
    .offset(offset);

  const total = countRow?.count ?? 0;
  const totalPages = Math.ceil((Number(total) || 0) / limit);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brand-ink">Employees</h1>
          <p className="mt-1 text-sm text-brand-ink-3">
            Manage employee records, contracts, and payroll.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-cream-2 px-3 py-1 text-xs font-medium text-brand-ink-2">
            {total} employees
          </span>
          <a
            href="/hr/employees/new"
            className="inline-flex items-center gap-2 rounded-lg bg-brand-ember-5 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-ember-6"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add Employee
          </a>
        </div>
      </div>

      {/* Filters */}
      <EmployeeListClient
        rows={rows.map((r) => ({
          ...r,
          hireDate: r.hireDate?.toISOString() ?? '',
          statusLabel: STATUS_LABEL[r.status] ?? r.status,
          statusColor: STATUS_COLOR[r.status] ?? {
            bg: 'bg-brand-cream-2',
            text: 'text-brand-ink-2',
          },
          contractLabel:
            r.contractType === 'pkwt'
              ? 'PKWT'
              : r.contractType === 'pkwtt'
                ? 'PKWTT'
                : r.contractType,
        }))}
        total={total ?? 0}
        page={page}
        totalPages={totalPages}
        initialQ={q}
        initialStatus={status}
        statusOptions={Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label }))}
      />
    </div>
  );
}
