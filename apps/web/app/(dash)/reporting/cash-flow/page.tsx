/**
 * Cash Flow report — T-0174 (service already existed; this just ships
 * the UI page that was missing).
 */

import { getSession } from '@/lib/auth';
import { PageHeader } from '@/components/page-header';
import { getActiveLocationOptions } from '@/lib/location-options';
import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { fetchCashFlow } from './actions';
import { CashFlowClient } from './cash-flow-client';

export const metadata: Metadata = { title: 'Cash Flow' };

function todayWib(): string {
  return new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
}

function firstOfMonthWib(): string {
  const today = todayWib();
  return `${today.slice(0, 7)}-01`;
}

export default async function CashFlowPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; locationId?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');
  const params = await searchParams;
  const from = params.from ?? firstOfMonthWib();
  const to = params.to ?? todayWib();
  const locationId = params.locationId || undefined;

  const t = await getTranslations('reporting.cashFlowPage');
  const tenantId = String((session.user as Record<string, unknown>).tenantId ?? 'default');
  const rawLocale = await getLocale().catch(() => 'id');
  const locale = (rawLocale === 'en' || rawLocale === 'zh' ? rawLocale : 'id') as
    | 'id'
    | 'en'
    | 'zh';
  const locationOptions = await getActiveLocationOptions({ tenantId, locale });

  const result = await fetchCashFlow({ from, to, locationId });

  return (
    <main className="space-y-6 p-6">
      <PageHeader title={t('title')} description={t('description')} />
      <CashFlowClient
        from={from}
        to={to}
        locationId={locationId ?? ''}
        locationOptions={locationOptions.map((l) => ({ value: l.id, label: l.label }))}
        data={result.ok ? result.data ?? null : null}
        error={result.ok ? null : result.error ?? null}
      />
    </main>
  );
}
