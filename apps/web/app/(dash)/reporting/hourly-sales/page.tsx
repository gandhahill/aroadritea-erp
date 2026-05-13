/**
 * Hourly Sales Report Page — SD §25.6.3
 *
 * Heatmap + summary + table + XLSX export.
 */

import { getSession } from '@/lib/auth';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { fetchHourlySales } from './actions';
import { HourlySalesClient } from './hourly-sales-client';

export const metadata: Metadata = { title: 'Penjualan Per Jam' };

export default async function HourlySalesPage({
  searchParams,
}: {
  searchParams: Promise<{
    startDate?: string;
    endDate?: string;
    locationId?: string;
    groupBy?: 'channel' | 'day';
  }>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');

  const params = await searchParams;
  const today = new Date().toISOString().slice(0, 10);

  const startDate = params.startDate ?? today;
  const endDate = params.endDate ?? today;
  const locationId = params.locationId ?? '';
  const groupBy = params.groupBy ?? 'channel';

  const data = await fetchHourlySales({
    locationId,
    startDate,
    endDate,
    groupBy: groupBy as 'channel' | 'day',
  });

  return (
    <HourlySalesClient
      initialData={data}
      defaultStartDate={startDate}
      defaultEndDate={endDate}
      defaultLocationId={locationId}
      defaultGroupBy={groupBy as 'channel' | 'day'}
    />
  );
}
