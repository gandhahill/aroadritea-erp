/**
 * Dashboard Utama — landing page after login.
 *
 * Surfaces today's key numbers (gross sales, open shifts, open POs, late
 * attendance) and quick links to the most-used modules, gated by the
 * logged-in user's permissions. Replaces the previous redirect-to-/pos
 * behaviour so non-cashier roles also have a useful first screen.
 */

import { getSession } from '@/lib/auth';
import { and, db, eq, gte, isNull, sql } from '@erp/db';
import { accountingPeriods } from '@erp/db/schema/accounting';
import { attendance, employees } from '@erp/db/schema/hr';
import { payments, salesOrders, shifts } from '@erp/db/schema/pos';
import { purchaseOrders } from '@erp/db/schema/purchasing';
import { can } from '@erp/services/iam';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Dashboard - Aroadri ERP',
};

function rupiah(value: bigint | string | number | null | undefined): string {
  if (value === null || value === undefined) return 'Rp 0';
  const n = typeof value === 'bigint' ? Number(value) : Number(value);
  if (!Number.isFinite(n)) return 'Rp 0';
  return new Intl.NumberFormat('id-ID', {
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
    todayGross: todaySales?.gross ?? 0n,
    todayOrders: todaySales?.orders ?? 0,
    monthGross: monthSales?.gross ?? 0n,
    openShifts: openShifts?.count ?? 0,
    openPos: openPos?.count ?? 0,
    lateToday: lateToday?.count ?? 0,
    activeEmployees: activeEmployees?.count ?? 0,
    openPeriod: openPeriod?.code ?? null,
  };
}

interface QuickLink {
  href: string;
  title: string;
  description: string;
  permission?: string;
}

const QUICK_LINKS: QuickLink[] = [
  {
    href: '/pos',
    title: 'Kasir POS',
    description: 'Mulai transaksi penjualan untuk shift Anda.',
    permission: 'pos.transact',
  },
  {
    href: '/hr/checkin',
    title: 'Presensi',
    description: 'Clock-in/out shift hari ini dengan GPS.',
    permission: 'hr.attendance.write',
  },
  {
    href: '/accounting/journals/new',
    title: 'Jurnal manual',
    description: 'Catat jurnal umum dengan lampiran bukti.',
    permission: 'accounting.journal.create',
  },
  {
    href: '/inventory/products',
    title: 'Produk & menu',
    description: 'Atur produk, kategori, harga, dan gambar.',
    permission: 'inventory.product.read',
  },
  {
    href: '/inventory/opname',
    title: 'Stock opname',
    description: 'Hitung stok harian/bulanan dan rekam selisih.',
    permission: 'inventory.adjust',
  },
  {
    href: '/purchasing/po/new',
    title: 'Purchase order',
    description: 'Buat PO ke supplier dan lacak penerimaan barang.',
    permission: 'purchasing.po.create',
  },
  {
    href: '/hr/payroll',
    title: 'Payroll',
    description: 'Hitung gaji tanggal 8 dengan potongan presensi otomatis.',
    permission: 'hr.view',
  },
  {
    href: '/reporting/business-intelligence',
    title: 'Business Intelligence',
    description: 'KPI omzet, channel, produk teratas, varians kas.',
    permission: 'reporting.view',
  },
  {
    href: '/audit',
    title: 'Audit trail',
    description: 'Riwayat perubahan data — internal control.',
    permission: 'audit.view',
  },
  {
    href: '/settings/permissions',
    title: 'Permission & role',
    description: 'Atur role dan akses per pengguna.',
    permission: 'settings.manage',
  },
];

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const user = session.user as Record<string, unknown>;
  const tenantId = String(user.tenantId ?? 'default');
  const userId = String(user.id ?? '');
  const displayName = String(user.displayName ?? user.email ?? 'Pengguna');

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
      ? 'Selamat pagi'
      : now.getHours() < 15
        ? 'Selamat siang'
        : now.getHours() < 19
          ? 'Selamat sore'
          : 'Selamat malam';

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-semibold uppercase tracking-widest text-brand-red">
          Aroadri Tea ERP
        </p>
        <h1 className="mt-1 text-2xl font-bold text-brand-ink">
          {hello}, {displayName.split(' ')[0]}.
        </h1>
        <p className="mt-1 text-sm text-brand-ink-3">
          Ringkasan hari ini dan jalan pintas ke modul utama.
        </p>
      </header>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Kpi title="Omzet hari ini" value={rupiah(kpis.todayGross)} subtitle={`${kpis.todayOrders} transaksi`} />
        <Kpi title="Omzet bulan ini" value={rupiah(kpis.monthGross)} />
        <Kpi title="Shift terbuka" value={String(kpis.openShifts)} subtitle="POS aktif" />
        <Kpi
          title="Telat hari ini"
          value={String(kpis.lateToday)}
          subtitle="(belum dispensasi)"
        />
        <Kpi title="PO outstanding" value={String(kpis.openPos)} />
        <Kpi title="Karyawan aktif" value={String(kpis.activeEmployees)} />
        <Kpi
          title="Periode akuntansi"
          value={kpis.openPeriod ?? '—'}
          subtitle={kpis.openPeriod ? 'terbuka' : 'belum dibuka'}
        />
      </section>

      <section>
        <h2 className="text-base font-semibold text-brand-ink">Jalan pintas</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-xl border border-brand-cream-3 bg-card p-4 shadow-sm transition-colors hover:border-brand-red/40 hover:bg-brand-cream-1"
            >
              <p className="text-sm font-semibold text-brand-ink">{link.title}</p>
              <p className="mt-1 text-xs text-brand-ink-3">{link.description}</p>
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
