/**
 * Journal Detail Page — SD §21.1
 * Shows journal entry header + lines table.
 */

import { PageHeader } from '@/components/page-header';
import { getSession } from '@/lib/auth';
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { fetchJournalDetail } from '../actions';
import { fetchJournalAttachments } from '../attachments/actions';
import { JournalAttachmentsList } from './attachments-list';

export const metadata: Metadata = {
  title: 'Journal Entry Detail',
};

export default async function JournalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');

  const { id } = await params;
  const journal = await fetchJournalDetail(id);

  if (!journal) notFound();

  const statusStyles: Record<string, { bg: string; text: string; dot: string }> = {
    draft: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-400' },
    posted: { bg: 'bg-brand-jade-light', text: 'text-brand-jade', dot: 'bg-brand-jade' },
    reversed: { bg: 'bg-brand-clay-light', text: 'text-brand-clay', dot: 'bg-brand-clay' },
  };
  const [attachments, attachmentsError] = await fetchJournalAttachments(id).then(
    (r) => [r.data ?? [], r.error ?? null] as [unknown[], string | null],
  );

  const style = statusStyles[journal.status] ?? statusStyles.draft;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-brand-ink-3">
        <a href="/accounting/journals" className="hover:text-brand-red transition-colors">
          Journal Entries
        </a>
        <svg
          className="h-3.5 w-3.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
        <span className="font-medium text-brand-ink">{journal.number}</span>
      </nav>

      {/* Header card */}
      <div className="surface-card p-6">
        <div className="flex items-start justify-between">
          <div>
            <PageHeader title={journal.number} />
            <p className="mt-2 text-sm text-brand-ink-2">{journal.description}</p>
          </div>
        </div>

        {/* Metadata grid */}
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <MetaItem label="Posting Date" value={journal.postingDate} />
          <MetaItem label="Reference Type" value={journal.referenceType ?? '-'} />
          <MetaItem label="Location" value={journal.locationLabel} />
          <MetaItem label="Version" value={`v${journal.version}`} />
        </div>
      </div>

      {/* Lines table */}
      <div className="surface-card overflow-hidden">
        <div className="border-b border-brand-cream-2 px-6 py-4">
          <h2 className="text-base font-semibold text-brand-ink">Journal Lines</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-brand-cream-2 bg-brand-cream/50">
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-brand-ink-3">
                Account
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-brand-ink-3">
                Description
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-brand-ink-3">
                Partner
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-brand-ink-3">
                Due Date
              </th>
              <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-brand-ink-3">
                Debit
              </th>
              <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-brand-ink-3">
                Credit
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-cream-2">
            {journal.lines.map((line) => (
              <tr key={line.id} className="hover:bg-brand-cream/50 transition-colors">
                <td className="px-6 py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-brand-ink-3 tabular-nums">
                      {line.accountCode}
                    </span>
                    <span className="text-brand-ink">
                      {line.accountName.id ?? line.accountName.en}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-3 text-brand-ink-2">{line.description ?? '-'}</td>
                <td className="px-6 py-3 text-brand-ink-2">{line.partnerName ?? '-'}</td>
                <td className="px-6 py-3 text-brand-ink-2">
                  {line.dueDate ? (
                    <span>
                      {line.dueDate}
                      {line.reminderDaysBefore !== null ? (
                        <span className="block text-xs text-brand-ink-3">
                          H-{line.reminderDaysBefore}
                        </span>
                      ) : null}
                    </span>
                  ) : (
                    '-'
                  )}
                </td>
                <td className="px-6 py-3 text-right font-mono tabular-nums">
                  {BigInt(line.debit) > 0n ? (
                    <span className="text-brand-jade font-medium">{formatRp(line.debit)}</span>
                  ) : (
                    <span className="text-brand-ink-3">-</span>
                  )}
                </td>
                <td className="px-6 py-3 text-right font-mono tabular-nums">
                  {BigInt(line.credit) > 0n ? (
                    <span className="text-brand-clay font-medium">{formatRp(line.credit)}</span>
                  ) : (
                    <span className="text-brand-ink-3">-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-brand-cream-3 bg-brand-cream/30 font-semibold">
              <td className="px-6 py-3 text-brand-ink" colSpan={4}>
                Total
              </td>
              <td className="px-6 py-3 text-right font-mono tabular-nums text-brand-jade">
                {formatRp(journal.totalDebit)}
              </td>
              <td className="px-6 py-3 text-right font-mono tabular-nums text-brand-clay">
                {formatRp(journal.totalCredit)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Attachments */}
      {!attachmentsError && (
        <div className="surface-card p-6">
          <JournalAttachmentsList
            journalEntryId={id}
            initialAttachments={
              attachments as Array<{
                id: string;
                fileName: string;
                fileSize: number;
                mimeType: string;
                uploadedBy: string | null;
                uploadedAt: string;
              }>
            }
          />
        </div>
      )}

      {/* Audit info */}
      <div className="flex items-center gap-6 text-xs text-brand-ink-3">
        <span>Created: {new Date(journal.createdAt).toLocaleString('id-ID')}</span>
        <span>Updated: {new Date(journal.updatedAt).toLocaleString('id-ID')}</span>
      </div>
    </div>
  );
}

// --- Helpers ---

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wider text-brand-ink-3">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-brand-ink capitalize">{value}</dd>
    </div>
  );
}

function formatRp(amountStr: string): string {
  const num = Number.parseInt(amountStr, 10);
  if (Number.isNaN(num)) return amountStr;
  return `Rp ${num.toLocaleString('id-ID')}`;
}
