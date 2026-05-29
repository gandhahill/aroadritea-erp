import { PageHeader } from '@/components/page-header';
import { getSession } from '@/lib/auth';
import { getActiveLocationOptions } from '@/lib/location-options';
import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { getEquityChangesAction } from './actions';
import { EquityChangesClient } from './equity-client';

export const metadata: Metadata = { title: 'Changes in Equity | Aroadri ERP' };

function todayWib(): string {
  return new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
}

function firstOfYearWib(): string {
  const today = todayWib();
  return `${today.slice(0, 4)}-01-01`;
}

export default async function EquityChangesPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; locationId?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');
  const params = await searchParams;
  const from = params.from ?? firstOfYearWib();
  const to = params.to ?? todayWib();
  const locationId = params.locationId || undefined;

  const t = await getTranslations('reporting.equityChangesPage');
  const tenantId = String((session.user as Record<string, unknown>).tenantId ?? 'default');
  const rawLocale = await getLocale().catch(() => 'id');
  const locale = (rawLocale === 'en' || rawLocale === 'zh' ? rawLocale : 'id') as
    | 'id'
    | 'en'
    | 'zh';
  const locationOptions = await getActiveLocationOptions({ tenantId, locale });

  let resultData = null;
  let errorMsg = null;

  try {
    resultData = await getEquityChangesAction(from, to, locationId ?? 'all');
  } catch (err: any) {
    errorMsg = err.message;
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t('title')} description={t('subtitle')} />
      <EquityChangesClient
        from={from}
        to={to}
        locationId={locationId ?? ''}
        locationOptions={locationOptions.map((l) => ({ value: l.id, label: l.label }))}
        data={resultData}
        error={errorMsg}
      />
    </div>
  );
}
