/**
 * My Attendance — T-0181 (self-service attendance history).
 *
 * Every authenticated user sees their own check-in records (matched
 * by their email ↔ employees.email, same pattern as my-payslips).
 * Default window is the current month; filter via querystring
 * `?from=YYYY-MM-DD&to=YYYY-MM-DD`.
 */

import { PageHeader } from '@/components/page-header';
import { getSession } from '@/lib/auth';
import { listMyAttendance } from '@erp/services/hr';
import type { AuditContext } from '@erp/shared/types';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';

export const metadata: Metadata = { title: 'My Attendance | Aroadri ERP' };

function firstOfMonth(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function fmtDateTime(d: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

function fmtDate(d: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  }).format(d);
}

function fmtMinutes(n: number | null): string {
  if (n == null) return '—';
  const h = Math.floor(n / 60);
  const m = n % 60;
  return `${h}j ${m}m`;
}

export default async function MyAttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');
  const user = session.user as Record<string, unknown>;
  const ctx: AuditContext = {
    userId: String(user.id ?? ''),
    tenantId: String(user.tenantId ?? 'default'),
    locationId: String(user.locationId ?? ''),
  };
  const params = await searchParams;
  const from = params.from ?? firstOfMonth();
  const to = params.to ?? today();
  const t = await getTranslations('hr.myAttendance');
  const locale = (await getTranslations('hr.myAttendance')) as unknown as { _locale?: string };
  // getTranslations doesn't expose the locale directly; fall back to id-ID.
  const localeStr = 'id-ID';

  const result = await listMyAttendance({ dateFrom: from, dateTo: to }, ctx);
  const items = result.ok ? result.value : [];

  // Aggregate summary cards.
  const totalDays = items.length;
  const lateDays = items.filter((r) => r.isLate && !r.lateForgiven).length;
  const totalWorked = items.reduce((s, r) => s + (r.workedMinutes ?? 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader title={t('title')} description={t('description')} />

      {/* Filter */}
      <form className="flex flex-wrap items-end gap-3 rounded-xl border border-brand-cream-3 bg-card p-3">
        <label className="space-y-1 text-sm">
          <span className="text-brand-ink-2">{t('from')}</span>
          <input
            type="date"
            name="from"
            defaultValue={from}
            className="rounded-lg border border-brand-cream-3 bg-card px-3 py-2 text-sm"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-brand-ink-2">{t('to')}</span>
          <input
            type="date"
            name="to"
            defaultValue={to}
            className="rounded-lg border border-brand-cream-3 bg-card px-3 py-2 text-sm"
          />
        </label>
        <button
          type="submit"
          className="rounded-lg bg-brand-red px-4 py-2 text-sm font-medium text-white"
        >
          {t('filter')}
        </button>
      </form>

      {/* Summary cards */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card label={t('totalDays')} value={String(totalDays)} />
        <Card label={t('lateDays')} value={String(lateDays)} tone={lateDays > 0 ? 'rose' : null} />
        <Card label={t('totalWorked')} value={fmtMinutes(totalWorked)} />
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-brand-cream-3 bg-card">
        <table className="w-full text-sm">
          <thead className="bg-brand-cream-2/60 text-left text-xs uppercase text-brand-ink-2">
            <tr>
              <th className="px-3 py-2">{t('table.date')}</th>
              <th className="px-3 py-2">{t('table.shift')}</th>
              <th className="px-3 py-2">{t('table.checkIn')}</th>
              <th className="px-3 py-2">{t('table.checkOut')}</th>
              <th className="px-3 py-2 text-right">{t('table.worked')}</th>
              <th className="px-3 py-2">{t('table.status')}</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-brand-ink-3">
                  {t('empty')}
                </td>
              </tr>
            ) : (
              items.map((r) => (
                <tr key={r.id} className="border-t border-brand-cream-3">
                  <td className="px-3 py-2 text-brand-ink-2">
                    {fmtDate(new Date(r.checkInAt), localeStr)}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{r.shiftCode ?? '—'}</td>
                  <td className="px-3 py-2 text-brand-ink">
                    {fmtDateTime(new Date(r.checkInAt), localeStr)}
                  </td>
                  <td className="px-3 py-2 text-brand-ink">
                    {r.checkOutAt ? fmtDateTime(new Date(r.checkOutAt), localeStr) : '—'}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">{fmtMinutes(r.workedMinutes)}</td>
                  <td className="px-3 py-2">
                    {r.isLate ? (
                      r.lateForgiven ? (
                        <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                          {t('forgiven')}
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-700">
                          {t('lateBy', { minutes: r.lateMinutes })}
                        </span>
                      )
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                        {t('onTime')}
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Card({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'rose' | null;
}) {
  const valueClass = tone === 'rose' ? 'text-rose-600' : 'text-brand-ink';
  return (
    <div className="rounded-xl border border-brand-cream-3 bg-card p-3">
      <p className="text-xs uppercase tracking-wide text-brand-ink-3">{label}</p>
      <p className={`mt-1 text-xl font-bold ${valueClass}`}>{value}</p>
    </div>
  );
}
