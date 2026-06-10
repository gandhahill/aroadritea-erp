import { PageHeader } from '@/components/page-header';
import { getSession } from '@/lib/auth';
import { and, db, eq } from '@erp/db';
import { accounts, invoices } from '@erp/db';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { PayInvoiceForm } from './client';

export default async function PayInvoicePage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const session = await getSession();
  if (!session) redirect('/login');
  const user = session.user as any;
  const t = await getTranslations('accounting.invoice');

  const [invoice] = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.id, id), eq(invoices.tenantId, String(user.tenantId ?? 'default'))))
    .limit(1);

  if (!invoice) redirect('/accounting/invoices');
  if (invoice.status !== 'posted') redirect(`/accounting/invoices/${id}`);

  // Fetch asset accounts (cash/bank usually)
  const bankAccounts = await db
    .select()
    .from(accounts)
    .where(
      and(eq(accounts.tenantId, String(user.tenantId ?? 'default')), eq(accounts.type, 'asset')),
    );

  return (
    <div className="space-y-6">
      <PageHeader title={<>{t('payInvoice')}</>} description={<>{invoice.number}</>} />

      <PayInvoiceForm invoice={invoice} bankAccounts={bankAccounts} />
    </div>
  );
}
