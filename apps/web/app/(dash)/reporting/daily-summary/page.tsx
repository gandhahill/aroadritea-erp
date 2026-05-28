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
import { fetchDailySummary, fetchDailySummaryPrevious } from './actions';
import { DailySummaryClient } from './daily-summary-client';

import { getTranslations } from 'next-intl/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('reporting.dailySummary');
  return { title: `${t('title')} | Aroadri ERP` };
}

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
  const locale: 'id' | 'en' | 'zh' = rawLocale === 'en' || rawLocale === 'zh' ? rawLocale : 'id';
  const locationOptions = await getActiveLocationOptions({ tenantId, locale, type: 'store' });

  const startDate = params.startDate ?? today;
  const endDate = params.endDate ?? today;
  const locationId = resolveDefaultLocationId(
    locationOptions,
    params.locationId,
    sessionLocationId,
  );

  const t = await getTranslations('reporting.dailySummary');
  const [data, prev] = locationId
    ? await Promise.all([
        fetchDailySummary({
          locationId,
          startDate,
          endDate,
          cashierId: params.cashierId,
        }),
        fetchDailySummaryPrevious({
          locationId,
          startDate,
          endDate,
          cashierId: params.cashierId,
        }),
      ])
    : [{ error: t('noActiveOutlets') }, { previous: null, prevRange: { from: '', to: '' } }];

  return (
    <DailySummaryClient
      initialData={data}
      initialPrevious={prev.previous}
      initialPrevRange={prev.prevRange}
      defaultStartDate={startDate}
      defaultEndDate={endDate}
      defaultLocationId={locationId}
      locationOptions={locationOptions}
    />
  );
}
