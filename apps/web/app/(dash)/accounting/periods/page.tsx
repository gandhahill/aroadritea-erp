import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';

import { PageHeader } from '@/components/page-header';
import { TableCell, TableHead } from '@erp/ui';
import { fetchAccountingPeriods } from './actions';
import { ClosePeriodButton, OpenPeriodButton } from './periods-client';

export const metadata: Metadata = {
  title: 'Accounting Periods',
};





function toIntlLocale(locale: string) {
  if (locale === 'zh') return 'zh-CN';
  if (locale === 'en') return 'en-US';
  return 'id-ID';
}

function formatDate(value: Date | string | null, locale: string) {
  if (!value) return '-';
  return new Intl.DateTimeFormat(toIntlLocale(locale), {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

function statusClass(status: string) {
  if (status === 'closed') return 'border-brand-ink/20 bg-brand-ink/10 text-brand-ink';
  if (status === 'closing') return 'border-brand-gold/40 bg-brand-gold/15 text-brand-wood';
  return 'border-brand-jade/30 bg-brand-jade/10 text-brand-jade';
}

export default async function AccountingPeriodsPage() {
  const locale = await getLocale();
  const t = await getTranslations('accounting.periods');
  const copy = {
    title: t('title'),
    subtitle: t('subtitle'),
    open: t('open'),
    closing: t('closing'),
    closed: t('closed'),
    empty: t('empty'),
    emptyHint: t('emptyHint'),
    period: t('period'),
    dateRange: t('dateRange'),
    status: t('status'),
    journals: t('journals'),
    actions: t('actions'),
    closedAt: t('closedAt'),
    notClosed: t('notClosed'),
    draft: t('draft'),
    posted: t('posted'),
    reversed: t('reversed'),
    periodAction: t.raw('periodAction')
  };
  const rows = await fetchAccountingPeriods();
  const openCount = rows.filter((row) => row.status === 'open').length;
  const closingCount = rows.filter((row) => row.status === 'closing').length;
  const closedCount = rows.filter((row) => row.status === 'closed').length;

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-6">
        <PageHeader 
          title={<>{copy.title}</>} 
          description={<>{copy.subtitle}</>} 
          actions={<OpenPeriodButton copy={{ period: copy.periodAction }} />}
        />

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-brand-jade/20 bg-brand-jade/10 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-jade">
              {copy.open}
            </p>
            <p className="mt-2 text-3xl font-semibold text-brand-ink">{openCount}</p>
          </div>
          <div className="rounded-lg border border-brand-gold/30 bg-brand-gold/15 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-wood">
              {copy.closing}
            </p>
            <p className="mt-2 text-3xl font-semibold text-brand-ink">{closingCount}</p>
          </div>
          <div className="rounded-lg border border-brand-ink/10 bg-brand-porcelain p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-muted">
              {copy.closed}
            </p>
            <p className="mt-2 text-3xl font-semibold text-brand-ink">{closedCount}</p>
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="rounded-lg border border-brand-ink/10 bg-brand-porcelain p-6">
            <h2 className="font-display text-xl font-semibold text-brand-ink">{copy.empty}</h2>
            <p className="mt-2 text-sm leading-6 text-brand-muted">{copy.emptyHint}</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-brand-ink/10 bg-brand-porcelain">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-brand-ink/10 bg-brand-paper/70 text-xs uppercase tracking-[0.14em] text-brand-muted">
                  <tr>
                    <TableHead className="px-4 py-3 font-semibold">{copy.period}</TableHead>
                    <TableHead className="px-4 py-3 font-semibold">{copy.dateRange}</TableHead>
                    <TableHead className="px-4 py-3 font-semibold">{copy.status}</TableHead>
                    <TableHead className="px-4 py-3 font-semibold">{copy.journals}</TableHead>
                    <TableHead className="px-4 py-3 font-semibold">{copy.closedAt}</TableHead>
                    <TableHead className="px-4 py-3 font-semibold">{copy.actions}</TableHead>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-ink/10">
                  {rows.map((row) => (
                    <tr key={row.id} className="hover:bg-brand-paper/70">
                      <TableCell className="px-4 py-3 font-semibold text-brand-ink">
                        {row.code}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-brand-muted">
                        {formatDate(row.startDate, locale)} - {formatDate(row.endDate, locale)}
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass(row.status)}`}
                        >
                          {copy[
                            row.status as keyof Pick<typeof copy, 'open' | 'closing' | 'closed'>
                          ] ?? row.status}
                        </span>
                      </TableCell>
                      <TableCell className="px-4 py-3 text-brand-muted">
                        {row.draftCount} {copy.draft} / {row.postedCount} {copy.posted} /{' '}
                        {row.reversedCount} {copy.reversed}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-brand-muted">
                        {row.closedAt ? formatDate(row.closedAt, locale) : copy.notClosed}
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        {row.status !== 'closed' && (
                          <ClosePeriodButton
                            periodCode={row.code}
                            draftCount={row.draftCount}
                            copy={{ period: copy.periodAction }}
                          />
                        )}
                      </TableCell>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
