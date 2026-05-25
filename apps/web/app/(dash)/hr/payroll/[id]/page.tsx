/**
 * Payroll Detail Page — SD §21.8 §Payroll Run
 *
 * Shows payroll summary + line items + workflow actions (approve/mark-paid).
 * Accessible to directors/managers. Status determines which buttons are shown.
 */

import { PageHeader } from '@/components/page-header';
import { getSession } from '@/lib/auth';
import { db, eq } from '@erp/db';
import { locations } from '@erp/db/schema/auth';
import { employees, payrollLines, payrolls, salaryComponents } from '@erp/db/schema/hr';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { approvePayrollAction, markPayrollPaidAction } from '../actions';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('hr.payroll');
  return { title: t('detail.title') };
}

function fmtMoney(v: bigint | string): string {
  const num = typeof v === 'string' ? Number.parseInt(v, 10) : Number(v);
  if (isNaN(num)) return '—';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(num);
}

interface Props {
  params: Promise<{ id: string }>;
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    draft: 'Draf',
    pending_approval: 'Menunggu Persetujuan',
    approved: 'Disetujui',
    paid: 'Dibayar',
    cancelled: 'Dibatalkan',
  };
  return map[status] ?? status;
}

function statusColor(status: string): string {
  const map: Record<string, string> = {
    draft: 'bg-brand-cream-2 text-brand-ink-2',
    pending_approval: 'bg-brand-gold/10 text-brand-gold',
    approved: 'bg-brand-jade/10 text-brand-jade',
    paid: 'bg-brand-ember-5/10 text-brand-ember-5',
    cancelled: 'bg-rose-50 text-rose-500',
  };
  return map[status] ?? 'bg-brand-cream-2 text-brand-ink-2';
}

