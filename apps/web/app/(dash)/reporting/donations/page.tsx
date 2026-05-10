import type { Metadata } from 'next';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { fetchDonationReport } from './actions';
import { DonationsClient } from './donations-client';

export const metadata: Metadata = { title: 'Laporan Donasi' };

export default async function DonationsPage({
  searchParams,
}: {
  searchParams: Promise<{
    startDate?: string;
    endDate?: string;
    locationId?: string;
  }>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');

  const params = await searchParams;
  const today = new Date().toISOString().slice(0, 10);

  const startDate = params.startDate ?? today;
  const endDate = params.endDate ?? today;
  const locationId = params.locationId ?? undefined;

  const data = await fetchDonationReport({ locationId, startDate, endDate });

  return (
    <DonationsClient
      initialData={data}
      defaultStartDate={startDate}
      defaultEndDate={endDate}
      defaultLocationId={locationId ?? ''}
    />
  );
}
