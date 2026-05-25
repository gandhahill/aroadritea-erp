/**
 * Aging Payables — T-0174 (mirror of AR page; same client component
 * with `kind="AP"`).
 */

import { PageHeader } from '@/components/page-header';
import { getSession } from '@/lib/auth';
import { getActiveLocationOptions } from '@/lib/location-options';
import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { AgingClient } from '../_components/aging-client';
import { fetchAgingPayables } from './actions';

export const metadata: Metadata = { title: 'Aging Payables' };

function todayWib(): string {
  return new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
}

export default async function AgingPayablesPage({
  searchParams,
}: {
  searchParams: Promise<{ asOf?: string; locationId?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');
  const params = await searchParams;
  const asOf = params.asOf ?? todayWib();
  const locationId = params.locationId || undefined;

  const t = await getTranslations('reporting.aging');
  const tenantId = String((session.user as Record<string, unknown>).tenantId ?? 'default');
  const rawLocale = await getLocale().catch(() => 'id');
  const locale = (rawLocale === 'en' || rawLocale === 'zh' ? rawLocale : 'id') as
    | 'id'
    | 'en'
    | 'zh';
  const locationOptions = await getActiveLocationOptions({ tenantId, locale });

  const result = await fetchAgingPayables({ asOf, locationId });

  return (
    <main className="space-y-6 p-6">
      <PageHeader title={t('payablesTitle')} description={t('payablesDescription')} />
      <AgingClient
        kind="AP"
        asOf={asOf}
        locationId={locationId ?? ''}
        locationOptions={locationOptions.map((l) => ({ value: l.id, label: l.label }))}
        data={result.ok ? (result.data ?? null) : null}
        error={result.ok ? null : (result.error ?? null)}
      />
    </main>
  );
}
