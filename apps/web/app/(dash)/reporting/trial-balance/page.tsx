/**
 * Trial Balance Page — SD §21.2
 */

import { getSession } from '@/lib/auth';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { fetchTrialBalance } from '../actions';
import { ExportXlsxButton } from '../export-button';

export const metadata: Metadata = {
  title: 'Trial Balance',
};

export default async function TrialBalancePage({
  searchParams,
}: {
  searchParams: Promise<{ asOf?: string; locationId?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');

  const params = await searchParams;
  const tenantId = ((session.user as Record<string, unknown>)?.tenantId as string) ?? 'default';
  const asOf = params.asOf ?? new Date().toISOString().slice(0, 10);
  const data = await fetchTrialBalance(tenantId, asOf, params.locationId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brand-ink">Trial Balance</h1>
          <p className="mt-1 text-sm text-brand-ink-3">
            Neraca Saldo as of <span className="font-medium text-brand-ink">{asOf}</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          {data?.isPreliminary && (
            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
              ⚠ Preliminary
            </span>
          )}
          {data ? (
            <ExportXlsxButton
              filename={`trial-balance-${asOf}.xlsx`}
              sheets={[
                {
                  name: 'Trial Balance',
                  rows: [
                    ['Code', 'Account', 'Type', 'Total Debit', 'Total Credit', 'Balance'],
                    ...data.lines.map((l) => [
                      l.accountCode,
                      l.accountName.id ?? l.accountName.en ?? '',
                      l.accountType,
                      Number(l.totalDebit),
                      Number(l.totalCredit),
                      Number(l.balance),
                    ]),
                    ['', 'TOTAL', '', Number(data.totalDebit), Number(data.totalCredit), ''],
                  ],
                },
              ]}
            />
          ) : null}
        </div>
      </div>

      {data ? (
        <div className="surface-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-brand-cream-2 bg-brand-cream/50">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-brand-ink-3">
                  Code
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-brand-ink-3">
                  Account
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-brand-ink-3">
                  Type
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-brand-ink-3">
                  Debit
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-brand-ink-3">
                  Credit
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-brand-ink-3">
                  Balance
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-cream-2">
              {data.lines.map((line) => (
                <tr key={line.accountId} className="hover:bg-brand-cream/50 transition-colors">
                  <td className="px-4 py-2.5 font-mono text-xs text-brand-ink-3 tabular-nums">
                    {line.accountCode}
                  </td>
                  <td className="px-4 py-2.5 text-brand-ink">
                    {line.accountName.id ?? line.accountName.en}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="text-xs text-brand-ink-3 capitalize">{line.accountType}</span>
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums text-brand-jade">
                    {fmtRp(line.totalDebit)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums text-brand-clay">
                    {fmtRp(line.totalCredit)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums font-medium text-brand-ink">
                    {fmtRp(line.balance)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-brand-cream-3 bg-brand-cream/30 font-semibold">
                <td className="px-4 py-3 text-brand-ink" colSpan={3}>
                  Total
                </td>
                <td className="px-4 py-3 text-right font-mono tabular-nums text-brand-jade">
                  {fmtRp(data.totalDebit)}
                </td>
                <td className="px-4 py-3 text-right font-mono tabular-nums text-brand-clay">
                  {fmtRp(data.totalCredit)}
                </td>
                <td className="px-4 py-3"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <EmptyState message="No data available for this date." />
      )}
    </div>
  );
}

function fmtRp(val: string): string {
  const n = Number.parseInt(val, 10);
  if (isNaN(n) || n === 0) return '—';
  return 'Rp ' + n.toLocaleString('id-ID');
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="surface-card flex flex-col items-center justify-center py-16 text-brand-ink-3">
      <svg
        className="mb-3 h-12 w-12 opacity-40"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75Z"
        />
      </svg>
      <p className="text-sm font-medium">{message}</p>
    </div>
  );
}
