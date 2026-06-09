'use client';

import type { PrintJournalData, BankAccountDetail, CompanyInfo } from '../../actions';
import { useEffect } from 'react';
import Image from 'next/image';

interface PrintJournalClientProps {
  data: PrintJournalData;
  labels: {
    journalEntry: string;
    date: string;
    location: string;
    description: string;
    account: string;
    debit: string;
    credit: string;
    total: string;
    notes: string;
    preparedBy: string;
    authorizedBy: string;
    printOrSavePdf: string;
    printHint: string;
    number: string;
    status: string;
    partner: string;
    dueDate: string;
  };
}

export function PrintInvoiceClient({ data, labels }: PrintJournalClientProps) {
  const { journal, companyInfo } = data;

  useEffect(() => {
    const timer = setTimeout(() => {
      window.print();
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  const statusLabel: Record<string, string> = {
    draft: 'Draft',
    posted: 'Posted',
    reversed: 'Reversed',
  };

  return (
    <div className="min-h-screen bg-brand-cream font-sans text-brand-ink selection:bg-brand-red/20 print:bg-card print:p-0">
      <div className="mx-auto max-w-4xl bg-card p-8 shadow-sm print:max-w-none print:shadow-none sm:p-12">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-brand-cream-2 pb-6">
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
              <p className="font-semibold text-brand-ink">{companyInfo.name}</p>
              <p>Aroadri Tea — {journal.locationLabel}</p>
              {companyInfo.address && <p className="text-xs">{companyInfo.address}</p>}
              {companyInfo.npwp && <p className="text-xs">NPWP: {companyInfo.npwp}</p>}
            </div>
          </div>

          <div className="text-right">
            <h1 className="text-2xl font-light tracking-wide text-brand-ink uppercase">
              {labels.journalEntry}
            </h1>
            <p className="mt-2 font-mono text-sm text-brand-ink-2">{journal.number}</p>
            <span
              className={`mt-2 inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                journal.status === 'posted'
                  ? 'bg-brand-jade/10 text-brand-jade'
                  : journal.status === 'reversed'
                    ? 'bg-rose-50 text-rose-600'
                    : 'bg-amber-50 text-amber-700'
              }`}
            >
              {statusLabel[journal.status] ?? journal.status}
            </span>
          </div>
        </div>

        {/* Info grid */}
        <div className="mt-6 grid grid-cols-3 gap-6 text-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-ink-3">
              {labels.date}
            </p>
            <p className="mt-1 font-mono text-brand-ink">{journal.postingDate}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-ink-3">
              {labels.location}
            </p>
            <p className="mt-1 text-brand-ink">{journal.locationLabel}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-ink-3">
              {labels.status}
            </p>
            <p className="mt-1 text-brand-ink">{statusLabel[journal.status] ?? journal.status}</p>
          </div>
        </div>

        {journal.description && (
          <div className="mt-4 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-ink-3">
              {labels.description}
            </p>
            <p className="mt-1 text-brand-ink">{journal.description}</p>
          </div>
        )}

        {/* Journal lines table */}
        <div className="mt-8">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-brand-cream-3">
                <th className="pb-3 text-left font-semibold text-brand-ink-3 uppercase tracking-wider text-xs">
                  {labels.account}
                </th>
                <th className="pb-3 text-left font-semibold text-brand-ink-3 uppercase tracking-wider text-xs">
                  {labels.description}
                </th>
                <th className="pb-3 text-left font-semibold text-brand-ink-3 uppercase tracking-wider text-xs">
                  {labels.partner}
                </th>
                <th className="pb-3 text-right font-semibold text-brand-ink-3 uppercase tracking-wider text-xs w-32">
                  {labels.debit}
                </th>
                <th className="pb-3 text-right font-semibold text-brand-ink-3 uppercase tracking-wider text-xs w-32">
                  {labels.credit}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-cream-2">
              {journal.lines.map((line) => {
                const debit = BigInt(line.debit);
                const credit = BigInt(line.credit);
                const accountName =
                  (line.accountName as Record<string, string>)?.id ??
                  (line.accountName as Record<string, string>)?.en ??
                  line.accountCode;

                return (
                  <tr key={line.id}>
                    <td className="py-3">
                      <span className="font-mono text-xs text-brand-ink-3">{line.accountCode}</span>
                      <span className="ml-2 text-brand-ink">{accountName}</span>
                    </td>
                    <td className="py-3 text-brand-ink-2 text-xs">
                      {line.description || '—'}
                    </td>
                    <td className="py-3 text-brand-ink-2 text-xs">
                      {line.partnerName || '—'}
                      {line.dueDate && (
                        <span className="block text-[10px] text-brand-ink-3">
                          {labels.dueDate}: {line.dueDate}
                        </span>
                      )}
                    </td>
                    <td className="py-3 text-right font-mono text-brand-ink">
                      {debit > 0n ? formatRp(line.debit) : ''}
                    </td>
                    <td className="py-3 text-right font-mono text-brand-ink">
                      {credit > 0n ? formatRp(line.credit) : ''}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-brand-ink">
                <td colSpan={3} className="pt-4 text-right font-semibold text-brand-ink uppercase text-xs tracking-wider">
                  {labels.total}
                </td>
                <td className="pt-4 text-right font-mono font-bold text-brand-ink">
                  {formatRp(journal.totalDebit)}
                </td>
                <td className="pt-4 text-right font-mono font-bold text-brand-ink">
                  {formatRp(journal.totalCredit)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Signature section */}
        <div className="mt-16 grid grid-cols-2 gap-16 border-t border-brand-cream-2 pt-8">
          <div className="text-center">
            <p className="mb-20 text-xs font-semibold uppercase tracking-wider text-brand-ink-3">
              {labels.preparedBy}
            </p>
            <div className="mx-auto w-36 border-b border-brand-ink-3" />
          </div>
          <div className="text-center">
            <p className="mb-20 text-xs font-semibold uppercase tracking-wider text-brand-ink-3">
              {labels.authorizedBy}
            </p>
            <div className="mx-auto w-36 border-b border-brand-ink-3" />
          </div>
        </div>

        {/* Print instruction (hidden on print) */}
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

function formatRp(amountStr: string): string {
  const num = Number.parseInt(amountStr, 10);
  if (Number.isNaN(num) || num === 0) return '—';
  return `Rp ${num.toLocaleString('id-ID')}`;
}
