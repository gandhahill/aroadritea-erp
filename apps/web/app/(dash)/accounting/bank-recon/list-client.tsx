'use client';

import { formatRupiah } from '@erp/shared/money';
import Link from 'next/link';

interface Statement {
  id: string;
  date: string;
  bankName: string;
  accountNumber: string;
  status: 'draft' | 'in_progress' | 'reconciled';
  openingBalance: number;
  closingBalance: number;
  createdAt: string;
}

interface Props {
  statements: Statement[];
  labels: {
    bankAccount: string;
    statementDate: string;
    status: {
      draft: string;
      inProgress: string;
      reconciled: string;
    };
    openingBalance: string;
    closingBalance: string;
    statusCol: string;
    empty: string;
  };
}

export function BankReconListClient({ statements, labels }: Props) {
  if (statements.length === 0) {
    return (
      <div className="rounded-lg border border-brand-cream-3 bg-card p-12 text-center text-brand-ink-3">
        {labels.empty}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-brand-cream-3 bg-card">
      <table className="w-full text-left text-sm">
        <thead className="bg-brand-cream-2 text-xs uppercase tracking-widest text-brand-ink-3">
          <tr>
            <th className="px-4 py-3">{labels.statementDate}</th>
            <th className="px-4 py-3">{labels.bankAccount}</th>
            <th className="px-4 py-3 text-right">{labels.openingBalance}</th>
            <th className="px-4 py-3 text-right">{labels.closingBalance}</th>
            <th className="px-4 py-3 text-center">{labels.statusCol}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-brand-cream-3">
          {statements.map((s) => (
            <tr key={s.id} className="hover:bg-brand-cream-1/50 transition-colors">
              <td className="px-4 py-3 font-medium text-brand-ink">
                <Link
                  href={`/accounting/bank-recon/${s.id}`}
                  className="hover:text-brand-red hover:underline"
                >
                  {s.date}
                </Link>
              </td>
              <td className="px-4 py-3">
                {s.bankName} - {s.accountNumber}
              </td>
              <td className="px-4 py-3 text-right tabular-nums">
                {formatRupiah(BigInt(s.openingBalance))}
              </td>
              <td className="px-4 py-3 text-right tabular-nums">
                {formatRupiah(BigInt(s.closingBalance))}
              </td>
              <td className="px-4 py-3 text-center">
                <span
                  className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    s.status === 'reconciled'
                      ? 'bg-brand-jade/10 text-brand-jade'
                      : s.status === 'in_progress'
                        ? 'bg-brand-sand/20 text-brand-brown'
                        : 'bg-brand-cream-3 text-brand-ink-3'
                  }`}
                >
                  {s.status === 'in_progress'
                    ? labels.status.inProgress
                    : s.status === 'reconciled'
                      ? labels.status.reconciled
                      : labels.status.draft}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
