/**
 * Balance Sheet Page — SD §21.2
 */

import { PageHeader } from '@/components/page-header';
import { getSession } from '@/lib/auth';
import { pickLocalized } from '@/lib/pick-localized';
import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { fetchBalanceSheet } from '../actions';
import { ExportXlsxButton } from '../export-button';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('reporting.balanceSheet');
  return { title: `${t('title')} | Aroadri ERP` };
}

export default async function BalanceSheetPage({
  searchParams,
}: {
  searchParams: Promise<{ asOf?: string; locationId?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');

  const params = await searchParams;
  const tenantId = ((session.user as Record<string, unknown>)?.tenantId as string) ?? 'default';
  const asOf = params.asOf ?? new Date().toISOString().slice(0, 10);
  const data = await fetchBalanceSheet(tenantId, asOf, params.locationId);
  const locale = await getLocale();
  const t = await getTranslations('reporting.balanceSheet');

  return (
    <div className="space-y-6">
      <PageHeader
        title={<>{t('title')}</>}
        description={
          <>
            {t('subtitle')}
            <span className="font-medium text-brand-ink">{asOf}</span>
          </>
        }
        actions={
          <>
            <div className="flex items-center gap-3">
              {data?.isBalanced ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-jade-light px-3 py-1 text-xs font-medium text-brand-jade">
                  <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </span>
              ) : data ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1 text-xs font-medium text-rose-600">
                  {t('notBalanced')}
                </span>
              ) : null}
              {data ? (
                <ExportXlsxButton
                  filename={`balance-sheet-${asOf}.xlsx`}
                  sheets={[
                    {
                      name: t('assets'),
                      rows: [
                        [t('columns.account'), '', t('columns.amount')],
                        ...data.assets.accounts.map((a) => [
                          a.accountCode,
                          pickLocalized(a.accountName, locale),
                          Number(a.balance),
                        ]),
                        ['', t('totalAssets'), Number(data.assets.total)],
                      ],
                    },
                    {
                      name: t('liabilities'),
                      rows: [
                        [t('columns.account'), '', t('columns.amount')],
                        ...data.liabilities.accounts.map((a) => [
                          a.accountCode,
                          pickLocalized(a.accountName, locale),
                          Number(a.balance),
                        ]),
                        ['', t('total'), Number(data.liabilities.total)],
                      ],
                    },
                    {
                      name: t('equity'),
                      rows: [
                        [t('columns.account'), '', t('columns.amount')],
                        ...data.equity.accounts.map((a) => [
                          a.accountCode,
                          pickLocalized(a.accountName, locale),
                          Number(a.balance),
                        ]),
                        ['', t('retainedEarnings'), Number(data.retainedEarnings)],
                        ['', t('total'), Number(data.totalEquityWithRetained)],
                      ],
                    },
                    {
                      name: 'Summary',
                      rows: [
                        ['As Of', asOf],
                        [t('totalAssets'), Number(data.assets.total)],
                        [t('totalLiabilitiesAndEquity'), Number(data.totalLiabilitiesAndEquity)],
                        ['Balanced?', data.isBalanced ? 'YES' : 'NO'],
                        ['Preliminary?', data.isPreliminary ? 'YES' : 'NO'],
                      ],
                    },
                  ]}
                />
              ) : null}
            </div>
          </>
        }
      />

      {data ? (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Left: Assets */}
          <div className="space-y-4">
            <SectionCard
              title={t('assets')}
              accounts={data.assets.accounts}
              total={data.assets.total}
              colorClass="text-brand-jade"
              locale={locale}
              totalLabel={t('total')}
            />
          </div>

          {/* Right: Liabilities + Equity */}
          <div className="space-y-4">
            <SectionCard
              title={t('liabilities')}
              accounts={data.liabilities.accounts}
              total={data.liabilities.total}
              colorClass="text-brand-clay"
              locale={locale}
              totalLabel={t('total')}
            />
            <SectionCard
              title={t('equity')}
              accounts={data.equity.accounts}
              total={data.equity.total}
              colorClass="text-brand-gold"
              extraLines={[{ label: t('retainedEarnings'), value: data.retainedEarnings }]}
              locale={locale}
              totalLabel={t('total')}
            />

            {/* Totals */}
            <div className="surface-card p-4">
              <div className="flex items-center justify-between border-t-2 border-brand-cream-3 pt-3">
                <span className="text-sm font-semibold text-brand-ink">
                  {t('totalLiabilitiesAndEquity')}
                </span>
                <span className="font-mono text-sm font-bold tabular-nums text-brand-ink">
                  {fmtRp(data.totalLiabilitiesAndEquity)}
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <EmptyState message={t('empty')} />
      )}
    </div>
  );
}

// --- Section Card ---

interface SectionCardProps {
  title: string;
  accounts: Array<{ accountCode: string; accountName: Record<string, string>; balance: string }>;
  total: string;
  totalLabel?: string;
  colorClass: string;
  extraLines?: Array<{ label: string; value: string }>;
  locale?: string;
}

function SectionCard({
  title,
  accounts,
  total,
  totalLabel,
  colorClass,
  extraLines,
  locale,
}: SectionCardProps) {
  return (
    <div className="surface-card overflow-hidden">
      <div className="border-b border-brand-cream-2 px-4 py-3">
        <h2 className="text-base font-semibold text-brand-ink">{title}</h2>
      </div>
      <div className="divide-y divide-brand-cream-2">
        {accounts.map((acct) => (
          <div
            key={acct.accountCode}
            className="flex items-center justify-between px-4 py-2.5 hover:bg-brand-cream/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-brand-ink-3 tabular-nums">
                {acct.accountCode}
              </span>
              <span className="text-sm text-brand-ink">
                {pickLocalized(acct.accountName, locale, acct.accountCode)}
              </span>
            </div>
            <span className={`font-mono text-sm tabular-nums ${colorClass}`}>
              {fmtRp(acct.balance)}
            </span>
          </div>
        ))}
        {extraLines?.map((line) => (
          <div
            key={line.label}
            className="flex items-center justify-between px-4 py-2.5 bg-brand-cream/30"
          >
            <span className="text-sm text-brand-ink-2 italic">{line.label}</span>
            <span className={`font-mono text-sm tabular-nums ${colorClass}`}>
              {fmtRp(line.value)}
            </span>
          </div>
        ))}
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
