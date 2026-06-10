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
import { and, db, eq, sql } from '@erp/db';
import { shiftAssignments } from '@erp/db/schema/hr';
import { listMyAttendance } from '@erp/services/hr';
import { resolveEmployeeForUser } from '@erp/services/hr';
import { getDispensedDetailsForPeriod } from '@erp/services/hr';
import type { AuditContext } from '@erp/shared/types';
import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('hr.myAttendance');
  return { title: t('title') };
}

function firstOfMonth(): string {
  const wib = new Date(Date.now() + 7 * 60 * 60 * 1000);
  return `${wib.getUTCFullYear()}-${String(wib.getUTCMonth() + 1).padStart(2, '0')}-01`;
}

function today(): string {
  return new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
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

function toIntlLocale(locale: string): string {
  if (locale.startsWith('en')) return 'en-US';
  if (locale.startsWith('zh')) return 'zh-CN';
  return 'id-ID';
}

function toWibDateString(d: Date): string {
  return new Date(d.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function fromIsoDate(value: string): Date {
  return new Date(`${value}T00:00:00+07:00`);
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
  const [t, rawLocale] = await Promise.all([
    getTranslations('hr.myAttendance'),
    getLocale().catch(() => 'id'),
  ]);
  const localeStr = toIntlLocale(rawLocale);

  const result = await listMyAttendance({ dateFrom: from, dateTo: to }, ctx);
  const items = result.ok ? result.value : [];

  // Aggregate summary cards.
  const totalDays = items.length;
  const lateDays = items.filter((r) => r.isLate && !r.lateForgiven).length;
  const checkedOutItems = items.filter((r) => r.checkOutAt != null);
  const totalWorked = checkedOutItems.reduce((s, r) => s + (r.workedMinutes ?? 0), 0);

  // Count scheduled shift days and dispensations for this employee in the date range
  let absentDays = 0;
  let dispensations: Array<{ workDate: string; reason: string; givenBy?: string | null }> = [];
  const emp = await resolveEmployeeForUser(ctx.tenantId, ctx.userId);
  if (emp) {
    const [schedRow] = await db
      .select({ count: sql<number>`cast(count(*) as int)` })
      .from(shiftAssignments)
      .where(
        and(
          eq(shiftAssignments.tenantId, ctx.tenantId),
          eq(shiftAssignments.employeeId, emp.id),
          eq(shiftAssignments.kind, 'shift'),
          sql`${shiftAssignments.workDate} >= ${from}`,
          sql`${shiftAssignments.workDate} <= ${to}`,
        ),
      );
    const scheduledDays = schedRow?.count ?? 0;

    const dispensedMap = await getDispensedDetailsForPeriod(ctx.tenantId, [emp.id], from, to);
    dispensations = dispensedMap.get(emp.id) ?? [];
    const dispensedCount = dispensations.length;

    absentDays = Math.max(0, scheduledDays - totalDays - dispensedCount);
  }

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
      <div className="grid gap-3 sm:grid-cols-4">
        <Card label={t('totalDays')} value={String(totalDays)} />
        <Card
          label={t('absentDays')}
          value={String(absentDays)}
          tone={absentDays > 0 ? 'rose' : null}
        />
        <Card label={t('lateDays')} value={String(lateDays)} tone={lateDays > 0 ? 'rose' : null} />
        <Card
          label={t('totalWorked')}
          value={checkedOutItems.length > 0 ? fmtMinutes(totalWorked) : '—'}
          subtitle={
            checkedOutItems.length < totalDays && totalDays > 0
              ? t('workedNote', {
                  checked: checkedOutItems.length,
                  total: totalDays,
                })
              : undefined
          }
        />
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-brand-cream-3 bg-card">
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
                    {r.lateForgivenReason && (
                      <span className="mt-0.5 block text-[10px] text-amber-600">
                        {t('lateDispensationReason')}: {r.lateForgivenReason}
                      </span>
                    )}
                    {(() => {
                      const dateStr = toWibDateString(new Date(r.checkInAt));
                      const disp = dispensations.find((d) => d.workDate === dateStr);
                      if (!disp) return null;
                      return (
                        <span className="mt-0.5 block text-[10px] text-amber-600">
                          {t('dispensationReason')}: {disp.reason}
                        </span>
                      );
                    })()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {dispensations.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-brand-cream-3 bg-card">
          <div className="border-b border-brand-cream-3 px-3 py-2">
            <h3 className="text-sm font-semibold text-brand-ink">{t('dispensations')}</h3>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-brand-cream-2/60 text-left text-xs uppercase text-brand-ink-2">
              <tr>
                <th className="px-3 py-2">{t('table.date')}</th>
                <th className="px-3 py-2">{t('dispensationReason')}</th>
                <th className="px-3 py-2">{t('dispensationBy')}</th>
              </tr>
            </thead>
            <tbody>
              {dispensations.map((d) => (
                <tr key={d.workDate} className="border-t border-brand-cream-3">
                  <td className="px-3 py-2 text-brand-ink-2">
                    {fmtDate(fromIsoDate(d.workDate), localeStr)}
                  </td>
                  <td className="px-3 py-2 text-brand-ink">{d.reason}</td>
                  <td className="px-3 py-2 text-brand-ink-3">{d.givenBy ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Card({
  label,
  value,
  tone,
  subtitle,
}: {
  label: string;
  value: string;
  tone?: 'rose' | null;
  subtitle?: string;
}) {
  const valueClass = tone === 'rose' ? 'text-rose-600' : 'text-brand-ink';
  return (
    <div className="rounded-xl border border-brand-cream-3 bg-card p-3">
      <p className="text-xs uppercase tracking-wide text-brand-ink-3">{label}</p>
      <p className={`mt-1 text-xl font-bold ${valueClass}`}>{value}</p>
      {subtitle && <p className="mt-0.5 text-[11px] text-brand-ink-3">{subtitle}</p>}
    </div>
  );
}
