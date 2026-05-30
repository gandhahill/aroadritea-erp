/**
 * Profit & Loss Page — SD §21.2
 */

import { PageHeader } from '@/components/page-header';
import { getSession } from '@/lib/auth';
import { pickLocalized } from '@/lib/pick-localized';
import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { fetchProfitLoss } from '../actions';
import { ExportXlsxButton } from '../export-button';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('reporting.profitLoss');
  return { title: `${t('title')}` };
}

export default async function ProfitLossPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; locationId?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');

  const params = await searchParams;
  const tenantId = ((session.user as Record<string, unknown>)?.tenantId as string) ?? 'default';
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = today.slice(0, 7) + '-01';
  const from = params.from ?? monthStart;
  const to = params.to ?? today;
  const data = await fetchProfitLoss(tenantId, from, to, params.locationId);
  const locale = await getLocale();
  const t = await getTranslations('reporting.profitLoss');

  return (
    <div className="space-y-6">
      <PageHeader
        title={<>{t('title')}</>}
        description={
          <>
            {t('subtitle')}
            <span className="font-medium text-brand-ink">{from}</span>—{' '}
            <span className="font-medium text-brand-ink">{to}</span>
          </>
        }
        actions={
          <>
            {data ? (
              <ExportXlsxButton
                filename={`profit-loss-${from}_to_${to}.xlsx`}
                sheets={[
                  {
                    name: t('revenue'),
                    rows: [
                      [t('columns.account'), '', t('columns.amount')],
                      ...data.revenue.lines.map((l) => [
                        l.accountCode,
                        pickLocalized(l.accountName, locale),
                        Number(l.balance),
                      ]),
                      ['', t('total'), Number(data.revenue.total)],
                    ],
                  },
                  {
                    name: t('cogs'),
                    rows: [
                      [t('columns.account'), '', t('columns.amount')],
                      ...data.cogs.lines.map((l) => [
                        l.accountCode,
                        pickLocalized(l.accountName, locale),
                        Number(l.balance),
                      ]),
                      ['', t('total'), Number(data.cogs.total)],
                    ],
                  },
                  {
                    name: t('expenses'),
                    rows: [
                      [t('columns.account'), '', t('columns.amount')],
                      ...data.expenses.lines.map((l) => [
                        l.accountCode,
                        pickLocalized(l.accountName, locale),
                        Number(l.balance),
                      ]),
                      ['', t('total'), Number(data.expenses.total)],
                    ],
                  },
                  {
                    name: 'Summary',
                    rows: [
                      ['From', from],
                      ['To', to],
                      [t('revenue'), Number(data.revenue.total)],
                      [t('cogs'), Number(data.cogs.total)],
                      [t('grossProfit'), Number(data.grossProfit)],
                      [t('expenses'), Number(data.expenses.total)],
                      [t('netProfit'), Number(data.netIncome)],
                    ],
                  },
                ]}
              />
            ) : null}
          </>
        }
      />

      {data ? (
        <div className="space-y-4">
          {/* Revenue */}
          <PLSection
            title={t('revenue')}
            lines={data.revenue.lines}
            total={data.revenue.total}
            colorClass="text-brand-jade"
            locale={locale}
            totalLabel={t('total')}
          />

          {/* COGS */}
          <PLSection
            title={t('cogs')}
            lines={data.cogs.lines}
            total={data.cogs.total}
            colorClass="text-brand-clay"
            locale={locale}
            totalLabel={t('total')}
          />

          {/* Gross Profit */}
          <div className="surface-card p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-brand-ink">{t('grossProfit')}</span>
              <span
                className={`font-mono text-base font-bold tabular-nums ${Number.parseInt(data.grossProfit) >= 0 ? 'text-brand-jade' : 'text-brand-clay'}`}
              >
                {fmtRp(data.grossProfit)}
              </span>
            </div>
          </div>

          {/* Expenses */}
          <PLSection
            title={t('expenses')}
            lines={data.expenses.lines}
            total={data.expenses.total}
            colorClass="text-brand-clay"
            locale={locale}
            totalLabel={t('total')}
          />

          {/* Net Income */}
          <div className="surface-elevated p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-brand-ink">{t('netProfit')}</h3>
              </div>
              <span
                className={`font-mono text-xl font-bold tabular-nums ${Number.parseInt(data.netIncome) >= 0 ? 'text-brand-jade' : 'text-brand-clay'}`}
              >
                {fmtRp(data.netIncome)}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <EmptyState message={t('empty')} />
      )}
    </div>
  );
}

// --- P&L Section ---

interface PLSectionProps {
  title: string;
  lines: Array<{ accountCode: string; accountName: Record<string, string>; balance: string }>;
  total: string;
  colorClass: string;
  locale?: string;
  totalLabel?: string;
}

function PLSection({ title, lines, total, colorClass, locale, totalLabel }: PLSectionProps) {
  return (
    <div className="surface-card overflow-hidden">
      <div className="border-b border-brand-cream-2 px-4 py-3">
        <h2 className="text-sm font-semibold text-brand-ink">{title}</h2>
      </div>
      <div className="divide-y divide-brand-cream-2">
        {lines.length === 0 ? (
          <div className="px-4 py-6 text-center text-xs text-brand-ink-3">No entries</div>
        ) : (
          lines.map((line) => (
            <div
              key={line.accountCode}
              className="flex items-center justify-between px-4 py-2.5 hover:bg-brand-cream/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-brand-ink-3 tabular-nums">
                  {line.accountCode}
                </span>
                <span className="text-sm text-brand-ink">
                  {pickLocalized(line.accountName, locale, line.accountCode)}
                </span>
              </div>
              <span className={`font-mono text-sm tabular-nums ${colorClass}`}>
                {fmtRp(line.balance)}
              </span>
            </div>
          ))
        )}
      </div>
      <div className="border-t-2 border-brand-cream-3 px-4 py-3 flex items-center justify-between bg-brand-cream/30">
        <span className="text-sm font-semibold text-brand-ink">
          {totalLabel} {title}
        </span>
        <span className={`font-mono text-sm font-bold tabular-nums ${colorClass}`}>
          {fmtRp(total)}
        </span>
      </div>
    </div>
  );
}

// --- Helpers ---

function fmtRp(val: string): string {
  const n = Number.parseInt(val, 10);
  if (isNaN(n) || n === 0) return '—';
  const sign = n < 0 ? '-' : '';
  return sign + 'Rp ' + Math.abs(n).toLocaleString('id-ID');
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="surface-card flex flex-col items-center justify-center py-16 text-brand-ink-3">
      <p className="text-sm font-medium">{message}</p>
    </div>
  );
}
