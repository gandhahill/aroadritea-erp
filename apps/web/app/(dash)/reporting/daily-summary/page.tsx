/**
 * Daily Summary Report Page — SD §25.5.2
 *
 * Filter bar + summary cards + payment breakdown + top products + XLSX export.
 */

import { getSession } from '@/lib/auth';
import { getActiveLocationOptions, resolveDefaultLocationId } from '@/lib/location-options';
import type { Metadata } from 'next';
import { getLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { fetchDailySummary } from './actions';
import { DailySummaryClient } from './daily-summary-client';

export const metadata: Metadata = { title: 'Ringkasan Harian' };

export default async function DailySummaryPage({
  searchParams,
}: {
  searchParams: Promise<{
    startDate?: string;
    endDate?: string;
    locationId?: string;
    cashierId?: string;
  }>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');

  const params = await searchParams;
  const today = new Date().toISOString().slice(0, 10);
  const user = session.user as Record<string, unknown>;
  const tenantId = (user.tenantId as string) ?? 'default';
  const sessionLocationId = user.locationId as string | undefined;
  const rawLocale = await getLocale().catch(() => 'id');
  const locale: 'id' | 'en' | 'zh' =
    rawLocale === 'en' || rawLocale === 'zh' ? rawLocale : 'id';
  const locationOptions = await getActiveLocationOptions({ tenantId, locale, type: 'store' });

  const startDate = params.startDate ?? today;
  const endDate = params.endDate ?? today;
  const locationId = resolveDefaultLocationId(
    locationOptions,
    params.locationId,
    sessionLocationId,
  );

  const data = locationId
    ? await fetchDailySummary({
        locationId,
        startDate,
        endDate,
        cashierId: params.cashierId,
      })
    : { error: 'Belum ada outlet aktif untuk laporan harian.' };

  return (
    <DailySummaryClient
      initialData={data}
      defaultStartDate={startDate}
      defaultEndDate={endDate}
      defaultLocationId={locationId}
      locationOptions={locationOptions}
    />
  );
}
