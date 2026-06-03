import { PageHeader } from '@/components/page-header';
import { Pagination } from '@/components/pagination';
import { getSession } from '@/lib/auth';
import { getActiveLocationOptions } from '@/lib/location-options';
import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { fetchGeneralLedgerAction } from './actions';
import { LedgerClient } from './ledger-client';
import { db, eq } from '@erp/db';
import { accounts } from '@erp/db/schema/accounting';

export const metadata: Metadata = { title: 'General Ledger' };

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
  searchParams: Promise<{ from?: string; to?: string; locationId?: string; accountId?: string; page?: string; pageSize?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');
  const params = await searchParams;
  const from = params.from ?? firstOfMonthWib();
  const to = params.to ?? todayWib();
  const locationId = params.locationId || undefined;
  const accountId = params.accountId || undefined;
  const page = Math.max(1, Number(params.page) || 1);
  const pageSize = [20, 50, 100].includes(Number(params.pageSize)) ? Number(params.pageSize) : 50;

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
      resultData = await fetchGeneralLedgerAction(accountId, from, to, locationId ?? 'all', { limit: pageSize, offset: (page - 1) * pageSize });
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
      {resultData && resultData.totalLines > 0 && (
        <Pagination currentPage={page} totalItems={resultData.totalLines} pageSize={pageSize} pageSizeOptions={[20, 50, 100]} />
      )}
    </div>
  );
}
