/**
 * Waste / Spoilage report — T-0174.
 */

import { PageHeader } from '@/components/page-header';
import { getSession } from '@/lib/auth';
import { getActiveLocationOptions } from '@/lib/location-options';
import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { fetchWaste } from './actions';
import { WasteClient } from './waste-client';

export const metadata: Metadata = { title: 'Waste / Spoilage | Aroadri ERP' };

function todayWib(): string {
  return new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
}

function firstOfMonthWib(): string {
  const today = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
  return `${today.slice(0, 7)}-01`;
}

export default async function WastePage({
  searchParams,
}: {
  searchParams: Promise<{
    from?: string;
    to?: string;
    locationId?: string;
    includePending?: string;
  }>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');
  const params = await searchParams;
  const from = params.from ?? firstOfMonthWib();
  const to = params.to ?? todayWib();
  const locationId = params.locationId || undefined;
  const includePending = params.includePending === 'true';

  const t = await getTranslations('reporting.waste');
  const tenantId = String((session.user as Record<string, unknown>).tenantId ?? 'default');
  const rawLocale = await getLocale().catch(() => 'id');
  const locale = (rawLocale === 'en' || rawLocale === 'zh' ? rawLocale : 'id') as
    | 'id'
    | 'en'
    | 'zh';
  const locationOptions = await getActiveLocationOptions({ tenantId, locale });

  const result = await fetchWaste({ from, to, locationId, includePending });

  return (
    <div className="space-y-6">
      <PageHeader title={t('title')} description={t('description')} />
      <WasteClient
        from={from}
        to={to}
        locationId={locationId ?? ''}
        includePending={includePending}
        locationOptions={locationOptions.map((l) => ({ value: l.id, label: l.label }))}
        data={result.ok ? (result.data ?? null) : null}
        error={result.ok ? null : (result.error ?? null)}
      />
    </div>
  );
}
