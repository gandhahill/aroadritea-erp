import type { PermissionCode } from '@erp/shared/types';
import { getSession } from '@/lib/auth';
import { getEmployee } from '@erp/services/hr';
import { can } from '@erp/services/iam';
import type { AuditContext } from '@erp/shared/types';
import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { forbidden, notFound, redirect } from 'next/navigation';
import { fetchAssignableRoles } from '../actions';
import { EditLoginModal } from './edit-login-modal';
import { DeleteEmployeeButton } from './delete-employee-button';

export const metadata: Metadata = { title: 'Employee Detail' };

const STATUS_COLOR: Record<string, { bg: string; text: string }> = {
  probation: { bg: 'bg-brand-gold/10', text: 'text-brand-gold' },
  active: { bg: 'bg-brand-jade/10', text: 'text-brand-jade' },
  on_leave: { bg: 'bg-blue-50', text: 'text-blue-600' },
  terminated: { bg: 'bg-rose-50', text: 'text-rose-500' },
};

function formatMoney(v: string | number | bigint | null | undefined): string {
  if (!v) return '-';
  const num = typeof v === 'string' ? Number.parseInt(v, 10) : Number(v);
  if (Number.isNaN(num)) return '-';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(num);
}

function formatDate(d: Date | string | null | undefined, locale: string): string {
  if (!d) return '-';
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' });
}

