import { getSession } from '@/lib/auth';
import { getTranslations } from 'next-intl/server';
import { notFound, redirect } from 'next/navigation';
import { fetchPrintInvoiceData } from '../../actions';
import { PrintInvoiceClient } from './print-invoice-client';

export const metadata = {
  title: 'Print Invoice',
};

export default async function PrintInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');

  const { id } = await params;
  const data = await fetchPrintInvoiceData(id);

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
        printOrSavePdf: t('printOrSavePdf'),
        description: t('description'),
        qty: t('qty'),
        unitPrice: t('unitPrice'),
        amount: t('amount'),
        amountInWords: t('amountInWords'),
        printHint: t('printHint'),
        paymentTerms: t('paymentTerms'),
        subtotal: t('subtotal'),
        tax: t('tax'),
        purchaseInvoice: t('purchaseInvoice'),
      }}
    />
  );
}
