/**
 * POS Order History — SD §21.4
 *
 * Lists today's orders for the cashier's current location with a
 * click-through detail panel that surfaces void / refund. The shell is
 * a server component so the initial render is cached; the detail
 * actions live in OrdersClient.
 */

import type { Metadata } from 'next';
import { fetchTodaysOrders } from './actions';
import { OrdersClient } from './orders-client';

export const metadata: Metadata = { title: 'Riwayat Pesanan — POS' };
export const dynamic = 'force-dynamic';

interface Props {
  searchParams: Promise<{ date?: string }>;
}

export default async function PosOrdersPage({ searchParams }: Props) {
  const { date } = await searchParams;
  const data = await fetchTodaysOrders(date);

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
    </div>
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