export default async function PayrollDetailPage({ params }: Props) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect('/login');

  const user = session.user as Record<string, unknown>;
  const tenantId = String(user.tenantId ?? 'default');
  const locationId = String(user.locationId ?? '');
  const userId = String(user.id ?? 'system');

  const t = await getTranslations('hr.payroll');

  // Load payroll
  const [payroll] = await db.select().from(payrolls).where(eq(payrolls.id, id)).limit(1);

  if (!payroll) {
    return (
      <div className="rounded-xl border border-brand-cream-3 bg-card p-8 text-center">
        <p className="text-brand-ink-3">{t('detail.notFound')}</p>
        <a
          href="/hr/payroll"
          className="mt-4 inline-block text-sm text-brand-ember-5 hover:text-brand-ember-6"
        >
          {t('detail.back')}
        </a>
      </div>
    );
  }

  // Load location name
  const [loc] = await db
    .select({ name: locations.name })
    .from(locations)
    .where(eq(locations.id, payroll.locationId))
    .limit(1);

  // Load lines joined with employee + component
  const lines = await db
    .select({
      line: payrollLines,
      employeeName: employees.name,
      componentName: salaryComponents.name,
      componentCode: salaryComponents.code,
      componentKind: salaryComponents.kind,
    })
    .from(payrollLines)
    .innerJoin(employees, eq(payrollLines.employeeId, employees.id))
    .innerJoin(salaryComponents, eq(payrollLines.salaryComponentId, salaryComponents.id))
    .where(eq(payrollLines.payrollId, id))
    .orderBy(employees.name, salaryComponents.code);

  // Group by employee
  const byEmployee = new Map<
    string,
    {
      name: string;
      lines: Array<{ code: string; name: string; kind: string; amount: bigint }>;
      subtotal: bigint;
    }
  >();

  for (const row of lines) {
    const empId = row.line.employeeId;
    if (!byEmployee.has(empId)) {
      byEmployee.set(empId, { name: row.employeeName, lines: [], subtotal: 0n });
    }
    const emp = byEmployee.get(empId)!;
    emp.lines.push({
      code: row.componentCode,
      name: String(row.componentName),
      kind: row.componentKind,
      amount: row.line.amount,
    });
    if (row.componentKind === 'earning') emp.subtotal += row.line.amount;
    else emp.subtotal -= row.line.amount;
  }

  // Actions based on status
  const status = payroll.status;
  const canApprove = status === 'draft' || status === 'pending_approval';
  const canMarkPaid = status === 'approved';

  const ctx = { userId, tenantId, locationId: payroll.locationId };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <PageHeader title={<>{t('detail.title')}</>} />
          <p className="mt-1 text-sm text-brand-ink-3">
            {String(loc?.name ?? payroll.locationId)} &middot; {String(payroll.periodCode)}
          </p>
        </div>
        <a
          href="/hr/payroll"
          className="inline-flex items-center gap-1.5 text-sm text-brand-ember-5 hover:text-brand-ember-6"
        >
          {t('detail.backSimple')}
        </a>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: t('detail.summary.employees'), value: String(payroll.totalEmployees) },
          { label: t('detail.summary.earnings'), value: fmtMoney(payroll.totalEarnings) },
          { label: t('detail.summary.deductions'), value: fmtMoney(payroll.totalDeductions) },
          { label: t('detail.summary.net'), value: fmtMoney(payroll.totalNet), highlight: true },
        ].map((s) => (
          <div
            key={s.label}
            className={`rounded-xl border border-brand-cream-3 bg-card p-4 ${s.highlight ? 'border-brand-ember-5/30' : ''}`}
          >
            <p className="text-xs font-medium text-brand-ink-3">{s.label}</p>
            <p
              className={`mt-1 text-lg font-semibold ${s.highlight ? 'text-brand-ember-5' : 'text-brand-ink'}`}
            >
              {s.value}
            </p>
          </div>
        ))}
      </div>

      {/* Actions */}
      {(canApprove || canMarkPaid) && (
        <div className="rounded-xl border border-brand-gold/30 bg-brand-gold/5 p-4">
          <form
            action={async (formData) => {
              'use server';
              const action = formData.get('action') as string;
              if (action === 'approve') {
                await approvePayrollAction({ payrollId: id });
              } else if (action === 'paid') {
                await markPayrollPaidAction({ payrollId: id });
              }
            }}
          >
            <input type="hidden" name="action" value={canApprove ? 'approve' : 'paid'} />
            <div className="flex items-center gap-4">
              {canApprove && (
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-lg bg-brand-jade px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-jade/90"
                >
                  {t('detail.actions.approve')}
                </button>
              )}
              {canMarkPaid && (
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-lg bg-brand-ember-5 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-ember-6"
                >
                  {t('detail.actions.markPaid')}
                </button>
              )}
              <p className="text-sm text-brand-ink-3">
                {canApprove ? t('detail.actions.approveHelp') : t('detail.actions.paidHelp')}
              </p>
            </div>
          </form>
        </div>
      )}

      {/* Lines by Employee */}
      <div className="space-y-4">
        {Array.from(byEmployee.entries()).map(([empId, emp]) => (
          <div
            key={empId}
            className="rounded-xl border border-brand-cream-3 bg-card overflow-hidden"
          >
            <div className="flex items-center justify-between border-b border-brand-cream-3 bg-brand-cream-1 px-5 py-3">
              <h3 className="text-sm font-semibold text-brand-ink">{emp.name}</h3>
              <span className="text-sm font-semibold text-brand-ember-5">
                {fmtMoney(emp.subtotal)}
              </span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-brand-cream-2">
                  <th className="px-5 py-2 text-left text-xs font-medium text-brand-ink-3">
                    {t('detail.table.component')}
                  </th>
                  <th className="px-5 py-2 text-left text-xs font-medium text-brand-ink-3">
                    {t('detail.table.type')}
                  </th>
                  <th className="px-5 py-2 text-right text-xs font-medium text-brand-ink-3">
                    {t('detail.table.amount')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-cream-2">
                {emp.lines.map((line) => (
                  <tr key={line.code}>
                    <td className="px-5 py-2.5 text-brand-ink">{line.name}</td>
                    <td className="px-5 py-2.5">
                      <span
                        className={`text-xs font-medium ${line.kind === 'earning' ? 'text-brand-jade' : 'text-brand-rose-4'}`}
                      >
                        {line.kind === 'earning'
                          ? t('detail.table.earning')
                          : t('detail.table.deduction')}
                      </span>
                    </td>
                    <td
                      className={`px-5 py-2.5 text-right font-mono ${line.kind === 'earning' ? 'text-brand-ink' : 'text-brand-rose-4'}`}
                    >
                      {line.kind === 'earning' ? '' : '-'}
                      {fmtMoney(line.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      {/* Journal entry link */}
      {payroll.journalEntryId && (
        <div className="text-sm text-brand-ink-3">
          {t('detail.journalLink')}{' '}
          <a
            href={`/accounting/journals/${payroll.journalEntryId}`}
            className="text-brand-ember-5 hover:text-brand-ember-6"
          >
            {payroll.journalEntryId}
          </a>
        </div>
      )}
    </div>
  );
}
