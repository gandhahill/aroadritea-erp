import type { PermissionCode } from '@erp/shared/types';
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
import { users } from '@erp/db/schema/auth';
import { attendance, employees } from '@erp/db/schema/hr';
import { manualSalesClosings, payments, salesOrders, shifts } from '@erp/db/schema/pos';
import { purchaseOrders } from '@erp/db/schema/purchasing';
import { can } from '@erp/services/iam';
import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Dashboard',
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
  // Use WIB (UTC+7) for "today" boundary — server may run in UTC
  const nowUtc = new Date();
  const wibMs = nowUtc.getTime() + 7 * 60 * 60 * 1000;
  const wibNow = new Date(wibMs);
  const wibYear = wibNow.getUTCFullYear();
  const wibMonth = wibNow.getUTCMonth();
  const wibDay = wibNow.getUTCDate();
  // Midnight WIB = that date at 00:00+07:00 = previous day 17:00 UTC
  const startOfToday = new Date(Date.UTC(wibYear, wibMonth, wibDay, -7));
  const startOfMonth = new Date(Date.UTC(wibYear, wibMonth, 1, -7));

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
    todayGross: BigInt(todaySales?.gross ?? 0) + BigInt(todayManualSales?.gross ?? 0),
    todayOrders: Number(todaySales?.orders ?? 0) + Number(todayManualSales?.orders ?? 0),
    monthGross: BigInt(monthSales?.gross ?? 0) + BigInt(monthManualSales?.gross ?? 0),
    openShifts: openShifts?.count ?? 0,
    openPos: openPos?.count ?? 0,
    lateToday: lateToday?.count ?? 0,
    activeEmployees: activeEmployees?.count ?? 0,
    openPeriod: openPeriod?.code ?? null,
  };
}

async function resolveDashboardDisplayName(user: Record<string, unknown>, fallback: string) {
  const rawDisplayName = String(user.displayName ?? '').trim();
  const rawEmail = String(user.email ?? '').trim();
  if (rawDisplayName && rawDisplayName !== rawEmail) return rawDisplayName;

  const userId = String(user.id ?? '');
  const tenantId = String(user.tenantId ?? 'default');
  if (userId) {
    const [row] = await db
      .select({ displayName: users.displayName })
      .from(users)
      .where(and(eq(users.id, userId), eq(users.tenantId, tenantId)))
      .limit(1);
    const dbDisplayName = row?.displayName?.trim();
    if (dbDisplayName && dbDisplayName !== rawEmail) return dbDisplayName;
  }

  return fallback;
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
  const displayName = await resolveDashboardDisplayName(user, t('fallbackUser'));

  const kpis = await loadKpis(tenantId);

  // Filter quick links by user permission.
  const allowed = await Promise.all(
    QUICK_LINKS.map(async (link) =>
      !link.permission || (await can(userId, link.permission as PermissionCode)) ? link : null,
    ),
  );
  const links = allowed.filter((l): l is QuickLink => Boolean(l));

  const [
    canViewReporting,
    canViewPos,
    canViewAttendance,
    canViewPurchasing,
    canViewEmployees,
    canViewAccounting
  ] = await Promise.all([
    can(userId, 'reporting.view' as PermissionCode),
    can(userId, 'pos.view' as PermissionCode),
    can(userId, 'hr.attendance.read' as PermissionCode),
    can(userId, 'purchasing.view' as PermissionCode),
    can(userId, 'hr.employee.read' as PermissionCode),
    can(userId, 'accounting.view' as PermissionCode),
  ]);

  // Use WIB hours for greeting
  const nowForGreeting = new Date();
  const wibHour = (nowForGreeting.getUTCHours() + 7) % 24;
  const hello =
    wibHour < 11
      ? t('greetings.morning')
      : wibHour < 15
        ? t('greetings.afternoon')
        : wibHour < 19
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
        description={t('subtitle')}
        eyebrow={<>Aroadri Tea ERP</>}
      />

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {canViewReporting && (
          <>
            <Kpi
              title={t('kpis.todayGross')}
              value={rupiah(kpis.todayGross, locale)}
              subtitle={t('kpis.transactions', { count: kpis.todayOrders })}
            />
            <Kpi title={t('kpis.monthGross')} value={rupiah(kpis.monthGross, locale)} />
          </>
        )}
        
        {canViewPos && (
          <Kpi
            title={t('kpis.openShifts')}
            value={String(kpis.openShifts)}
            subtitle={t('kpis.activePos')}
          />
        )}
        
        {canViewAttendance && (
          <Kpi
            title={t('kpis.lateToday')}
            value={String(kpis.lateToday)}
            subtitle={t('kpis.notForgiven')}
          />
        )}
        
        {canViewPurchasing && (
          <Kpi title={t('kpis.openPo')} value={String(kpis.openPos)} />
        )}
        
        {canViewEmployees && (
          <Kpi title={t('kpis.activeEmployees')} value={String(kpis.activeEmployees)} />
        )}
        
        {canViewAccounting && (
          <Kpi
            title={t('kpis.accountingPeriod')}
            value={kpis.openPeriod ?? '—'}
            subtitle={kpis.openPeriod ? t('kpis.open') : t('kpis.notOpened')}
          />
        )}
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
