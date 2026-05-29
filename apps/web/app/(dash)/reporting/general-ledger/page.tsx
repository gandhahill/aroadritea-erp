import { PageHeader } from '@/components/page-header';
import { getSession } from '@/lib/auth';
import { getActiveLocationOptions } from '@/lib/location-options';
import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { fetchGeneralLedgerAction } from './actions';
import { LedgerClient } from './ledger-client';
import { db, eq } from '@erp/db';
import { accounts } from '@erp/db/schema/accounting';

export const metadata: Metadata = { title: 'General Ledger | Aroadri ERP' };

function todayWib(): string {
  return new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
}

function firstOfMonthWib(): string {
  const today = todayWib();
  return `${today.slice(0, 7)}-01`;
}

export default async function GeneralLedgerPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; locationId?: string; accountId?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');
  const params = await searchParams;
  const from = params.from ?? firstOfMonthWib();
  const to = params.to ?? todayWib();
  const locationId = params.locationId || undefined;
  const accountId = params.accountId || undefined;

  const tenantId = String((session.user as Record<string, unknown>).tenantId ?? 'default');
  const rawLocale = await getLocale().catch(() => 'id');
  const locale = (rawLocale === 'en' || rawLocale === 'zh' ? rawLocale : 'id') as
    | 'id'
    | 'en'
    | 'zh';
  const locationOptions = await getActiveLocationOptions({ tenantId, locale });

  // Fetch account options
  const accountRows = await db
    .select({ id: accounts.id, code: accounts.code, name: accounts.name })
    .from(accounts)
    .where(eq(accounts.tenantId, tenantId))
    .orderBy(accounts.code);

  const accountOptions = accountRows.map((a) => ({
    value: a.id,
    code: a.code,
    label: (a.name as any)[locale] || (a.name as any).id || (a.name as any).en || '',
  }));

  let resultData = null;
  let errorMsg = null;

  if (accountId) {
    try {
      resultData = await fetchGeneralLedgerAction(accountId, from, to, locationId ?? 'all');
    } catch (err: any) {
      errorMsg = err.message;
    }
  }

  const t = await getTranslations('reporting.generalLedgerPage');

  return (
    <div className="space-y-6">
      <PageHeader title={t('title')} description={t('subtitle')} />
      <LedgerClient
        from={from}
        to={to}
        locationId={locationId ?? ''}
        accountId={accountId ?? ''}
        locationOptions={locationOptions.map((l) => ({ value: l.id, label: l.label }))}
        accountOptions={accountOptions}
        data={resultData}
        error={errorMsg}
      />
    </div>
  );
}
