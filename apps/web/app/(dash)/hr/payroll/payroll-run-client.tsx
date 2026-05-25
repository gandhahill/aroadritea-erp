/**
 * Payroll Run Client — form + payroll run list.
 */

'use client';

import { Input, Select, TableCell, TableHead } from '@erp/ui';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { runPayrollAction } from './actions';

interface PayrollRunRow {
  id: string;
  periodCode: string;
  periodStart: string;
  periodEnd: string;
  status: string;
  totalEmployees: number;
  totalNet: string;
  approvedAt: string | null;
  journalEntryId: string | null;
}

interface Props {
  locations: { value: string; label: string }[];
  existingPayrolls: PayrollRunRow[];
  defaultLocationId: string;
  employees: { id: string; name: string; locationId: string }[];
}

function formatMoney(v: string): string {
  const num = Number.parseInt(v, 10);
  if (isNaN(num)) return '—';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(num);
}

function formatDate(iso: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('id-ID', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

const STATUS_COLOR: Record<string, { bg: string; text: string; label: string }> = {
  draft: { bg: 'bg-brand-cream-2', text: 'text-brand-ink-2', label: 'Draf' },
  pending_approval: { bg: 'bg-brand-gold/10', text: 'text-brand-gold', label: 'Menunggu' },
  approved: { bg: 'bg-brand-jade/10', text: 'text-brand-jade', label: 'Disetujui' },
  paid: { bg: 'bg-brand-ember-5/10', text: 'text-brand-ember-5', label: 'Dibayar' },
  cancelled: { bg: 'bg-rose-50', text: 'text-rose-500', label: 'Dibatalkan' },
};

export function PayrollRunClient({
  locations,
  existingPayrolls,
  defaultLocationId,
  employees,
}: Props) {
  const t = useTranslations('hr.payroll');
  const router = useRouter();
  const [periodCode, setPeriodCode] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [locationId, setLocationId] = useState(defaultLocationId);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [bonusByEmployeeId, setBonusByEmployeeId] = useState<Record<string, string>>({});

  const periodStart = `${periodCode}-01`;
  const periodEnd = (() => {
    const [y, m] = periodCode.split('-').map((s) => Number.parseInt(s, 10));
    const last = new Date(y ?? 2000, (m ?? 1) - 1, 0).getDate();
    return `${periodCode}-${String(last).padStart(2, '0')}`;
  })();
  const selectedEmployees = employees.filter((employee) => employee.locationId === locationId);
  const additionalEarnings = selectedEmployees
    .map((employee) => {
      const amount = (bonusByEmployeeId[employee.id] ?? '').replace(/\D/g, '');
      return amount && Number.parseInt(amount, 10) > 0
        ? {
            employeeId: employee.id,
            componentCode: 'BONUS',
            amount,
            notes: `Bonus payroll ${periodCode}`,
          }
        : null;
    })
    .filter(
      (
        earning,
      ): earning is { employeeId: string; componentCode: string; amount: string; notes: string } =>
        earning !== null,
    );

  const handleRun = async () => {
    if (!locationId) {
      setError(t('form.errorLocation'));
      return;
    }
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    const result = await runPayrollAction({
      periodCode,
      periodStart: `${periodStart}T00:00:00Z`,
      periodEnd: `${periodEnd}T23:59:59Z`,
      locationId,
      additionalEarnings,
    });

    setSubmitting(false);

    if (result.ok) {
      setSuccess(
        t('form.success', {
          period: periodCode,
          empCount: result.value.totalEmployees,
          totalNet: formatMoney(String(result.value.totalNet)),
        }),
      );
      router.refresh();
    } else {
      setError(result.error?.message ?? 'Failed to run payroll.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Run Payroll Form */}
      <div className="rounded-xl border border-brand-cream-3 bg-card p-6">
        <h2 className="mb-4 text-base font-semibold text-brand-ink">{t('form.title')}</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="payroll-period"
              className="mb-1.5 block text-sm font-medium text-brand-ink-2"
            >
              {t('form.period')}
            </label>
            <Input
              id="payroll-period"
              type="month"
              value={periodCode}
              onChange={(e) => setPeriodCode(e.target.value)}
              className="w-full rounded-lg border border-brand-cream-3 bg-card px-3 py-2 text-sm text-brand-ink focus:border-brand-ember-5 focus:outline-none focus:ring-2 focus:ring-brand-ember-5/20"
            />
            <p className="mt-1 text-xs text-brand-ink-3">
              {periodStart} → {periodEnd}
            </p>
          </div>
          <div>
            <label
              htmlFor="payroll-location"
              className="mb-1.5 block text-sm font-medium text-brand-ink-2"
            >
              {t('form.location')}
            </label>
            <Select
              id="payroll-location"
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              className="w-full rounded-lg border border-brand-cream-3 bg-card px-3 py-2 text-sm text-brand-ink focus:border-brand-ember-5 focus:outline-none focus:ring-2 focus:ring-brand-ember-5/20"
            >
              <option value="">{t('form.selectLocation')}</option>
              {locations.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="mt-5 rounded-lg border border-brand-cream-3 bg-brand-cream-1/40 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-brand-ink">{t('form.bonusTitle')}</h3>
              <p className="mt-1 text-xs text-brand-ink-3">{t('form.bonusDesc')}</p>
            </div>
            <span className="rounded-full bg-brand-jade/10 px-3 py-1 text-xs font-medium text-brand-jade">
              {t('form.bonusCount', { count: additionalEarnings.length })}
            </span>
          </div>

          {locationId && selectedEmployees.length === 0 ? (
            <p className="mt-4 rounded-md border border-brand-cream-3 bg-card px-3 py-2 text-sm text-brand-ink-3">
              {t('form.noEmployees')}
            </p>
          ) : null}

          {selectedEmployees.length > 0 ? (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {selectedEmployees.map((employee) => (
                <label key={employee.id} className="block">
                  <span className="mb-1 block text-xs font-medium text-brand-ink-2">
                    {employee.name}
                  </span>
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={bonusByEmployeeId[employee.id] ?? ''}
                    onChange={(event) =>
                      setBonusByEmployeeId((current) => ({
                        ...current,
                        [employee.id]: event.target.value.replace(/\D/g, ''),
                      }))
                    }
                    placeholder="0"
                    className="w-full rounded-lg border border-brand-cream-3 bg-card px-3 py-2 text-sm text-brand-ink focus:border-brand-ember-5 focus:outline-none focus:ring-2 focus:ring-brand-ember-5/20"
                  />
                </label>
              ))}
            </div>
          ) : null}
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
            {error}
          </div>
        )}

        {success && (
          <div className="mt-4 rounded-lg border border-brand-jade/30 bg-brand-jade/10 px-4 py-3 text-sm text-brand-jade">
            {success}
          </div>
        )}

        <button
          type="button"
          onClick={handleRun}
          disabled={submitting || !locationId}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-brand-ember-5 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-ember-6 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? t('form.runningBtn') : t('form.runBtn')}
        </button>
      </div>

      {/* Payroll History */}
      <div>
        <h2 className="mb-4 text-base font-semibold text-brand-ink">{t('history.title')}</h2>
        {existingPayrolls.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-brand-cream-3 bg-card py-12 text-center">
            <p className="text-sm text-brand-ink-3">{t('history.empty')}</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-brand-cream-3 bg-card shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-brand-cream-3 bg-brand-cream-1">
                  <TableHead className="px-4 py-3 text-left font-medium text-brand-ink-2">
                    {t('history.period')}
                  </TableHead>
                  <TableHead className="px-4 py-3 text-left font-medium text-brand-ink-2">
                    {t('history.status')}
                  </TableHead>
                  <TableHead className="px-4 py-3 text-right font-medium text-brand-ink-2">
                    {t('history.employees')}
                  </TableHead>
                  <TableHead className="px-4 py-3 text-right font-medium text-brand-ink-2">
                    {t('history.totalNet')}
                  </TableHead>
                  <TableHead className="px-4 py-3 text-right font-medium text-brand-ink-2">
                    {t('history.actions')}
                  </TableHead>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-cream-2">
                {existingPayrolls.map((p) => {
                  const s = STATUS_COLOR[p.status] ?? {
                    bg: 'bg-brand-cream-2',
                    text: 'text-brand-ink-2',
                  };
                  return (
                    <tr key={p.id} className="hover:bg-brand-cream-1/50">
                      <TableCell className="px-4 py-3 font-medium text-brand-ink">
                        {p.periodCode}
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${s.bg} ${s.text}`}
                        >
                          {t(
                            `status${p.status.charAt(0).toUpperCase() + p.status.slice(1).replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())}_label` as any,
                          )}
                        </span>
                      </TableCell>
                      <TableCell className="px-4 py-3 text-right text-brand-ink">
                        {p.totalEmployees}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-right font-semibold text-brand-ember-5">
                        {formatMoney(p.totalNet)}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-right">
                        <a
                          href={`/hr/payroll/${p.id}`}
                          className="inline-flex items-center gap-1 text-sm font-medium text-brand-ember-5 hover:text-brand-ember-6"
                        >
                          {t('history.detail')}
                          <svg
                            aria-hidden="true"
                            className="h-3.5 w-3.5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M8.25 4.5l7.5 7.5-7.5 7.5"
                            />
                          </svg>
                        </a>
                      </TableCell>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
