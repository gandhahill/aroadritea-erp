'use client';

import { useEffect } from 'react';
import Image from 'next/image';
import { amountToWords } from '@erp/shared/amount-to-words';

interface PrintInvoiceClientProps {
  data: any;
  labels: {
    invoice: string;
    receipt: string;
    billTo: string;
    date: string;
    dueDate: string;
    paymentTo: string;
    total: string;
    notes: string;
    printOrSavePdf: string;
    description: string;
    qty: string;
    unitPrice: string;
    amount: string;
    amountInWords: string;
    printHint: string;
    paymentTerms: string;
    subtotal: string;
    tax: string;
    purchaseInvoice: string;
  };
}

export function PrintInvoiceClient({ data, labels }: PrintInvoiceClientProps) {
  const { invoice, lines, companyInfo } = data;

  // Trigger print immediately on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      window.print();
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  const documentTitle = invoice.type === 'sales' ? labels.invoice : labels.purchaseInvoice;

  // Calculate total amount for terbilang
  const totalNum = Number.parseInt(invoice.total, 10);
  const terbilang = amountToWords(totalNum);

  return (
    <div className="min-h-screen bg-brand-cream font-sans text-brand-ink selection:bg-brand-red/20 print:bg-white print:p-0">
      <div className="mx-auto max-w-4xl bg-white p-8 shadow-sm print:max-w-none print:shadow-none sm:p-12">
        {/* Header Section */}
        <div className="flex items-start justify-between border-b border-brand-cream-2 pb-8">
          <div className="flex flex-col">
            <div className="relative mb-2 h-12 w-32">
              <Image
                src="/logo-primary.png"
                alt="Aroadri Tea"
                fill
                priority
                className="object-contain object-left"
              />
            </div>
            <div className="mt-2 text-sm text-brand-ink-2 space-y-0.5">
              <p className="font-semibold text-brand-ink">
                {typeof companyInfo.name === 'object'
                  ? companyInfo.name?.id || companyInfo.name?.en || companyInfo.name?.zh
                  : companyInfo.name}
              </p>
              <p>
                Aroadri Tea —{' '}
                {typeof invoice.locationName === 'object'
                  ? invoice.locationName?.id || invoice.locationName?.en || invoice.locationName?.zh
                  : invoice.locationName}
              </p>
              {companyInfo.address && <p className="text-xs">{companyInfo.address}</p>}
              {companyInfo.npwp && <p className="text-xs">NPWP: {companyInfo.npwp}</p>}
              {companyInfo.phone && <p className="text-xs">Telp: {companyInfo.phone}</p>}
            </div>
          </div>

          <div className="text-right">
            <h1 className="text-3xl font-light tracking-wide text-brand-ink">{documentTitle}</h1>
            <p className="mt-2 font-mono text-sm text-brand-ink-2">{invoice.number}</p>
          </div>
        </div>

        {/* Info Grid */}
        <div className="mt-8 flex justify-between">
          <div className="w-1/2">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-brand-ink-3">
              {labels.billTo}
            </h3>
            <p className="text-base font-medium text-brand-ink">
              {invoice.partnerName ?? '-'}
            </p>
            {invoice.partnerAddress && (
              <p className="mt-1 text-sm text-brand-ink-2 max-w-xs">{invoice.partnerAddress}</p>
            )}
            {invoice.partnerNpwp && (
              <p className="mt-1 text-xs text-brand-ink-2">NPWP: {invoice.partnerNpwp}</p>
            )}
            {invoice.notes && (
              <p className="mt-4 text-sm text-brand-ink-2 max-w-xs">{invoice.notes}</p>
            )}
          </div>

          <div className="w-1/3 text-right">
            <div className="mb-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-brand-ink-3">
                {labels.date}
              </h3>
              <p className="font-mono text-sm text-brand-ink">{invoice.date}</p>
            </div>
            {invoice.dueDate && (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-brand-ink-3">
                  {labels.dueDate}
                </h3>
                <p className="font-mono text-sm text-brand-ink">{invoice.dueDate}</p>
              </div>
            )}
            {invoice.paymentTerms && (
              <div className="mt-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-brand-ink-3">
                  {labels.paymentTerms}
                </h3>
                <p className="font-mono text-sm text-brand-ink">{invoice.paymentTerms}</p>
              </div>
            )}
          </div>
        </div>

        {/* Lines Table */}
        <div className="mt-12">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-brand-cream-3">
                <th className="pb-3 text-left font-semibold text-brand-ink-3 uppercase tracking-wider text-xs">
                  {labels.description}
                </th>
                <th className="pb-3 text-right font-semibold text-brand-ink-3 uppercase tracking-wider text-xs w-24">
                  {labels.qty}
                </th>
                <th className="pb-3 text-right font-semibold text-brand-ink-3 uppercase tracking-wider text-xs w-32">
                  {labels.unitPrice}
                </th>
                <th className="pb-3 text-right font-semibold text-brand-ink-3 uppercase tracking-wider text-xs w-32">
                  {labels.amount}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-cream-2">
              {lines.map((line: any) => {
                return (
                  <tr key={line.id} className="group">
                    <td className="py-4">
                      <div className="font-medium text-brand-ink">
                        {line.description}
                      </div>
                    </td>
                    <td className="py-4 text-right font-mono text-brand-ink">
                      {line.quantity} {line.unit && <span className="text-brand-ink-2 text-xs ml-0.5">{line.unit}</span>}
                    </td>
                    <td className="py-4 text-right font-mono text-brand-ink">
                      {formatRp(line.unitPrice)}
                    </td>
                    <td className="py-4 text-right font-mono text-brand-ink">
                      {formatRp(line.subtotal)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-brand-cream-2">
                <td colSpan={3} className="pt-4 pb-2 text-right font-semibold text-brand-ink uppercase text-xs tracking-wider">
                  {labels.subtotal}
                </td>
                <td className="pt-4 pb-2 text-right font-mono font-semibold text-brand-ink">
                  {formatRp(invoice.subtotal)}
                </td>
              </tr>
              {BigInt(invoice.taxAmount) > 0n && (
                <tr className="">
                  <td colSpan={3} className="py-2 text-right font-semibold text-brand-ink uppercase text-xs tracking-wider">
                    {labels.tax}
                  </td>
                  <td className="py-2 text-right font-mono font-semibold text-brand-ink">
                    {formatRp(invoice.taxAmount)}
                  </td>
                </tr>
              )}
              <tr className="border-t-2 border-brand-ink">
                <td colSpan={3} className="pt-4 text-right font-semibold text-brand-ink uppercase text-xs tracking-wider">
                  {labels.total}
                </td>
                <td className="pt-4 text-right font-mono font-bold text-brand-ink text-base">
                  {formatRp(invoice.total)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Terbilang (Amount in Words) */}
        {terbilang && (
          <div className="mt-8 rounded-lg border border-brand-cream-3 bg-brand-cream-1 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-ink-3 mb-1">
              {labels.amountInWords}
            </p>
            <p className="text-sm font-medium text-brand-ink italic">{terbilang}</p>
          </div>
        )}

        {/* Footer Section */}
        <div className="mt-16 border-t border-brand-cream-2 pt-8 flex justify-between">
          <div className="w-1/2">
            {invoice.type === 'sales' && companyInfo.bankName && companyInfo.bankAccount && (
              <div className="mb-6">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-brand-ink-3">
                  {labels.paymentTo}
                </h3>
                <div className="text-sm text-brand-ink-2">
                  <p className="font-semibold text-brand-ink">{companyInfo.bankName}</p>
                  <p className="font-mono text-base font-medium text-brand-ink my-0.5">{companyInfo.bankAccount}</p>
                  {companyInfo.bankAccountName && <p>a/n {companyInfo.bankAccountName}</p>}
                </div>
              </div>
            )}
            {invoice.notes && (
              <div className="mt-2">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-brand-ink-3">
                  {labels.notes}
                </h3>
                <p className="text-sm text-brand-ink-2 whitespace-pre-wrap">
                  {invoice.notes}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Print instruction banner (hidden on print) */}
        <div className="mt-12 text-center print:hidden">
          <p className="text-sm text-brand-ink-3">{labels.printHint}</p>
          <button
            onClick={() => window.print()}
            className="mt-4 rounded-md bg-brand-red px-6 py-2 text-sm font-medium text-white shadow-pop hover:bg-brand-red-dark transition-colors"
          >
            {labels.printOrSavePdf}
          </button>
        </div>
      </div>
    </div>
  );
}

function formatRp(amountStr: string | bigint): string {
  const num = typeof amountStr === 'bigint' ? Number(amountStr) : Number.parseInt(amountStr, 10);
  if (Number.isNaN(num)) return String(amountStr);
  return `Rp ${num.toLocaleString('id-ID')}`;
}
