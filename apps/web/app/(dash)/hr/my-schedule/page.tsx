import { PageHeader } from '@/components/page-header';
import { getSession } from '@/lib/auth';
import { listMySchedule } from '@erp/services/hr';
import type { AuditContext } from '@erp/shared/types';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';

export const metadata: Metadata = { title: 'My Schedule' };

function firstOfWeek(): string {
  const d = new Date();
  const day = d.getDay(); // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day;
  const start = new Date(d);
  start.setDate(start.getDate() + diff);
  return start.toISOString().slice(0, 10);
}

function fmtDate(d: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

export default async function MySchedulePage({
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
  // Default show 4 weeks of schedule starting from this week's Monday
  const defaultFrom = firstOfWeek();
  const d = new Date(defaultFrom);
  d.setDate(d.getDate() + 27); // + 4 weeks minus 1 day
  const defaultTo = d.toISOString().slice(0, 10);

  const from = params.from ?? defaultFrom;
  const to = params.to ?? defaultTo;
  
  const t = await getTranslations('hr.mySchedule');
  const localeStr = 'id-ID';

  const result = await listMySchedule({ dateFrom: from, dateTo: to }, ctx);
  const items = result.ok ? result.value : [];

  return (
    <div className="space-y-6">
      <PageHeader title={t('title')} description={t('description')} />

      {/* Filter */}
      <form className="flex flex-wrap items-end gap-3 rounded-xl border border-brand-cream-3 bg-card p-3">
        <label className="space-y-1 text-sm">
          <span className="text-brand-ink-2">{t('from', { defaultValue: 'Dari Tanggal' })}</span>
          <input
            type="date"
            name="from"
            defaultValue={from}
            className="rounded-lg border border-brand-cream-3 bg-card px-3 py-2 text-sm"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-brand-ink-2">{t('to', { defaultValue: 'Sampai Tanggal' })}</span>
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
          {t('filter', { defaultValue: 'Filter' })}
        </button>
      </form>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-brand-cream-3 bg-card">
        <table className="w-full text-sm">
          <thead className="bg-brand-cream-2/60 text-left text-xs uppercase text-brand-ink-2">
            <tr>
              <th className="px-4 py-3">{t('table.date', { defaultValue: 'Tanggal' })}</th>
              <th className="px-4 py-3">{t('table.status', { defaultValue: 'Status' })}</th>
              <th className="px-4 py-3">{t('table.shift', { defaultValue: 'Shift' })}</th>
              <th className="px-4 py-3">{t('table.time', { defaultValue: 'Waktu' })}</th>
              <th className="px-4 py-3">{t('table.notes', { defaultValue: 'Catatan' })}</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-brand-ink-3">
                  {t('empty', { defaultValue: 'Tidak ada jadwal pada rentang tanggal ini.' })}
                </td>
              </tr>
            ) : (
              items.map((r) => (
                <tr key={r.id} className="border-t border-brand-cream-3">
                  <td className="px-4 py-3 text-brand-ink font-medium">
                    {fmtDate(new Date(r.workDate), localeStr)}
                  </td>
                  <td className="px-4 py-3">
                    {r.kind === 'off' ? (
                      <span className="inline-flex items-center rounded-full bg-brand-cream-3 px-2 py-0.5 text-xs font-medium text-brand-ink">
                        {t('off', { defaultValue: 'Libur' })}
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                        {t('work', { defaultValue: 'Kerja' })}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-brand-ink-2">
                    {r.kind === 'off' ? '—' : r.shiftName || r.shiftCode || '—'}
                  </td>
                  <td className="px-4 py-3 font-mono text-brand-ink-2">
                    {r.kind === 'off' ? '—' : (r.startTime ? `${r.startTime} - ${r.endTime}` : '—')}
                  </td>
                  <td className="px-4 py-3 text-brand-ink-2 max-w-xs truncate">
                    {r.notes || '—'}
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
