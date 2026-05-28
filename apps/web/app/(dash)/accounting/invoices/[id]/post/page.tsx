import { PageHeader } from '@/components/page-header';
import { getSession } from '@/lib/auth';
import { authorizedLocationIdsForTenant } from '@/lib/authz';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { fetchJournalFormData } from '../../../journals/actions';
import { PostInvoiceForm } from './client';
import { db, eq } from '@erp/db';
import { invoices } from '@erp/db/schema/accounting';

export const metadata: Metadata = {
  title: 'Post Invoice - Aroadri ERP',
};

export default async function PostInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect('/login');
  const user = session.user as Record<string, unknown>;
  const scope = await authorizedLocationIdsForTenant(
    String(user.id ?? ''),
    'accounting.journal.create',
    String(user.tenantId ?? 'default'),
  );
  if (!scope.global && scope.locationIds.length === 0) redirect('/dashboard');

  const { id } = await params;

  const invoiceRows = await db.select().from(invoices).where(eq(invoices.id, id));
  if (invoiceRows.length === 0) redirect('/accounting/invoices');
  const invoice = invoiceRows[0];

  const [data, t] = await Promise.all([
    fetchJournalFormData(),
    getTranslations('accounting.invoice.postAction')
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader title={<>{t('title')}</>} description={<>{t('subtitle')}</>} />

      <PostInvoiceForm invoice={invoice} accounts={data.accounts} />
    </div>
  );
}