export default async function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect('/login');

  const user = session.user as Record<string, unknown>;
  const ctx: AuditContext = {
    userId: String(user.id ?? ''),
    tenantId: String(user.tenantId ?? 'default'),
    locationId: String(user.locationId ?? ''),
  };
  const [t, commonT, contractT, attendanceT, leaveT, locale] = await Promise.all([
    getTranslations('hr.employees'),
    getTranslations('common.actions'),
    getTranslations('hr.contracts'),
    getTranslations('hr.attendance'),
    getTranslations('hr.leave'),
    getLocale(),
  ]);

  const result = await getEmployee(id, ctx);
  if (!result.ok) {
    if (result.error.code === 'NOT_FOUND') notFound();
    if (result.error.code === 'FORBIDDEN') forbidden();
    throw new Error(result.error.message ?? result.error.messageKey ?? 'Failed to load employee');
  }
  const emp = result.value;
  
  const canEditLogin = await can(ctx.userId, 'iam.user.update', { locationId: emp.locationId ?? undefined });
  const canEditEmployee = await can(ctx.userId, 'hr.employee.write', { locationId: emp.locationId ?? undefined });
  const roles = canEditLogin ? await fetchAssignableRoles() : [];
  const year = new Date().getFullYear();
  const statusCfg = STATUS_COLOR[emp.status] ?? {
    bg: 'bg-brand-cream-2',
    text: 'text-brand-ink-2',
  };
  const statusLabel =
    {
      probation: t('statusProbation'),
      active: t('statusActive'),
      on_leave: t('statusOnLeave'),
      terminated: t('statusTerminated'),
    }[emp.status] ?? emp.status;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <a
          href="/hr/employees"
          className="inline-flex items-center gap-1.5 text-sm text-brand-ink-3 transition-colors hover:text-brand-ember-5"
        >
          <svg
            aria-hidden="true"
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
          {t('title')}
        </a>
        <div className="flex items-center gap-2">
          {canEditEmployee && (
            <a
              href={`/hr/employees/${emp.id}/edit`}
              className="inline-flex h-8 items-center rounded-md border border-brand-cream-3 px-3 text-xs font-semibold text-brand-ink-2 transition-colors hover:bg-brand-cream-2"
            >
              {commonT('edit')}
            </a>
          )}
          {canEditLogin && <EditLoginModal employeeId={emp.id} roles={roles} />}
          {canEditEmployee && <DeleteEmployeeButton employeeId={emp.id} />}
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${statusCfg.bg} ${statusCfg.text}`}
          >
            {statusLabel}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-4 rounded-xl border border-brand-cream-3 bg-card p-6">
        <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-brand-ember-5/10 text-xl font-semibold text-brand-ember-5">
          {emp.name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-bold text-brand-ink">{emp.name}</h2>
          <p className="text-sm text-brand-ink-3">
            {emp.position}
            {emp.department ? ` - ${emp.department}` : ''}
          </p>
          <p className="text-xs text-brand-ink-3">
            {t('nik')}: {emp.nik ?? '—'} / {emp.email}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-right text-sm">
          <span className="text-brand-ink-3">{t('hireDate')}</span>
          <span className="font-medium text-brand-ink">{formatDate(emp.hireDate, locale)}</span>
          <span className="text-brand-ink-3">{t('contractType')}</span>
          <span className="font-medium text-brand-ink">{emp.contractType.toUpperCase()}</span>
          <span className="text-brand-ink-3">{t('workSchedule')}</span>
          <span className="font-medium text-brand-ink capitalize">{emp.workSchedule}</span>
        </div>
      </div>

      <section className="rounded-xl border border-brand-cream-3 bg-card p-6">
        <h3 className="mb-4 text-base font-semibold text-brand-ink">{t('personalInfo')}</h3>
        <dl className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
          <Field label={t('phone')} value={emp.phone} />
          <Field label={t('npwp')} value={emp.npwp} />
          <Field label={t('bpjsKesehatan')} value={emp.bpjsKesehatan} />
          <Field label={t('bpjsTenagakerja')} value={emp.bpjsTenagakerja} />
          <Field label={t('address')} value={emp.address} wide />
          <Field
            label={t('emergencyContact')}
            value={[
              emp.emergencyContactName,
              emp.emergencyContactPhone ? `(${emp.emergencyContactPhone})` : '',
            ]
              .filter(Boolean)
              .join(' ')}
          />
        </dl>
      </section>

      <section className="rounded-xl border border-brand-cream-3 bg-card p-6">
        <h3 className="mb-4 text-base font-semibold text-brand-ink">{contractT('title')}</h3>
        {emp.contracts.length === 0 ? (
          <p className="text-sm text-brand-ink-3">{contractT('noContracts')}</p>
        ) : (
          <div className="space-y-3">
            {emp.contracts.map((contract) => (
              <div
                key={contract.id}
                className="flex items-center justify-between rounded-lg border border-brand-cream-2 bg-brand-cream-1 px-4 py-3"
              >
                <div>
                  <div className="text-sm font-medium text-brand-ink">
                    {contract.contractType === 'pkwt' ? contractT('pkwt') : contractT('pkwtt')}
                    {contract.isActive ? (
                      <span className="ml-2 text-xs text-brand-jade">{contractT('isActive')}</span>
                    ) : null}
                  </div>
                  <div className="text-xs text-brand-ink-3">
                    {formatDate(contract.startDate, locale)} -{' '}
                    {contract.endDate ? formatDate(contract.endDate, locale) : contractT('pkwtt')}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-brand-ember-5">
                    {formatMoney(contract.baseSalary)}
                  </div>
                  <div className="text-xs text-brand-ink-3">{contractT('baseSalary')}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-brand-cream-3 bg-card p-6">
        <h3 className="mb-4 text-base font-semibold text-brand-ink">
          {attendanceT('title')} - {year}
        </h3>
        <div className="grid grid-cols-3 gap-4">
          <Metric value={emp.attendanceSummary.totalDays} label={attendanceT('workedDays')} />
          <Metric value={emp.attendanceSummary.lateDays} label={attendanceT('lateDays')} accent />
          <Metric
            value={emp.probationEndDate ? formatDate(emp.probationEndDate, locale) : '-'}
            label={t('probationEnd')}
          />
        </div>
      </section>

      <section className="rounded-xl border border-brand-cream-3 bg-card p-6">
        <h3 className="mb-4 text-base font-semibold text-brand-ink">
          {leaveT('balances')} - {year}
        </h3>
        {emp.leaveBalances.length === 0 ? (
          <p className="text-sm text-brand-ink-3">{leaveT('noBalances')}</p>
        ) : (
          <div className="mb-6 grid grid-cols-3 gap-3">
            {emp.leaveBalances.map((balance) => {
              const total = Number.parseFloat(balance.totalDays) || 0;
              const used = Number.parseFloat(balance.usedDays) || 0;
              const pending = Number.parseFloat(balance.pendingDays) || 0;
              const remaining = Math.max(0, total - used - pending);
              return (
                <div
                  key={balance.leaveTypeId}
                  className="rounded-lg border border-brand-cream-3 bg-brand-cream-1 p-4"
                >
                  <div className="text-xs font-medium text-brand-ink-2">
                    {balance.leaveTypeName[locale as 'id' | 'en' | 'zh'] ?? balance.leaveTypeCode}
                  </div>
                  <div className="mt-1 text-xl font-bold text-brand-ink">{remaining}</div>
                  <div className="text-xs text-brand-ink-3">{leaveT('ofTotal', { total })}</div>
                </div>
              );
            })}
          </div>
        )}
        {emp.recentLeaveRequests.length > 0 ? (
          <>
            <h4 className="mb-3 text-sm font-semibold text-brand-ink">
              {leaveT('recentRequests')}
            </h4>
            <div className="space-y-2">
              {emp.recentLeaveRequests.map((request) => (
                <div
                  key={request.id}
                  className="flex items-center justify-between rounded-lg border border-brand-cream-2 px-4 py-2 text-sm"
                >
                  <span className="text-brand-ink">
                    {request.leaveTypeName[locale as 'id' | 'en' | 'zh'] ?? request.leaveTypeCode}
                  </span>
                  <span className="text-brand-ink-3">
                    {formatDate(request.startDate, locale)} - {formatDate(request.endDate, locale)}
                  </span>
                  <span className="font-medium capitalize text-brand-gold">{request.status}</span>
                </div>
              ))}
            </div>
          </>
        ) : null}
      </section>
    </div>
  );
}

function Field({
  label,
  value,
  wide = false,
}: { label: string; value?: string | null; wide?: boolean }) {
  return (
    <div className={wide ? 'col-span-2' : ''}>
      <dt className="text-brand-ink-3">{label}</dt>
      <dd className="font-medium text-brand-ink">{value || '-'}</dd>
    </div>
  );
}

function Metric({
  value,
  label,
  accent = false,
}: { value: string | number; label: string; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-brand-cream-3 bg-brand-cream-1 p-4 text-center">
      <div className={`text-2xl font-bold ${accent ? 'text-brand-gold' : 'text-brand-ink'}`}>
        {value}
      </div>
      <div className="text-xs text-brand-ink-3">{label}</div>
    </div>
  );
}
