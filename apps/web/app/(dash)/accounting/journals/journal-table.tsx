/**
 * Journal Table — client component.
 * Interactive table with status badges, search, and row links.
 */

'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { JournalListItem } from './actions';

// --- Status badge config ---
const STATUS_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  draft: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-400' },
  posted: { bg: 'bg-brand-jade-light', text: 'text-brand-jade', dot: 'bg-brand-jade' },
  reversed: { bg: 'bg-brand-clay-light', text: 'text-brand-clay', dot: 'bg-brand-clay' },
};

interface JournalTableProps {
  journals: JournalListItem[];
}

export function JournalTable({ journals }: JournalTableProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const filtered = useMemo(() => {
    return journals.filter((j) => {
      const matchesSearch =
        !searchQuery ||
        j.number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        j.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = !statusFilter || j.status === statusFilter;
      const matchesDate =
        (!dateFrom || j.postingDate >= dateFrom) &&
        (!dateTo || j.postingDate <= dateTo);
      return matchesSearch && matchesStatus && matchesDate;
    });
  }, [journals, searchQuery, statusFilter, dateFrom, dateTo]);

  // Stats
  const counts = useMemo(() => {
    const c = { draft: 0, posted: 0, reversed: 0 };
    for (const j of journals) {
      if (j.status in c) c[j.status as keyof typeof c]++;
    }
    return c;
  }, [journals]);

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="surface-card p-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <svg
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-ink-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 1 0 5.65 5.65a7.5 7.5 0 0 0 10.99 10.99z"
                />
              </svg>
              <input
                id="journal-search"
                type="text"
                aria-label="Search by number or description"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-md border border-brand-cream-3 bg-brand-cream py-2 pl-9 pr-4 text-sm text-brand-ink focus:border-brand-red focus:outline-none focus:ring-2 focus:ring-brand-red/20 transition-colors"
              />
            </div>

            {/* Date range */}
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="rounded-md border border-brand-cream-3 bg-brand-cream px-3 py-1.5 text-xs text-brand-ink focus:border-brand-red focus:outline-none focus:ring-2 focus:ring-brand-red/20"
                aria-label="From date"
              />
              <span className="text-xs text-brand-ink-3">—</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="rounded-md border border-brand-cream-3 bg-brand-cream px-3 py-1.5 text-xs text-brand-ink focus:border-brand-red focus:outline-none focus:ring-2 focus:ring-brand-red/20"
                aria-label="To date"
              />
              {(dateFrom || dateTo) && (
                <button
                  type="button"
                  onClick={() => { setDateFrom(''); setDateTo(''); }}
                  className="rounded-md border border-brand-cream-3 px-2 py-1.5 text-xs text-brand-ink-3 hover:bg-brand-cream-2"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* Status filters */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setStatusFilter(null)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-all ${
                !statusFilter
                  ? 'border-brand-red bg-brand-red/10 text-brand-red'
                  : 'border-brand-cream-3 text-brand-ink-3 hover:bg-brand-cream-2'
              }`}
            >
              All ({journals.length})
            </button>
            {(['draft', 'posted', 'reversed'] as const).map((status) => {
              const style = STATUS_STYLES[status];
              const isActive = statusFilter === status;
              return (
                <button
                  type="button"
                  key={status}
                  onClick={() => setStatusFilter(isActive ? null : status)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium capitalize transition-all ${
                    isActive
                      ? `${style?.bg ?? ''} ${style?.text ?? ''} border-current ring-2 ring-offset-1 ring-brand-red/30`
                      : 'border-brand-cream-3 text-brand-ink-3 hover:bg-brand-cream-2'
                  }`}
                >
                  {status} ({counts[status]})
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="surface-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-brand-cream-2 bg-brand-cream/50">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-brand-ink-3">
                Entry #
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-brand-ink-3">
                Date
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-brand-ink-3">
                Description
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-brand-ink-3">
                Type
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-brand-ink-3">
                Amount
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-brand-ink-3">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-cream-2">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center">
                  <div className="flex flex-col items-center text-brand-ink-3">
                    <svg
                      className="mb-3 h-10 w-10 opacity-40"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1}
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
                      />
                    </svg>
                    <p className="text-sm font-medium">No journal entries found</p>
                    <p className="mt-1 text-xs">Try adjusting your search or filter.</p>
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((journal) => {
                const style = STATUS_STYLES[journal.status] ?? STATUS_STYLES.draft;
                return (
                  <tr key={journal.id} className="group transition-colors hover:bg-brand-cream/50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/accounting/journals/${journal.id}`}
                        className="font-mono text-sm font-medium text-brand-red hover:underline"
                      >
                        {journal.number}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-brand-ink-2 tabular-nums">
                      {journal.postingDate}
                    </td>
                    <td className="px-4 py-3 text-brand-ink max-w-xs truncate">
                      {journal.description}
                    </td>
                    <td className="px-4 py-3">
                      {journal.referenceType && (
                        <span className="rounded-md bg-brand-cream-2 px-2 py-0.5 text-xs font-medium text-brand-ink-2 capitalize">
                          {journal.referenceType}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-brand-ink tabular-nums">
                      {formatAmount(journal.totalDebit)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${style?.bg ?? ''} ${style?.text ?? ''}`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${style?.dot ?? ''}`} />
                        {journal.status}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// --- Helpers ---

function formatAmount(amountStr: string): string {
  const num = Number.parseInt(amountStr, 10);
  if (Number.isNaN(num)) return amountStr;
  return `Rp ${num.toLocaleString('id-ID')}`;
}
