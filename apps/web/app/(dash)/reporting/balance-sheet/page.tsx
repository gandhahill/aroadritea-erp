/**
 * Balance Sheet Page — SD §21.2
 */

import { getSession } from '@/lib/auth';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { fetchBalanceSheet } from '../actions';
import { ExportXlsxButton } from '../export-button';

export const metadata: Metadata = {
  title: 'Balance Sheet',
};

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brand-ink">Balance Sheet</h1>
          <p className="mt-1 text-sm text-brand-ink-3">
            Neraca as of <span className="font-medium text-brand-ink">{asOf}</span>
          </p>
        </div>
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
              Balanced
            </span>
          ) : data ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1 text-xs font-medium text-rose-600">
              ⚠ Unbalanced
            </span>
          ) : null}
          {data ? (
            <ExportXlsxButton
              filename={`balance-sheet-${asOf}.xlsx`}
              sheets={[
                {
                  name: 'Assets',
                  rows: [
                    ['Code', 'Name', 'Balance (IDR)'],
                    ...data.assets.accounts.map((a) => [
                      a.accountCode,
                      a.accountName.id ?? a.accountName.en ?? '',
                      Number(a.balance),
                    ]),
                    ['', 'TOTAL ASSETS', Number(data.assets.total)],
                  ],
                },
                {
                  name: 'Liabilities',
                  rows: [
                    ['Code', 'Name', 'Balance (IDR)'],
                    ...data.liabilities.accounts.map((a) => [
                      a.accountCode,
                      a.accountName.id ?? a.accountName.en ?? '',
                      Number(a.balance),
                    ]),
                    ['', 'TOTAL LIABILITIES', Number(data.liabilities.total)],
                  ],
                },
                {
                  name: 'Equity',
                  rows: [
                    ['Code', 'Name', 'Balance (IDR)'],
                    ...data.equity.accounts.map((a) => [
                      a.accountCode,
                      a.accountName.id ?? a.accountName.en ?? '',
                      Number(a.balance),
                    ]),
                    ['', 'Retained Earnings', Number(data.retainedEarnings)],
                    ['', 'TOTAL EQUITY', Number(data.totalEquityWithRetained)],
                  ],
                },
                {
                  name: 'Summary',
                  rows: [
                    ['As Of', asOf],
                    ['Total Assets', Number(data.assets.total)],
                    ['Total Liabilities + Equity', Number(data.totalLiabilitiesAndEquity)],
                    ['Balanced?', data.isBalanced ? 'YES' : 'NO'],
                    ['Preliminary?', data.isPreliminary ? 'YES' : 'NO'],
                  ],
                },
              ]}
            />
          ) : null}
        </div>
      </div>

      {data ? (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Left: Assets */}
          <div className="space-y-4">
            <SectionCard
              title="Assets"
              subtitle="Aset"
              accounts={data.assets.accounts}
              total={data.assets.total}
              colorClass="text-brand-jade"
            />
          </div>

          {/* Right: Liabilities + Equity */}
          <div className="space-y-4">
            <SectionCard
              title="Liabilities"
              subtitle="Kewajiban"
              accounts={data.liabilities.accounts}
              total={data.liabilities.total}
              colorClass="text-brand-clay"
            />
            <SectionCard
              title="Equity"
              subtitle="Ekuitas"
              accounts={data.equity.accounts}
              total={data.equity.total}
              colorClass="text-brand-gold"
              extraLines={[{ label: 'Retained Earnings', value: data.retainedEarnings }]}
            />

            {/* Totals */}
            <div className="surface-card p-4">
              <div className="flex items-center justify-between border-t-2 border-brand-cream-3 pt-3">
                <span className="text-sm font-semibold text-brand-ink">
                  Total Liabilities + Equity
                </span>
                <span className="font-mono text-sm font-bold tabular-nums text-brand-ink">
                  {fmtRp(data.totalLiabilitiesAndEquity)}
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <EmptyState />
      )}
    </div>
  );
}

// --- Section Card ---

interface SectionCardProps {
  title: string;
  subtitle: string;
  accounts: Array<{ accountCode: string; accountName: Record<string, string>; balance: string }>;
  total: string;
  colorClass: string;
  extraLines?: Array<{ label: string; value: string }>;
}

function SectionCard({
  title,
  subtitle,
  accounts,
  total,
  colorClass,
  extraLines,
}: SectionCardProps) {
  return (
    <div className="surface-card overflow-hidden">
      <div className="border-b border-brand-cream-2 px-4 py-3">
        <h2 className="text-base font-semibold text-brand-ink">{title}</h2>
        <p className="text-xs text-brand-ink-3">{subtitle}</p>
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
                {acct.accountName.id ?? acct.accountName.en}
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
        <span className="text-sm font-semibold text-brand-ink">Total {title}</span>
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

function EmptyState() {
  return (
    <div className="surface-card flex flex-col items-center justify-center py-16 text-brand-ink-3">
      <p className="text-sm font-medium">No data available for this date.</p>
    </div>
  );
}
