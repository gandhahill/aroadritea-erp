/**
 * POS Order History — SD §21.4
 *
 * Lists today's orders for the cashier's current location with a
 * click-through detail panel that surfaces void / refund. The shell is
 * a server component so the initial render is cached; the detail
 * actions live in OrdersClient.
 */

import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { fetchTodaysOrders } from './actions';
import { OrdersClient } from './orders-client';

export const metadata: Metadata = { title: 'Riwayat Pesanan — POS' };
export const dynamic = 'force-dynamic';

interface Props {
  searchParams: Promise<{ date?: string; page?: string }>;
}

export default async function PosOrdersPage({ searchParams }: Props) {
  const { date, page: pageParam } = await searchParams;
  const page = Number.parseInt(pageParam ?? '1', 10);
  const [data, pagination] = await Promise.all([
    fetchTodaysOrders(date, Number.isFinite(page) ? page : 1),
    getTranslations('common.pagination'),
  ]);
  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));

  if (!data.ok) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-brand-ink">Riwayat Pesanan</h1>
        <div className="rounded-xl border border-brand-cream-3 bg-card p-6 text-sm text-brand-ink-3">
          {data.error === 'Unauthenticated'
            ? 'Sesi belum terautentikasi atau lokasi default belum diset di profil Anda.'
            : 'Gagal memuat data pesanan.'}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand-red/80">POS</p>
          <h1 className="mt-1 text-2xl font-bold text-brand-ink">Riwayat Pesanan</h1>
          <p className="mt-1 max-w-2xl text-sm text-brand-ink-3">
            Daftar transaksi penjualan untuk lokasi ini. Klik baris untuk melihat detail dan,
            jika diizinkan, void atau refund.
          </p>
        </div>
        <DatePicker initialDate={date} />
      </div>

      <OrdersClient rows={data.rows} />
      <div className="flex flex-col gap-3 rounded-lg border border-brand-cream-3 bg-card px-4 py-3 text-sm text-brand-ink-3 sm:flex-row sm:items-center sm:justify-between">
        <span>
          {pagination('page')} {data.page} {pagination('of')} {totalPages}
        </span>
        <div className="flex items-center gap-2">
          <PageLink date={date} page={data.page - 1} disabled={data.page <= 1}>
            {pagination('previous')}
          </PageLink>
          <PageLink date={date} page={data.page + 1} disabled={data.page >= totalPages}>
            {pagination('next')}
          </PageLink>
        </div>
      </div>
    </div>
  );
}

function PageLink({
  date,
  page,
  disabled,
  children,
}: {
  date?: string;
  page: number;
  disabled: boolean;
  children: ReactNode;
}) {
  const params = new URLSearchParams();
  params.set('page', String(page));
  if (date) params.set('date', date);
  if (disabled) {
    return (
      <span className="rounded-md border border-brand-cream-3 px-3 py-1.5 text-brand-ink-3 opacity-50">
        {children}
      </span>
    );
  }
  return (
    <Link
      href={`/pos/orders?${params.toString()}`}
      className="rounded-md border border-brand-cream-3 px-3 py-1.5 font-medium text-brand-ink transition-colors hover:bg-brand-cream"
    >
      {children}
    </Link>
  );
}

function DatePicker({ initialDate }: { initialDate?: string }) {
  const today = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
  return (
    <form className="flex items-center gap-2">
      <label htmlFor="orders-date" className="text-xs font-medium text-brand-ink-3">
        Tanggal
      </label>
      <input
        id="orders-date"
        type="date"
        name="date"
        defaultValue={initialDate ?? today}
        className="h-9 rounded-md border border-brand-cream-3 bg-card px-2.5 text-sm text-brand-ink focus:border-brand-red focus:outline-none focus:ring-2 focus:ring-brand-red/20"
      />
      <button
        type="submit"
        className="h-9 rounded-md bg-brand-red px-3 text-xs font-semibold text-white hover:bg-brand-red-dark"
      >
        Tampilkan
      </button>
    </form>
  );
}
