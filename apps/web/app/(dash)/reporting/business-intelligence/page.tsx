import { getSession } from '@/lib/auth';
import { getActiveLocationOptions } from '@/lib/location-options';
import { getDailySummary } from '@erp/services/reporting';
import type { AuditContext } from '@erp/shared/types';
import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Business Intelligence',
};

function ymd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatIdr(value: bigint | string): string {
  const numeric = typeof value === 'bigint' ? Number(value) : Number(value);
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(Number.isFinite(numeric) ? numeric : 0);
}

function toBigInt(value: string | null | undefined): bigint {
  return value && /^\-?\d+$/.test(value) ? BigInt(value) : 0n;
}

export default async function BusinessIntelligencePage() {
  const session = await getSession();
  if (!session?.user) redirect('/login');

  const user = session.user as Record<string, unknown>;
  const tenantId = String(user.tenantId ?? 'default');
  const userId = String(user.id ?? '');
  const locale = await getLocale();
  const t = await getTranslations('reporting.bi');

  const now = new Date();
  const today = ymd(now);
  const monthStart = ymd(new Date(now.getFullYear(), now.getMonth(), 1));
  const sevenDaysAgo = ymd(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6));

  const locations = await getActiveLocationOptions({
    tenantId,
    locale: locale as 'id' | 'en' | 'zh',
    type: 'store',
  });
  const ctxBase: Omit<AuditContext, 'locationId'> = { tenantId, userId };

  const monthlyResults = await Promise.all(
    locations.map(async (location) => {
      const result = await getDailySummary(
        { locationId: location.id, startDate: monthStart, endDate: today },
        { ...ctxBase, locationId: location.id },
      );
      return { location, result };
    }),
  );

  const weeklyResults = await Promise.all(
    locations.map(async (location) => {
      const result = await getDailySummary(
        { locationId: location.id, startDate: sevenDaysAgo, endDate: today },
        { ...ctxBase, locationId: location.id },
      );
      return { location, result };
    }),
  );

  const okMonthly = monthlyResults.filter((entry) => entry.result.ok);
  const okWeekly = weeklyResults.filter((entry) => entry.result.ok);

  const totals = okMonthly.reduce(
    (acc, entry) => {
      if (!entry.result.ok) return acc;
      const data = entry.result.value;
      acc.gross += toBigInt(data.grossSales);
      acc.netRevenue += toBigInt(data.netRevenue);
      acc.pb1 += toBigInt(data.taxTotal);
      acc.deliveryCommission += toBigInt(data.commissionDelivery);
      acc.refunds += toBigInt(data.refundTotal);
      acc.refundCount += data.refundCount;
      acc.orderCount += data.shiftSummary.reduce((sum, shift) => sum + shift.txCount, 0);
      acc.openShifts += data.shiftSummary.filter((shift) => !shift.closedAt).length;
      acc.cashVariance += data.shiftSummary.reduce(
        (sum, shift) => sum + toBigInt(shift.variance),
        0n,
      );
      return acc;
    },
    {
      gross: 0n,
      netRevenue: 0n,
      pb1: 0n,
      deliveryCommission: 0n,
      refunds: 0n,
      refundCount: 0,
      orderCount: 0,
      openShifts: 0,
      cashVariance: 0n,
    },
  );

  const paymentMap = new Map<string, { count: number; total: bigint }>();
  for (const entry of okMonthly) {
    if (!entry.result.ok) continue;
    for (const payment of entry.result.value.paymentBreakdown) {
      const current = paymentMap.get(payment.method) ?? { count: 0, total: 0n };
      current.count += payment.txCount;
      current.total += toBigInt(payment.total);
      paymentMap.set(payment.method, current);
    }
  }

  const weeklyGross = okWeekly.reduce((sum, entry) => {
    if (!entry.result.ok) return sum;
    return sum + toBigInt(entry.result.value.grossSales);
  }, 0n);

  const topProducts = new Map<string, { name: string; qty: number; nominal: bigint }>();
  for (const entry of okMonthly) {
    if (!entry.result.ok) continue;
    for (const product of entry.result.value.topProducts) {
      const current = topProducts.get(product.productId) ?? {
        name: product.productName,
        qty: 0,
        nominal: 0n,
      };
      current.qty += product.qty;
      current.nominal += toBigInt(product.nominal);
      topProducts.set(product.productId, current);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-widest text-brand-red">
          {t('eyebrow')}
        </p>
        <h1 className="mt-1 text-2xl font-bold text-brand-ink">{t('title')}</h1>
        <p className="mt-1 max-w-3xl text-sm text-brand-ink-3">
          {t('subtitle', { from: monthStart, to: today })}
        </p>
      </div>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Kpi title={t('gross')} value={formatIdr(totals.gross)} />
        <Kpi title={t('netRevenue')} value={formatIdr(totals.netRevenue)} />
        <Kpi title={t('orders')} value={String(totals.orderCount)} />
        <Kpi title={t('weeklyGross')} value={formatIdr(weeklyGross)} />
        <Kpi title={t('pb1')} value={formatIdr(totals.pb1)} />
        <Kpi title={t('deliveryCommission')} value={formatIdr(totals.deliveryCommission)} />
        <Kpi title={t('refunds')} value={`${formatIdr(totals.refunds)} / ${totals.refundCount}`} />
        <Kpi title={t('cashVariance')} value={formatIdr(totals.cashVariance)} />
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <Panel title={t('locations')}>
          <div className="space-y-3">
            {okMonthly.map((entry) => {
              if (!entry.result.ok) return null;
              const data = entry.result.value;
              return (
                <div key={entry.location.id} className="rounded-md bg-brand-cream-1 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold text-brand-ink">{entry.location.label}</div>
                      <div className="text-xs text-brand-ink-3">{entry.location.code}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-brand-red">
                        {formatIdr(data.grossSales)}
                      </div>
                      <div className="text-xs text-brand-ink-3">
                        {data.shiftSummary.length} shift
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel title={t('payments')}>
          <div className="space-y-2">
            {[...paymentMap.entries()]
              .sort((a, b) => Number(b[1].total - a[1].total))
              .map(([method, value]) => (
                <div
                  key={method}
                  className="flex items-center justify-between rounded-md bg-brand-cream-1 px-3 py-2"
                >
                  <span className="text-sm font-medium uppercase text-brand-ink-2">{method}</span>
                  <span className="text-sm font-semibold text-brand-ink">
                    {formatIdr(value.total)} ({value.count})
                  </span>
                </div>
              ))}
          </div>
        </Panel>

        <Panel title={t('topProducts')}>
          <div className="space-y-2">
            {[...topProducts.entries()]
              .sort((a, b) => Number(b[1].nominal - a[1].nominal))
              .slice(0, 10)
              .map(([id, value], index) => (
                <div
                  key={id}
                  className="flex items-center justify-between gap-3 rounded-md bg-brand-cream-1 px-3 py-2"
                >
                  <div>
                    <div className="text-sm font-semibold text-brand-ink">
                      {index + 1}. {value.name}
                    </div>
                    <div className="text-xs text-brand-ink-3">{value.qty} qty</div>
                  </div>
                  <div className="text-sm font-semibold text-brand-red">
                    {formatIdr(value.nominal)}
                  </div>
                </div>
              ))}
          </div>
        </Panel>
      </section>

      <section className="rounded-lg border border-brand-cream-3 bg-card p-4">
        <h2 className="text-lg font-semibold text-brand-ink">{t('operations')}</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <Kpi title={t('openShifts')} value={String(totals.openShifts)} compact />
          <Kpi title={t('activeLocations')} value={String(locations.length)} compact />
          <Kpi title={t('period')} value={`${monthStart} - ${today}`} compact />
        </div>
      </section>
    </div>
  );
}

function Kpi({
  title,
  value,
  compact = false,
}: {
  title: string;
  value: string;
  compact?: boolean;
}) {
  return (
    <div className="rounded-lg border border-brand-cream-3 bg-card p-4">
      <div className="text-xs font-semibold uppercase tracking-widest text-brand-ink-3">
        {title}
      </div>
      <div
        className={
          compact
            ? 'mt-2 text-xl font-bold text-brand-ink'
            : 'mt-2 text-2xl font-bold text-brand-ink'
        }
      >
        {value}
      </div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-brand-cream-3 bg-card p-4">
      <h2 className="text-lg font-semibold text-brand-ink">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}
