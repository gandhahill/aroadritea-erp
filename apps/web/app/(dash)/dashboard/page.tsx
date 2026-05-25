/**
 * Dashboard Utama — landing page after login.
 *
 * Surfaces today's key numbers (gross sales, open shifts, open POs, late
 * attendance) and quick links to the most-used modules, gated by the
 * logged-in user's permissions. Replaces the previous redirect-to-/pos
 * behaviour so non-cashier roles also have a useful first screen.
 */

import { PageHeader } from '@/components/page-header';
import { getSession } from '@/lib/auth';
import { and, db, eq, gte, isNull, sql } from '@erp/db';
import { accountingPeriods } from '@erp/db/schema/accounting';
import { attendance, employees } from '@erp/db/schema/hr';
import { manualSalesClosings, payments, salesOrders, shifts } from '@erp/db/schema/pos';
import { purchaseOrders } from '@erp/db/schema/purchasing';
import { can } from '@erp/services/iam';
import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Dashboard - Aroadri ERP',
};

function rupiah(value: bigint | string | number | null | undefined, locale: string): string {
  if (value === null || value === undefined) return 'Rp 0';
  const n = typeof value === 'bigint' ? Number(value) : Number(value);
  if (!Number.isFinite(n)) return 'Rp 0';
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(n);
}

async function loadKpis(tenantId: string) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [todaySales] = await db
    .select({
      gross: sql<bigint>`coalesce(sum(${salesOrders.grandTotal}), 0)`,
      orders: sql<number>`cast(count(*) as int)`,
    })
    .from(salesOrders)
    .where(
      and(
        eq(salesOrders.tenantId, tenantId),
        eq(salesOrders.status, 'paid'),
        gte(salesOrders.placedAt, startOfToday),
      ),
    );
  const [todayManualSales] = await db
    .select({
      gross: sql<bigint>`coalesce(sum(${manualSalesClosings.grossSales} - ${manualSalesClosings.discountTotal}), 0)`,
      orders: sql<number>`cast(coalesce(sum(case when ${manualSalesClosings.transactionCount} > 0 then ${manualSalesClosings.transactionCount} else 1 end), 0) as int)`,
    })
    .from(manualSalesClosings)
    .where(
      and(
        eq(manualSalesClosings.tenantId, tenantId),
        eq(manualSalesClosings.status, 'posted'),
        gte(manualSalesClosings.salesDate, startOfToday.toISOString().slice(0, 10)),
      ),
    );

  const [monthSales] = await db
    .select({ gross: sql<bigint>`coalesce(sum(${salesOrders.grandTotal}), 0)` })
    .from(salesOrders)
    .where(
      and(
        eq(salesOrders.tenantId, tenantId),
        eq(salesOrders.status, 'paid'),
        gte(salesOrders.placedAt, startOfMonth),
      ),
    );
  const [monthManualSales] = await db
    .select({
      gross: sql<bigint>`coalesce(sum(${manualSalesClosings.grossSales} - ${manualSalesClosings.discountTotal}), 0)`,
    })
    .from(manualSalesClosings)
    .where(
      and(
        eq(manualSalesClosings.tenantId, tenantId),
        eq(manualSalesClosings.status, 'posted'),
        gte(manualSalesClosings.salesDate, startOfMonth.toISOString().slice(0, 10)),
      ),
    );

  const [openShifts] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(shifts)
    .where(and(eq(shifts.tenantId, tenantId), eq(shifts.status, 'open')));

  const [openPos] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(purchaseOrders)
    .where(
      and(
        eq(purchaseOrders.tenantId, tenantId),
        sql`${purchaseOrders.status} in ('draft','approved','partial')`,
      ),
    );

  const [lateToday] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(attendance)
    .where(
      and(
        eq(attendance.tenantId, tenantId),
        eq(attendance.isLate, true),
        eq(attendance.lateForgiven, false),
        gte(attendance.checkInAt, startOfToday),
      ),
    );

  const [activeEmployees] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(employees)
    .where(
      and(
        eq(employees.tenantId, tenantId),
        sql`${employees.status} in ('active','probation')`,
        isNull(employees.deletedAt),
      ),
    );

  const [openPeriod] = await db
    .select({ code: accountingPeriods.code })
    .from(accountingPeriods)
    .where(and(eq(accountingPeriods.tenantId, tenantId), eq(accountingPeriods.status, 'open')))
    .limit(1);

  return {
    todayGross: (todaySales?.gross ?? 0n) + (todayManualSales?.gross ?? 0n),
    todayOrders: (todaySales?.orders ?? 0) + (todayManualSales?.orders ?? 0),
    monthGross: (monthSales?.gross ?? 0n) + (monthManualSales?.gross ?? 0n),
    openShifts: openShifts?.count ?? 0,
    openPos: openPos?.count ?? 0,
    lateToday: lateToday?.count ?? 0,
    activeEmployees: activeEmployees?.count ?? 0,
    openPeriod: openPeriod?.code ?? null,
  };
}

