import { getSession } from '@/lib/auth';
import { authorizedLocationIdsForTenant } from '@/lib/authz';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { fetchInvoicesAction } from './actions';
import { PageHeader } from '@/components/page-header';

export const metadata: Metadata = {
  title: 'Invoices',
};

export default async function InvoicesPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const user = session.user as Record<string, unknown>;
  const scope = await authorizedLocationIdsForTenant(
    String(user.id ?? ''),
    'accounting.view',
    String(user.tenantId ?? 'default'),
  );
  if (!scope.global && scope.locationIds.length === 0) redirect('/dashboard');

  const [invoicesList, t] = await Promise.all([
    fetchInvoicesAction(),
    getTranslations('accounting.invoice')
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={<>{t('title')}</>}
        description={<>{t('subtitle')}</>}
        actions={
          <>
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-jade-light px-3 py-1 text-xs font-medium text-brand-jade">
                {t('count', { count: invoicesList.length })}
              </span>
              <Link
                href="/accounting/invoices/new"
                className="rounded-lg bg-brand-red px-4 py-2 text-sm font-semibold text-white shadow-soft transition-colors hover:bg-brand-red-dark"
              >
                {t('create')}
              </Link>
            </div>
          </>
        }
      />

      <div className="overflow-x-auto rounded-lg border border-brand-cream-3 bg-card shadow-soft">
        <table className="w-full text-left text-sm">
          <thead className="bg-brand-cream-1">
            <tr>
              <th className="px-6 py-4 font-semibold text-brand-ink-3">{t('number')}</th>
              <th className="px-6 py-4 font-semibold text-brand-ink-3">{t('date')}</th>
              <th className="px-6 py-4 font-semibold text-brand-ink-3">{t('type')}</th>
              <th className="px-6 py-4 font-semibold text-brand-ink-3">{t('partner')}</th>
              <th className="px-6 py-4 font-semibold text-brand-ink-3">{t('status')}</th>
              <th className="px-6 py-4 font-semibold text-brand-ink-3">{t('total')}</th>
              <th className="px-6 py-4 font-semibold text-brand-ink-3">{t('actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-cream-2">
            {invoicesList.map((inv: any) => (
              <tr key={inv.id} className="transition-colors hover:bg-brand-cream-1/50">
                <td className="px-6 py-4 font-medium text-brand-ink">{inv.number}</td>
                <td className="px-6 py-4 text-brand-ink-2">{inv.date}</td>
                <td className="px-6 py-4 capitalize text-brand-ink-2">{inv.type === 'sales' ? t('sales') : t('purchase')}</td>
                <td className="px-6 py-4 text-brand-ink-2">{inv.partnerName}</td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    inv.status === 'posted' ? 'bg-brand-cream-2 text-brand-ink-2' : 
                    inv.status === 'paid' ? 'bg-brand-jade-light text-brand-jade' :
                    inv.status === 'draft' ? 'bg-brand-cream-3 text-brand-ink-2' : 
                    'bg-brand-red-light text-brand-red'
                  }`}>
                    {inv.status}
                  </span>
                </td>
                <td className="px-6 py-4 font-mono text-brand-ink">{inv.total.toString()}</td>
                <td className="px-6 py-4 text-brand-ink-2 flex gap-4">
                  {inv.status === 'draft' && (
                    <Link href={`/accounting/invoices/${inv.id}/post`} className="text-brand-jade hover:underline">
                      {t('post')}
                    </Link>
                  )}
                  {inv.status === 'posted' && (
                    <Link href={`/accounting/invoices/${inv.id}/pay`} className="text-brand-jade hover:underline font-semibold">
                      {t('payAction')}
                    </Link>
                  )}
                  {inv.status === 'paid' && inv.paymentJournalId && (
                    <Link href={`/accounting/journals/${inv.paymentJournalId}/print?type=kuitansi`} target="_blank" className="text-brand-red hover:underline font-semibold">
                      {t('printKuitansi')}
                    </Link>
                  )}
                  {inv.journalId && (
                    <Link href={`/accounting/journals/${inv.journalId}`} className="text-brand-ink-3 hover:underline text-xs mt-1 block">
                      {t('viewJournal')}
                    </Link>
                  )}
                </td>
              </tr>
            ))}
            {invoicesList.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-brand-ink-3">
                  {t('empty')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
