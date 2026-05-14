/**
 * Hourly Sales Report Page — SD §25.6.3
 *
 * Heatmap + summary + table + XLSX export.
 */

import { getSession } from '@/lib/auth';
import { getActiveLocationOptions, resolveDefaultLocationId } from '@/lib/location-options';
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
  const user = session.user as Record<string, unknown>;
  const tenantId = (user.tenantId as string | undefined) ?? 'default';
  const sessionLocationId = user.locationId as string | undefined;
  const today = new Date().toISOString().slice(0, 10);
  const locationOptions = await getActiveLocationOptions({ tenantId, type: 'store' });

  const startDate = params.startDate ?? today;
  const endDate = params.endDate ?? today;
  const locationId = resolveDefaultLocationId(
    locationOptions,
    params.locationId,
    sessionLocationId,
  );
  const groupBy = params.groupBy ?? 'channel';

  const data = locationId
    ? await fetchHourlySales({
        locationId,
        startDate,
        endDate,
        groupBy: groupBy as 'channel' | 'day',
      })
    : { error: 'Tidak ada lokasi toko aktif untuk laporan penjualan per jam.' };

  return (
    <HourlySalesClient
      initialData={data}
      defaultStartDate={startDate}
      defaultEndDate={endDate}
      defaultLocationId={locationId}
      defaultGroupBy={groupBy as 'channel' | 'day'}
      locationOptions={locationOptions}
    />
  );
}
