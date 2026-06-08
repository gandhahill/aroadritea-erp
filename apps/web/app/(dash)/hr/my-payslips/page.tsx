/**
 * My Payslips — User Req 3 (2026-05-24).
 * Every authenticated user sees the payroll runs that include them
 * (matched by their email ↔ employees.email). Admins automatically see
 * more via the regular /hr/payroll page.
 */

import { PageHeader } from '@/components/page-header';
import { getSession } from '@/lib/auth';
import { listMyPayslips } from '@erp/services/payroll';
import type { AuditContext } from '@erp/shared/types';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { PayslipActions } from './payslip-actions';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('hr.payslip');
  return { title: `${t('title')}` };
}

const IDR = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  minimumFractionDigits: 0,
});

export default async function MyPayslipsPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const user = session.user as Record<string, unknown>;
  const ctx: AuditContext = {
    userId: String(user.id ?? ''),
    tenantId: String(user.tenantId ?? 'default'),
    locationId: String(user.locationId ?? ''),
  };

  const [result, t] = await Promise.all([listMyPayslips(ctx), getTranslations('hr.payslip')]);

  const items = result.ok ? result.value : [];

  return (
    <div className="space-y-6">
      <PageHeader title={t('title')} description={t('description')} />

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-brand-cream-3 bg-card p-10 text-center text-sm text-brand-ink-3">
          {t('empty')}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-brand-cream-3 bg-card">
          <table className="w-full text-sm">
            <thead className="bg-brand-cream-2/60 text-left text-xs uppercase text-brand-ink-2">
              <tr>
                <th className="px-4 py-3">{t('table.period')}</th>
                <th className="px-4 py-3">{t('table.outlet')}</th>
                <th className="px-4 py-3">{t('table.status')}</th>
                <th className="px-4 py-3 text-right">{t('table.netSalary')}</th>
                <th className="px-4 py-3 text-right">{t('table.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr
                  key={`${row.payrollId}-${row.employeeId}`}
                  className="border-t border-brand-cream-3"
                >
                  <td className="px-4 py-3 font-medium text-brand-ink">{row.periodCode}</td>
                  <td className="px-4 py-3 text-brand-ink-2">{row.locationCode}</td>
                  <td className="px-4 py-3 text-brand-ink-2">{row.status}</td>
                  <td className="px-4 py-3 text-right font-mono">
                    {IDR.format(Number(BigInt(row.net)))}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <PayslipActions
                      href={`/api/hr/payslip/${row.payrollId}/${row.employeeId}`}
                      periodCode={row.periodCode}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
