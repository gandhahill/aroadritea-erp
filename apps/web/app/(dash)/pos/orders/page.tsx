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

import { PageHeader } from '@/components/page-header';
import { Pagination } from '@/components/pagination';
import { ExportOrdersButton } from './export-orders-button';

export const metadata: Metadata = { title: 'Order History' }; // Needs generating dynamically later if want fully i18n title
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
        <PageHeader title={<>{t('title')}</>} />
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-8 text-center text-rose-700">
          <p className="font-medium">{t('loadError')}</p>
          <p className="text-sm mt-1">
            {data.error === 'Unauthenticated' ? t('errors.noLocation') : data.error}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={<>{t('title')}</>}
        description={<>{t('subtitle')}</>}
        eyebrow={<>POS</>}
        actions={
          <>
            <div className="flex items-center gap-2">
              <DatePicker initialDate={date} t={t} />
              <ExportOrdersButton date={date} />
            </div>
          </>
        }
      />

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
        className="h-9 rounded-md border border-brand-cream-3 bg-white px-3 text-sm text-brand-ink focus:border-brand-red focus:outline-none focus:ring-2 focus:ring-brand-red/20"
      />
      <button
        type="submit"
        className="h-9 rounded-md bg-brand-red px-4 text-sm font-semibold text-white hover:bg-brand-red-dark"
      >
        {t('show')}
      </button>
    </form>
  );
}
