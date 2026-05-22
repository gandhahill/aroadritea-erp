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

import { Pagination } from '@/components/pagination';
import { ExportOrdersButton } from './export-orders-button';

export const metadata: Metadata = { title: 'Riwayat Pesanan — POS' }; // Needs generating dynamically later if want fully i18n title
export const dynamic = 'force-dynamic';

interface Props {
  searchParams: Promise<{ date?: string; page?: string; pageSize?: string }>;
}

export default async function PosOrdersPage({ searchParams }: Props) {
  const { date, page: pageParam, pageSize: pageSizeParam } = await searchParams;
  const page = Number.parseInt(pageParam ?? '1', 10);
  const pageSize = Number.parseInt(pageSizeParam ?? '20', 10);
  const [data, pagination] = await Promise.all([
    fetchTodaysOrders(
      date,
      Number.isFinite(page) ? page : 1,
      Number.isFinite(pageSize) ? pageSize : 20,
    ),
    getTranslations('common.pagination'),
  ]);

  const t = await getTranslations('pos.orders');

  if (!data.ok) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-brand-ink">{t('title')}</h1>
        <div className="rounded-xl border border-brand-cream-3 bg-card p-6 text-sm text-brand-ink-3">
          {data.error === 'Unauthenticated'
            ? t('unauthenticated')
            : t('loadFailed')}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand-red/80">POS</p>
          <h1 className="mt-1 text-2xl font-bold text-brand-ink">{t('title')}</h1>
          <p className="mt-1 max-w-2xl text-sm text-brand-ink-3">
            {t('subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DatePicker initialDate={date} t={t} />
          <ExportOrdersButton date={date} />
        </div>
      </div>

      <OrdersClient rows={data.rows} />
      <Pagination currentPage={data.page} totalItems={data.total} pageSize={data.pageSize} />
    </div>
  );
}

function DatePicker({ initialDate, t }: { initialDate?: string; t: any }) {
  const today = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
  return (
    <form className="flex items-center gap-2">
      <label htmlFor="orders-date" className="text-xs font-medium text-brand-ink-3">
        {t('date')}
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
        {t('show')}
      </button>
    </form>
  );
}
