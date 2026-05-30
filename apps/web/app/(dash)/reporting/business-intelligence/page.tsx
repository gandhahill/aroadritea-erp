import { PageHeader } from '@/components/page-header';
import { getSession } from '@/lib/auth';
import { getActiveLocationOptions } from '@/lib/location-options';
import { and, db, eq, gte, lte, sql } from '@erp/db';
import { salesOrders } from '@erp/db/schema/pos';
import { getDailySummary, previousPeriod } from '@erp/services/reporting';
import type { AuditContext } from '@erp/shared/types';
import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { DonutChart, HorizontalBarChart, TrendLineChart, VerticalBarChart } from './charts';

export const metadata: Metadata = {
  title: 'Business Intelligence',
};

function ymd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatIdr(value: bigint | string, locale: string): string {
  const numeric = typeof value === 'bigint' ? Number(value) : Number(value);
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(Number.isFinite(numeric) ? numeric : 0);
}

function toBigInt(value: string | null | undefined): bigint {
  return value && /^\-?\d+$/.test(value) ? BigInt(value) : 0n;
}

function humanChannel(channel: string, t: Awaited<ReturnType<typeof getTranslations>>): string {
  switch (channel) {
    case 'walk_in':
      return t('channels.walkIn');
    case 'gofood':
      return 'GoFood';
    case 'grabfood':
      return 'GrabFood';
    case 'shopeefood':
      return 'ShopeeFood';
    default:
      return t('channels.other', { channel });
  }
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

  // Previous same-length window for period-over-period comparison.
  const prevMonth = previousPeriod({ from: monthStart, to: today });
  const prevMonthlyResults = await Promise.all(
    locations.map(async (location) => {
      const result = await getDailySummary(
        { locationId: location.id, startDate: prevMonth.from, endDate: prevMonth.to },
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
  const okPrevMonthly = prevMonthlyResults.filter((entry) => entry.result.ok);
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

  // Same shape, but for the prior same-length window. Used for badges only.
  const prevTotals = okPrevMonthly.reduce(
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
      cashVariance: 0n,
    },
  );

  /** Returns delta + percent for two bigint values. Percent is null
   *  when previous = 0 (no baseline). */
  function bigDelta(cur: bigint, prev: bigint): { delta: bigint; percent: number | null } {
    const delta = cur - prev;
    const percent =
      prev === 0n ? null : Number((delta * 10000n) / (prev < 0n ? -prev : prev)) / 100;
    return { delta, percent };
  }

  function numDelta(cur: number, prev: number): { delta: number; percent: number | null } {
    const delta = cur - prev;
    const percent = prev === 0 ? null : Math.round(((cur - prev) / Math.abs(prev)) * 1000) / 10;
    return { delta, percent };
  }

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

  // ── Extra BI queries (channel mix, hourly today, member split, 7-day trend) ──

  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const trendStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);

  // Channel mix this month
  const channelRows = await db
    .select({
      channel: salesOrders.channel,
      gross: sql<bigint>`coalesce(sum(${salesOrders.grandTotal}), 0)`,
      orders: sql<number>`cast(count(*) as int)`,
    })
    .from(salesOrders)
    .where(
      and(
        eq(salesOrders.tenantId, tenantId),
        eq(salesOrders.status, 'paid'),
        gte(salesOrders.placedAt, startOfMonth),
      ),
    )
    .groupBy(salesOrders.channel);
  const channelMix = channelRows
    .map((r) => ({
      label: humanChannel(r.channel, t),
      gross: BigInt(r.gross ?? 0) * 100n,
      orders: Number(r.orders),
    }))
    .sort((a, b) => Number(b.gross - a.gross));

  // Hourly distribution today
  const hourlyRows = await db.execute(
    sql<{ hour: number; gross: string; orders: number }>`
      SELECT
        EXTRACT(HOUR FROM placed_at AT TIME ZONE 'Asia/Jakarta')::int AS hour,
        COALESCE(SUM(grand_total), 0)::bigint AS gross,
        COUNT(*)::int AS orders
      FROM sales_orders
      WHERE tenant_id = ${tenantId}
        AND status = 'paid'
        AND placed_at >= ${startOfToday.toISOString()}
      GROUP BY 1
      ORDER BY 1
    `,
  );
  const hourlyMap = new Map<number, { gross: bigint; orders: number }>();
  for (const row of hourlyRows as unknown as Array<{
    hour: number;
    gross: string;
    orders: number;
  }>) {
    hourlyMap.set(Number(row.hour), {
      gross: BigInt(row.gross) * 100n,
      orders: Number(row.orders),
    });
  }
  const hourlyToday = Array.from({ length: 15 }, (_, i) => {
    const hour = 9 + i; // 09:00 .. 23:00 store hours
    const v = hourlyMap.get(hour);
    return { hour, gross: v?.gross ?? 0n, orders: v?.orders ?? 0 };
  });

  // 7-day trend
  const trendRows = await db.execute(
    sql<{ d: string; gross: string; orders: number }>`
      SELECT
        TO_CHAR(DATE(placed_at AT TIME ZONE 'Asia/Jakarta'), 'YYYY-MM-DD') AS d,
        COALESCE(SUM(grand_total), 0)::bigint AS gross,
        COUNT(*)::int AS orders
      FROM sales_orders
      WHERE tenant_id = ${tenantId}
        AND status = 'paid'
        AND placed_at >= ${trendStart.toISOString()}
      GROUP BY 1
      ORDER BY 1
    `,
  );
  const trendMap = new Map<string, { gross: bigint; orders: number }>();
  for (const row of trendRows as unknown as Array<{
    d: string;
    gross: string;
    orders: number;
  }>) {
    trendMap.set(String(row.d), {
      gross: BigInt(row.gross) * 100n,
      orders: Number(row.orders),
    });
  }
  const trendData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(trendStart);
    d.setDate(trendStart.getDate() + i);
    const ds = d.toISOString().slice(0, 10);
    const v = trendMap.get(ds);
    return { date: ds, gross: v?.gross ?? 0n, orders: v?.orders ?? 0 };
  });

  // Member vs guest (member when customerId not null)
  const [memberRow] = await db
    .select({
      gross: sql<bigint>`coalesce(sum(${salesOrders.grandTotal}), 0)`,
      orders: sql<number>`cast(count(*) as int)`,
    })
    .from(salesOrders)
    .where(
      and(
        eq(salesOrders.tenantId, tenantId),
        eq(salesOrders.status, 'paid'),
        gte(salesOrders.placedAt, startOfMonth),
        sql`${salesOrders.customerId} is not null`,
      ),
    );
  const [guestRow] = await db
    .select({
      gross: sql<bigint>`coalesce(sum(${salesOrders.grandTotal}), 0)`,
      orders: sql<number>`cast(count(*) as int)`,
    })
    .from(salesOrders)
    .where(
      and(
        eq(salesOrders.tenantId, tenantId),
        eq(salesOrders.status, 'paid'),
        gte(salesOrders.placedAt, startOfMonth),
        sql`${salesOrders.customerId} is null`,
      ),
    );
  const memberSplit = {
    memberGross: BigInt(memberRow?.gross ?? 0) * 100n,
    memberOrders: Number(memberRow?.orders ?? 0),
    guestGross: BigInt(guestRow?.gross ?? 0) * 100n,
    guestOrders: Number(guestRow?.orders ?? 0),
  };

  const avgTicket = totals.orderCount > 0 ? totals.gross / BigInt(totals.orderCount) : 0n;

  return (
    <div className="space-y-6">
      <PageHeader
        title={<>{t('title')}</>}
        description={<>{t('subtitle', { from: monthStart, to: today })}</>}
        eyebrow={<>{t('eyebrow')}</>}
      />

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Kpi
          title={t('gross')}
          value={formatIdr(totals.gross, locale)}
          delta={bigDelta(totals.gross, prevTotals.gross)}
          deltaLabel={t('vsPreviousShort')}
          baselineLabel={t('noBaseline')}
        />
        <Kpi
          title={t('netRevenue')}
          value={formatIdr(totals.netRevenue, locale)}
          delta={bigDelta(totals.netRevenue, prevTotals.netRevenue)}
          deltaLabel={t('vsPreviousShort')}
          baselineLabel={t('noBaseline')}
        />
        <Kpi
          title={t('orders')}
          value={String(totals.orderCount)}
          delta={numDelta(totals.orderCount, prevTotals.orderCount)}
          deltaLabel={t('vsPreviousShort')}
          baselineLabel={t('noBaseline')}
        />
        <Kpi title={t('weeklyGross')} value={formatIdr(weeklyGross, locale)} />
        <Kpi
          title={t('pb1')}
          value={formatIdr(totals.pb1, locale)}
          delta={bigDelta(totals.pb1, prevTotals.pb1)}
          deltaLabel={t('vsPreviousShort')}
          baselineLabel={t('noBaseline')}
        />
        <Kpi
          title={t('deliveryCommission')}
          value={formatIdr(totals.deliveryCommission, locale)}
          delta={bigDelta(totals.deliveryCommission, prevTotals.deliveryCommission)}
          deltaLabel={t('vsPreviousShort')}
          baselineLabel={t('noBaseline')}
          invertDelta
        />
        <Kpi
          title={t('refunds')}
          value={`${formatIdr(totals.refunds, locale)} / ${totals.refundCount}`}
          delta={bigDelta(totals.refunds, prevTotals.refunds)}
          deltaLabel={t('vsPreviousShort')}
          baselineLabel={t('noBaseline')}
          invertDelta
        />
        <Kpi
          title={t('cashVariance')}
          value={formatIdr(totals.cashVariance, locale)}
          delta={bigDelta(totals.cashVariance, prevTotals.cashVariance)}
          deltaLabel={t('vsPreviousShort')}
          baselineLabel={t('noBaseline')}
          invertDelta
        />
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
                        {formatIdr(data.grossSales, locale)}
                      </div>
                      <div className="text-xs text-brand-ink-3">
                        {t('shiftCount', { count: data.shiftSummary.length })}
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
                    {formatIdr(value.total, locale)} ({value.count})
                  </span>
                </div>
              ))}
          </div>
        </Panel>

        <Panel title={t('topProducts')}>
          <HorizontalBarChart
            data={[...topProducts.entries()]
              .sort((a, b) => Number(b[1].nominal - a[1].nominal))
              .slice(0, 10)
              .map(([, value]) => ({
                label: value.name,
                value: Number(value.nominal),
              }))}
            height={260}
            locale={locale}
            noDataLabel={t('noData')}
          />
        </Panel>
      </section>

      <section className="rounded-lg border border-brand-cream-3 bg-card p-4">
        <h2 className="text-lg font-semibold text-brand-ink">{t('operations')}</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-4">
          <Kpi title={t('openShifts')} value={String(totals.openShifts)} compact />
          <Kpi title={t('activeLocations')} value={String(locations.length)} compact />
          <Kpi title={t('avgTicket')} value={formatIdr(avgTicket, locale)} compact />
          <Kpi
            title={t('refundRate')}
            value={
              totals.orderCount > 0
                ? `${((totals.refundCount / totals.orderCount) * 100).toFixed(1)}%`
                : '—'
            }
            compact
          />
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <Panel title={t('trend7Days')}>
          <TrendLineChart
            data={trendData.map((row) => ({
              label: row.date.slice(5),
              value: Number(row.gross),
              orders: row.orders,
            }))}
            locale={locale}
            noDataLabel={t('noData')}
          />
        </Panel>

        <Panel title={t('channelMix')}>
          <DonutChart
            data={channelMix.map((c) => ({
              label: c.label,
              value: Number(c.gross),
            }))}
            locale={locale}
            noDataLabel={t('noData')}
          />
        </Panel>

        <Panel title={t('memberVsGuest')}>
          <DonutChart
            data={[
              { label: t('member'), value: Number(memberSplit.memberGross) },
              { label: t('guest'), value: Number(memberSplit.guestGross) },
            ]}
            locale={locale}
            noDataLabel={t('noData')}
          />
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-brand-ink-3">
            <div>
              {t('memberOrders', { count: memberSplit.memberOrders })}{' '}
              <span className="text-brand-ink">{formatIdr(memberSplit.memberGross, locale)}</span>
            </div>
            <div>
              {t('guestOrders', { count: memberSplit.guestOrders })}{' '}
              <span className="text-brand-ink">{formatIdr(memberSplit.guestGross, locale)}</span>
            </div>
          </div>
        </Panel>
      </section>

      <section className="rounded-lg border border-brand-cream-3 bg-card p-4">
        <h2 className="text-lg font-semibold text-brand-ink">
          {t('hourlyToday', { date: today })}
        </h2>
        <p className="mt-1 text-xs text-brand-ink-3">{t('hourlyHelp')}</p>
        <div className="mt-3">
          <VerticalBarChart
            data={hourlyToday.map((h) => ({
              label: `${String(h.hour).padStart(2, '0')}`,
              value: Number(h.gross),
            }))}
            height={240}
            locale={locale}
            noDataLabel={t('noData')}
          />
        </div>
      </section>
    </div>
  );
}