interface QuickLink {
  href: string;
  key: string;
  permission?: string;
}

const QUICK_LINKS: QuickLink[] = [
  {
    href: '/pos',
    key: 'pos',
    permission: 'pos.transact',
  },
  {
    href: '/hr/checkin',
    key: 'checkin',
    permission: 'hr.attendance.write',
  },
  {
    href: '/accounting/journals/new',
    key: 'manualJournal',
    permission: 'accounting.journal.create',
  },
  {
    href: '/inventory/products',
    key: 'products',
    permission: 'inventory.product.read',
  },
  {
    href: '/inventory/opname',
    key: 'opname',
    permission: 'inventory.adjust',
  },
  {
    href: '/purchasing/po/new',
    key: 'purchaseOrder',
    permission: 'purchasing.po.create',
  },
  {
    href: '/hr/payroll',
    key: 'payroll',
    permission: 'hr.view',
  },
  {
    href: '/reporting/business-intelligence',
    key: 'bi',
    permission: 'reporting.view',
  },
  {
    href: '/audit',
    key: 'audit',
    permission: 'audit.view',
  },
  {
    href: '/settings/permissions',
    key: 'permissions',
    permission: 'settings.manage',
  },
];

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const user = session.user as Record<string, unknown>;
  const tenantId = String(user.tenantId ?? 'default');
  const userId = String(user.id ?? '');
  const locale = await getLocale();
  const t = await getTranslations('dashboard');
  const displayName = String(user.displayName ?? user.email ?? t('fallbackUser'));

  const kpis = await loadKpis(tenantId);

  // Filter quick links by user permission.
  const allowed = await Promise.all(
    QUICK_LINKS.map(async (link) =>
      !link.permission || (await can(userId, link.permission)) ? link : null,
    ),
  );
  const links = allowed.filter((l): l is QuickLink => Boolean(l));

  const now = new Date();
  const hello =
    now.getHours() < 11
      ? t('greetings.morning')
      : now.getHours() < 15
        ? t('greetings.afternoon')
        : now.getHours() < 19
          ? t('greetings.evening')
          : t('greetings.night');

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          <>
            {hello}, {displayName.split(' ')[0]}.
          </>
        }
        description={<>{t('subtitle')}</>}
        eyebrow={<>Aroadri Tea ERP</>}
      />

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Kpi
          title={t('kpis.todayGross')}
          value={rupiah(kpis.todayGross, locale)}
          subtitle={t('kpis.transactions', { count: kpis.todayOrders })}
        />
        <Kpi title={t('kpis.monthGross')} value={rupiah(kpis.monthGross, locale)} />
        <Kpi
          title={t('kpis.openShifts')}
          value={String(kpis.openShifts)}
          subtitle={t('kpis.activePos')}
        />
        <Kpi
          title={t('kpis.lateToday')}
          value={String(kpis.lateToday)}
          subtitle={t('kpis.notForgiven')}
        />
        <Kpi title={t('kpis.openPo')} value={String(kpis.openPos)} />
        <Kpi title={t('kpis.activeEmployees')} value={String(kpis.activeEmployees)} />
        <Kpi
          title={t('kpis.accountingPeriod')}
          value={kpis.openPeriod ?? '—'}
          subtitle={kpis.openPeriod ? t('kpis.open') : t('kpis.notOpened')}
        />
      </section>

      <section>
        <h2 className="text-base font-semibold text-brand-ink">{t('quickLinksTitle')}</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-xl border border-brand-cream-3 bg-card p-4 shadow-sm transition-colors hover:border-brand-red/40 hover:bg-brand-cream-1"
            >
              <p className="text-sm font-semibold text-brand-ink">
                {t(`quickLinks.${link.key}.title`)}
              </p>
              <p className="mt-1 text-xs text-brand-ink-3">
                {t(`quickLinks.${link.key}.description`)}
              </p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function Kpi({
  title,
  value,
  subtitle,
}: {
  title: string;
  value: string;
  subtitle?: string;
}) {
  return (
    <div className="rounded-xl border border-brand-cream-3 bg-card p-4 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-brand-ink-3">
        {title}
      </p>
      <p className="mt-2 text-xl font-bold text-brand-ink">{value}</p>
      {subtitle ? <p className="mt-0.5 text-[11px] text-brand-ink-3">{subtitle}</p> : null}
    </div>
  );
}
