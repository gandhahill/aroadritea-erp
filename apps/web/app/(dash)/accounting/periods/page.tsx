import type { Metadata } from 'next';
import { getLocale } from 'next-intl/server';

import { fetchAccountingPeriods } from './actions';
import { OpenPeriodButton, ClosePeriodButton } from './periods-client';

export const metadata: Metadata = {
  title: 'Accounting Periods - Aroadri ERP',
};

const PAGE_COPY = {
  id: {
    title: 'Periode Akuntansi',
    subtitle: 'Pantau periode buku, status tutup buku, dan jumlah jurnal per periode.',
    open: 'Terbuka',
    closing: 'Proses tutup',
    closed: 'Tertutup',
    empty: 'Belum ada periode akuntansi.',
    emptyHint:
      'Periode akan muncul setelah data awal akuntansi di-seed atau dibuat dari pengaturan akuntansi.',
    period: 'Periode',
    dateRange: 'Rentang tanggal',
    status: 'Status',
    journals: 'Jurnal',
    closedAt: 'Ditutup pada',
    notClosed: 'Belum ditutup',
    draft: 'draft',
    posted: 'posted',
    reversed: 'reversed',
    periodAction: {
      openPeriod: 'Buka Periode',
      openPeriodSubtitle: 'Buat periode akuntansi baru. Pastikan tidak ada duplikasi kode periode.',
      closePeriod: 'Tutup Periode',
      confirmClose: 'Konfirmasi Penutupan',
      confirmCloseMessage: 'Apakah Anda yakin ingin menutup periode ini?',
      forceClose: 'Tutup Paksa',
      draftWarning: 'Peringatan: Masih ada {count} jurnal berstatus draft di periode ini.',
      code: 'Kode Periode (YYYY-MM)',
      startDate: 'Tanggal Mulai',
      endDate: 'Tanggal Selesai'
    }
  },
  en: {
    title: 'Accounting Periods',
    subtitle: 'Review bookkeeping periods, closing status, and journal volume per period.',
    open: 'Open',
    closing: 'Closing',
    closed: 'Closed',
    empty: 'No accounting periods yet.',
    emptyHint:
      'Periods will appear after accounting seed data is loaded or created from accounting settings.',
    period: 'Period',
    dateRange: 'Date range',
    status: 'Status',
    journals: 'Journals',
    closedAt: 'Closed at',
    notClosed: 'Not closed',
    draft: 'draft',
    posted: 'posted',
    reversed: 'reversed',
    periodAction: {
      openPeriod: 'Open Period',
      openPeriodSubtitle: 'Create a new accounting period. Ensure there are no duplicate period codes.',
      closePeriod: 'Close Period',
      confirmClose: 'Confirm Close',
      confirmCloseMessage: 'Are you sure you want to close this period?',
      forceClose: 'Force Close',
      draftWarning: 'Warning: There are {count} draft journals in this period.',
      code: 'Period Code (YYYY-MM)',
      startDate: 'Start Date',
      endDate: 'End Date'
    }
  },
  zh: {
    title: '会计期间',
    subtitle: '查看会计期间、结账状态和每期凭证数量。',
    open: '开放',
    closing: '结账中',
    closed: '已关闭',
    empty: '暂无会计期间。',
    emptyHint: '导入或创建会计基础数据后，会计期间会显示在这里。',
    period: '期间',
    dateRange: '日期范围',
    status: '状态',
    journals: '凭证',
    closedAt: '关闭时间',
    notClosed: '未关闭',
    draft: '草稿',
    posted: '已过账',
    reversed: '已冲销',
    periodAction: {
      openPeriod: '开立期间',
      openPeriodSubtitle: '创建一个新的会计期间。确保没有重复的期间代码。',
      closePeriod: '结账',
      confirmClose: '确认结账',
      confirmCloseMessage: '您确定要结束此期间吗？',
      forceClose: '强制结账',
      draftWarning: '警告：此期间还有 {count} 个草稿凭证。',
      code: '期间代码 (YYYY-MM)',
      startDate: '开始日期',
      endDate: '结束日期'
    }
  },
} as const;

function getCopy(locale: string) {
  return PAGE_COPY[locale as keyof typeof PAGE_COPY] ?? PAGE_COPY.id;
}

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
  const copy = getCopy(locale);
  const rows = await fetchAccountingPeriods();
  const openCount = rows.filter((row) => row.status === 'open').length;
  const closingCount = rows.filter((row) => row.status === 'closing').length;
  const closedCount = rows.filter((row) => row.status === 'closed').length;

  return (
    <main className="min-h-screen bg-brand-paper text-brand-ink">
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-5 py-8 lg:px-8">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand-red/80">
            Accounting
          </p>
          <div className="flex items-center justify-between">
            <h1 className="font-display text-3xl font-semibold text-brand-ink">{copy.title}</h1>
            <OpenPeriodButton copy={{ period: copy.periodAction }} />
          </div>
          <p className="max-w-3xl text-sm leading-6 text-brand-muted">{copy.subtitle}</p>
        </div>

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
                    <th className="px-4 py-3 font-semibold">{copy.period}</th>
                    <th className="px-4 py-3 font-semibold">{copy.dateRange}</th>
                    <th className="px-4 py-3 font-semibold">{copy.status}</th>
                    <th className="px-4 py-3 font-semibold">{copy.journals}</th>
                    <th className="px-4 py-3 font-semibold">{copy.closedAt}</th>
                    <th className="px-4 py-3 font-semibold">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-ink/10">
                  {rows.map((row) => (
                    <tr key={row.id} className="hover:bg-brand-paper/70">
                      <td className="px-4 py-3 font-semibold text-brand-ink">{row.code}</td>
                      <td className="px-4 py-3 text-brand-muted">
                        {formatDate(row.startDate, locale)} - {formatDate(row.endDate, locale)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass(row.status)}`}
                        >
                          {copy[
                            row.status as keyof Pick<typeof copy, 'open' | 'closing' | 'closed'>
                          ] ?? row.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-brand-muted">
                        {row.draftCount} {copy.draft} / {row.postedCount} {copy.posted} /{' '}
                        {row.reversedCount} {copy.reversed}
                      </td>
                      <td className="px-4 py-3 text-brand-muted">
                        {row.closedAt ? formatDate(row.closedAt, locale) : copy.notClosed}
                      </td>
                      <td className="px-4 py-3">
                        {row.status !== 'closed' && (
                          <ClosePeriodButton 
                            periodCode={row.code}
                            draftCount={row.draftCount}
                            copy={{ period: copy.periodAction }}
                          />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