function Kpi({
  title,
  value,
  compact = false,
  delta,
  deltaLabel,
  baselineLabel,
  invertDelta,
}: {
  title: string;
  value: string;
  compact?: boolean;
  delta?: { percent: number | null } | null;
  /** Translated "vs previous" string. */
  deltaLabel?: string;
  baselineLabel?: string;
  /** Set true for metrics where decrease is good (refunds, commission). */
  invertDelta?: boolean;
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
      {delta !== undefined &&
        (() => {
          if (!delta || delta.percent === null) {
            return baselineLabel ? (
              <div className="mt-1 text-[11px] italic text-brand-ink-3">{baselineLabel}</div>
            ) : null;
          }
          const isUp = delta.percent > 0;
          const isFlat = delta.percent === 0;
          const good = invertDelta ? !isUp : isUp;
          const tone = isFlat
            ? 'text-brand-ink-3 bg-brand-cream-2'
            : good
              ? 'text-brand-jade bg-emerald-50'
              : 'text-rose-600 bg-rose-50';
          const arrow = isFlat ? '→' : isUp ? '↑' : '↓';
          return (
            <div
              className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${tone}`}
              title={deltaLabel}
            >
              <span>{arrow}</span>
              <span>{`${delta.percent > 0 ? '+' : ''}${delta.percent.toFixed(1)}%`}</span>
              {deltaLabel && <span className="font-normal text-brand-ink-3">{deltaLabel}</span>}
            </div>
          );
        })()}
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
