/**
 * Profit & Loss Page — SD §21.2
 */

import { getSession } from '@/lib/auth';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { fetchProfitLoss } from '../actions';

export const metadata: Metadata = {
  title: 'Profit & Loss',
};

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brand-ink">Profit & Loss</h1>
          <p className="mt-1 text-sm text-brand-ink-3">
            Laba Rugi: <span className="font-medium text-brand-ink">{from}</span> —{' '}
            <span className="font-medium text-brand-ink">{to}</span>
          </p>
        </div>
      </div>

      {data ? (
        <div className="space-y-4">
          {/* Revenue */}
          <PLSection
            title="Revenue"
            subtitle="Pendapatan"
            lines={data.revenue.lines}
            total={data.revenue.total}
            colorClass="text-brand-jade"
          />

          {/* COGS */}
          <PLSection
            title="Cost of Goods Sold"
            subtitle="Harga Pokok Penjualan"
            lines={data.cogs.lines}
            total={data.cogs.total}
            colorClass="text-brand-clay"
          />

          {/* Gross Profit */}
          <div className="surface-card p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-brand-ink">
                Gross Profit / Laba Kotor
              </span>
              <span
                className={`font-mono text-base font-bold tabular-nums ${Number.parseInt(data.grossProfit) >= 0 ? 'text-brand-jade' : 'text-brand-clay'}`}
              >
                {fmtRp(data.grossProfit)}
              </span>
            </div>
          </div>

          {/* Expenses */}
          <PLSection
            title="Operating Expenses"
            subtitle="Beban Operasional"
            lines={data.expenses.lines}
            total={data.expenses.total}
            colorClass="text-brand-clay"
          />

          {/* Net Income */}
          <div className="surface-elevated p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-brand-ink">Net Income</h3>
                <p className="text-xs text-brand-ink-3">Laba / Rugi Bersih</p>
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
        <EmptyState />
      )}
    </div>
  );
}

// --- P&L Section ---

interface PLSectionProps {
  title: string;
  subtitle: string;
  lines: Array<{ accountCode: string; accountName: Record<string, string>; balance: string }>;
  total: string;
  colorClass: string;
}

function PLSection({ title, subtitle, lines, total, colorClass }: PLSectionProps) {
  return (
    <div className="surface-card overflow-hidden">
      <div className="border-b border-brand-cream-2 px-4 py-3">
        <h2 className="text-sm font-semibold text-brand-ink">{title}</h2>
        <p className="text-xs text-brand-ink-3">{subtitle}</p>
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
                  {line.accountName.id ?? line.accountName.en}
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
      <p className="text-sm font-medium">No data available for this period.</p>
    </div>
  );
}
