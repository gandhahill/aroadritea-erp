'use client';

import type { PrintJournalData, BankAccountDetail } from '../../actions';
import { useEffect } from 'react';
import Image from 'next/image';
import { amountToWords } from '@erp/shared/amount-to-words';

interface PrintInvoiceClientProps {
  data: PrintJournalData;
  labels: {
    invoice: string;
    receipt: string;
    billTo: string;
    date: string;
    dueDate: string;
    paymentTo: string;
    total: string;
    notes: string;
    preparedBy: string;
    authorizedBy: string;
    printOrSavePdf: string;
    description: string;
    debit: string;
    credit: string;
    amountInWords: string;
    printHint: string;
    companyAddress: string;
    companyNpwp: string;
    companyPhone: string;
    paymentTerms: string;
    subtotal: string;
    tax: string;
  };
}

export function PrintInvoiceClient({ data, labels }: PrintInvoiceClientProps) {
  const { journal, bankAccounts } = data;

  // Trigger print immediately on mount
  useEffect(() => {
    // Slight delay to ensure fonts and images load
    const timer = setTimeout(() => {
      window.print();
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  // Determine if this is an invoice (AR) or a receipt
  const isInvoice = journal.lines.some((l: any) => l.dueDate !== null);
  const documentTitle = isInvoice ? labels.invoice : labels.receipt;
  
  // Find main partner (the one with the largest debit/credit)
  const mainPartnerLine = [...journal.lines]
    .filter((l: any) => l.partnerName)
    .sort((a, b) => {
      const aAmt = BigInt(a.debit) > 0n ? BigInt(a.debit) : BigInt(a.credit);
      const bAmt = BigInt(b.debit) > 0n ? BigInt(b.debit) : BigInt(b.credit);
      return aAmt > bAmt ? -1 : 1;
    })[0];

  const primaryDueDate = journal.lines.find((l: any) => l.dueDate)?.dueDate;

  // Calculate total amount for terbilang
  const totalDebitNum = Number.parseInt(journal.totalDebit, 10);
  const terbilang = amountToWords(totalDebitNum);

  return (
    <div className="min-h-screen bg-brand-cream font-sans text-brand-ink selection:bg-brand-red/20 print:bg-white print:p-0">
      <div className="mx-auto max-w-4xl bg-white p-8 shadow-sm print:max-w-none print:shadow-none sm:p-12">
        {/* Header Section */}
        <div className="flex items-start justify-between border-b border-brand-cream-2 pb-8">
          <div className="flex flex-col">
            <div className="relative mb-2 h-12 w-32">
              {/* Use monochrome logo for printing if preferred, but primary logo looks premium. 
                  We use priority to ensure it loads before window.print. */}
              <Image 
                src="/logo-primary.png" 
                alt="Aroadri Tea" 
                fill 
                priority
                className="object-contain object-left" 
              />
            </div>
            <div className="mt-2 text-sm text-brand-ink-2 space-y-0.5">
              <p className="font-semibold text-brand-ink">PT. Gandha Hill Catering Management Indonesia</p>
              <p>Aroadri Tea — {journal.locationLabel}</p>
              <p className="text-xs">{labels.companyAddress}</p>
              <p className="text-xs">{labels.companyNpwp}</p>
              <p className="text-xs">{labels.companyPhone}</p>
            </div>
          </div>
          
          <div className="text-right">
            <h1 className="text-3xl font-light tracking-wide text-brand-ink">{documentTitle}</h1>
            <p className="mt-2 font-mono text-sm text-brand-ink-2">{journal.number}</p>
          </div>
        </div>

        {/* Info Grid */}
        <div className="mt-8 flex justify-between">
          <div className="w-1/2">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-brand-ink-3">
              {labels.billTo}
            </h3>
            <p className="text-base font-medium text-brand-ink">
              {mainPartnerLine?.partnerName ?? '-'}
            </p>
            {journal.description && (
              <p className="mt-4 text-sm text-brand-ink-2 max-w-xs">{journal.description}</p>
            )}
          </div>
          
          <div className="w-1/3 text-right">
            <div className="mb-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-brand-ink-3">
                {labels.date}
              </h3>
              <p className="font-mono text-sm text-brand-ink">{journal.postingDate}</p>
            </div>
            {primaryDueDate && (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-brand-ink-3">
                  {labels.dueDate}
                </h3>
                <p className="font-mono text-sm text-brand-ink">{primaryDueDate}</p>
              </div>
            )}
          </div>
        </div>

        {/* Lines Table */}
        <div className="mt-12">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-brand-cream-3">
                <th className="pb-3 text-left font-semibold text-brand-ink-3 uppercase tracking-wider text-xs">{labels.description}</th>
                <th className="pb-3 text-right font-semibold text-brand-ink-3 uppercase tracking-wider text-xs">{labels.debit}</th>
                <th className="pb-3 text-right font-semibold text-brand-ink-3 uppercase tracking-wider text-xs">{labels.credit}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-cream-2">
              {journal.lines.map((line: any) => {
                const debit = BigInt(line.debit);
                const credit = BigInt(line.credit);
                
                return (
                  <tr key={line.id} className="group">
                    <td className="py-4">
                      <div className="font-medium text-brand-ink">
                        {line.accountName.id ?? line.accountName.en}
                      </div>
                      {line.description && (
                        <div className="mt-1 text-xs text-brand-ink-2">{line.description}</div>
                      )}
                    </td>
                    <td className="py-4 text-right font-mono text-brand-ink">
                      {debit > 0n ? formatRp(line.debit) : '-'}
                    </td>
                    <td className="py-4 text-right font-mono text-brand-ink">
                      {credit > 0n ? formatRp(line.credit) : '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-brand-ink">
                <td className="pt-4 text-right font-semibold text-brand-ink uppercase text-xs tracking-wider">
                  {labels.total}
                </td>
                <td className="pt-4 text-right font-mono font-semibold text-brand-ink">
                  {formatRp(journal.totalDebit)}
                </td>
                <td className="pt-4 text-right font-mono font-semibold text-brand-ink">
                  {formatRp(journal.totalCredit)}
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
            <p className="text-sm font-medium text-brand-ink italic">
              # {terbilang} #
            </p>
          </div>
        )}

        {/* Footer Section */}
        <div className="mt-16 grid grid-cols-2 gap-12 border-t border-brand-cream-2 pt-8">
          <div>
            {bankAccounts.length > 0 && (
              <>
                <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-brand-ink-3">
                  {labels.paymentTo}
                </h3>
                <div className="space-y-4">
                  {bankAccounts.map((bank: BankAccountDetail) => (
                    <div key={bank.id} className="text-sm">
                      <p className="font-semibold text-brand-ink">{bank.bankName}</p>
                      <p className="font-mono text-brand-ink-2">{bank.accountNumber}</p>
                      <p className="text-brand-ink-2">a/n {bank.accountHolder}</p>
                    </div>
                  ))}
                </div>
              </>
            )}
            
            {journal.description && (
              <div className="mt-8">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-brand-ink-3">
                  {labels.notes}
                </h3>
                <p className="text-sm text-brand-ink-2 whitespace-pre-wrap">{journal.description}</p>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-16 text-center">
            <div>
              <p className="mb-16 text-xs font-semibold uppercase tracking-wider text-brand-ink-3">
                {labels.preparedBy}
              </p>
              <div className="mx-auto w-32 border-b border-brand-ink-3"></div>
            </div>
            <div>
              <p className="mb-16 text-xs font-semibold uppercase tracking-wider text-brand-ink-3">
                {labels.authorizedBy}
              </p>
              <div className="mx-auto w-32 border-b border-brand-ink-3"></div>
            </div>
          </div>
        </div>

        {/* Print instruction banner (hidden on print) */}
        <div className="mt-12 text-center print:hidden">
          <p className="text-sm text-brand-ink-3">
            {labels.printHint}
          </p>
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

function formatRp(amountStr: string): string {
  const num = Number.parseInt(amountStr, 10);
  if (Number.isNaN(num)) return amountStr;
  return `Rp ${num.toLocaleString('id-ID')}`;
}
