import { PageHeader } from '@/components/page-header';
import { getSession } from '@/lib/auth';
import { authorizedLocationIdsForTenant } from '@/lib/authz';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { fetchJournalFormData } from '../actions';
import { JournalForm } from './journal-form';

export const metadata: Metadata = {
  title: 'New Journal Entry | Aroadri ERP',
};

export default async function NewJournalPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const user = session.user as Record<string, unknown>;
  const scope = await authorizedLocationIdsForTenant(
    String(user.id ?? ''),
    'accounting.journal.create',
    String(user.tenantId ?? 'default'),
  );
  if (!scope.global && scope.locationIds.length === 0) redirect('/dashboard');

  const [data, t] = await Promise.all([
    fetchJournalFormData(),
    getTranslations('accounting.journal.new'),
  ]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader title={<>{t('title')}</>} description={<>{t('subtitle')}</>} />

      {data.accounts.length === 0 || data.locations.length === 0 ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {t('missingMasterData')}
        </div>
      ) : null}

      <JournalForm accounts={data.accounts} locations={data.locations} partners={data.partners} />
    </div>
  );
}
