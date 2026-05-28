import { getSession } from '@/lib/auth';
import { getTranslations } from 'next-intl/server';
import { notFound, redirect } from 'next/navigation';
import { fetchPrintJournalData } from '../../actions';
import { PrintInvoiceClient } from './print-invoice-client';

export const metadata = {
  title: 'Print Journal',
};

export default async function PrintJournalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');

  const { id } = await params;
  const data = await fetchPrintJournalData(id);

  if (!data) notFound();

  const t = await getTranslations('accounting.print');

  return (
    <PrintInvoiceClient
      data={data}
      labels={{
        invoice: t('invoice'),
        receipt: t('receipt'),
        billTo: t('billTo'),
        date: t('date'),
        dueDate: t('dueDate'),
        paymentTo: t('paymentTo'),
        total: t('total'),
        notes: t('notes'),
        preparedBy: t('preparedBy'),
        authorizedBy: t('authorizedBy'),
        printOrSavePdf: t('printOrSavePdf'),
      }}
    />
  );
}
