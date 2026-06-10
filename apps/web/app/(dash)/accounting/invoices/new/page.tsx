import { PageHeader } from '@/components/page-header';
import { getSession } from '@/lib/auth';
import { authorizedLocationIdsForTenant } from '@/lib/authz';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { fetchJournalFormData } from '../../journals/actions';
import { InvoiceForm } from './client';

export const metadata: Metadata = {
  title: 'New Invoice',
};

export default async function NewInvoicePage() {
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
    getTranslations('accounting.invoice.new'),
  ]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader title={<>{t('title')}</>} description={<>{t('subtitle')}</>} />

      <InvoiceForm accounts={data.accounts} locations={data.locations} partners={data.partners} />
    </div>
  );
}
