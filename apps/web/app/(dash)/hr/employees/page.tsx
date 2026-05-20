/**
 * Employee List Page — SD §9.6, §21.8
 *
 * Paginated employee list with search, status filter, department filter.
 */

import { getSession } from '@/lib/auth';
import { listEmployees } from '@erp/services/hr';
import type { AuditContext } from '@erp/shared/types';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { fetchEmployeeLocationOptions } from './actions';
import { EmployeeListClient } from './employee-list-client';

export const metadata: Metadata = { title: 'Employees' };

const STATUS_COLOR: Record<string, { bg: string; text: string }> = {
  probation: { bg: 'bg-brand-gold/10', text: 'text-brand-gold' },
  active: { bg: 'bg-brand-jade/10', text: 'text-brand-jade' },
  on_leave: { bg: 'bg-blue-50', text: 'text-blue-600' },
  terminated: { bg: 'bg-rose-50', text: 'text-rose-500' },
};

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; locationId?: string; page?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');

  const user = session.user as Record<string, unknown>;
  const ctx: AuditContext = {
    userId: String(user.id ?? ''),
    tenantId: String(user.tenantId ?? 'default'),
    locationId: String(user.locationId ?? ''),
  };
  const t = await getTranslations('hr.employees');
  const params = await searchParams;
  const q = params.q ?? '';
  const status = params.status ?? '';
  const locationId = params.locationId ?? '';
  const page = Math.max(1, Number.parseInt(params.page ?? '1', 10));
  const limit = 20;
  const offset = (page - 1) * limit;

  const [result, locationOptions] = await Promise.all([
    listEmployees(
      {
        search: q || undefined,
        status: status ? (status as 'probation' | 'active' | 'on_leave' | 'terminated') : undefined,
        locationId: locationId || undefined,
        limit,
        offset,
      },
      ctx,
    ),
    fetchEmployeeLocationOptions(),
  ]);
  if (!result.ok) {
    throw new Error(result.error.message ?? result.error.messageKey ?? 'Failed to load employees');
  }

  const rows = result.value.items;
  const total = result.value.total;
  const totalPages = Math.ceil((Number(total) || 0) / limit);
  const statusLabel: Record<string, string> = {
    probation: t('statusProbation'),
    active: t('statusActive'),
    on_leave: t('statusOnLeave'),
    terminated: t('statusTerminated'),
  };
  const locationNameById = new Map(
    locationOptions.map((location) => [location.id, location.label]),
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brand-ink">{t('title')}</h1>
          <p className="mt-1 text-sm text-brand-ink-3">{t('description')}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-cream-2 px-3 py-1 text-xs font-medium text-brand-ink-2">
            {t('count', { count: total })}
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
            {t('add')}
          </a>
        </div>
      </div>

      <EmployeeListClient
        rows={rows.map((r) => ({
          ...r,
          hireDate: r.hireDate.toISOString(),
          locationName: r.locationId ? (locationNameById.get(r.locationId) ?? r.locationId) : '-',
          statusLabel: statusLabel[r.status] ?? r.status,
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
        initialLocationId={locationId}
        statusOptions={Object.entries(statusLabel).map(([value, label]) => ({ value, label }))}
        locationOptions={locationOptions.map((location) => ({
          value: location.id,
          label: location.label,
        }))}
      />
    </div>
  );
}
