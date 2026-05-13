/**
 * Daily Summary Report Page — SD §25.5.2
 *
 * Filter bar + summary cards + payment breakdown + top products + XLSX export.
 */

import { getSession } from '@/lib/auth';
import type { Metadata } from 'next';
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

  const startDate = params.startDate ?? today;
  const endDate = params.endDate ?? today;
  const locationId = params.locationId ?? 'LOC-001';

  const data = await fetchDailySummary({
    locationId,
    startDate,
    endDate,
    cashierId: params.cashierId,
  });

  return (
    <DailySummaryClient
      initialData={data}
      defaultStartDate={startDate}
      defaultEndDate={endDate}
      defaultLocationId={locationId}
    />
  );
}
