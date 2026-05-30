import { getSession } from '@/lib/auth';
import { getActiveLocationOptions } from '@/lib/location-options';
import type { Metadata } from 'next';
import { getLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { fetchDonationReport } from './actions';
import { DonationsClient } from './donations-client';

export const metadata: Metadata = { title: 'Donation Report' };

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
  const user = session.user as Record<string, unknown>;
  const tenantId = (user.tenantId as string | undefined) ?? 'default';
  const today = new Date().toISOString().slice(0, 10);
  const rawLocale = await getLocale().catch(() => 'id');
  const locale: 'id' | 'en' | 'zh' = rawLocale === 'en' || rawLocale === 'zh' ? rawLocale : 'id';
  const locationOptions = await getActiveLocationOptions({ tenantId, locale, type: 'store' });

  const startDate = params.startDate ?? today;
  const endDate = params.endDate ?? today;
  const locationIds = new Set(locationOptions.map((location) => location.id));
  const locationId =
    params.locationId && locationIds.has(params.locationId) ? params.locationId : undefined;

  const data = await fetchDonationReport({ locationId, startDate, endDate });

  return (
    <DonationsClient
      initialData={data}
      defaultStartDate={startDate}
      defaultEndDate={endDate}
      defaultLocationId={locationId ?? ''}
      locationOptions={locationOptions}
    />
  );
}
