/**
 * Journal Entries List Page — SD §21.1
 * Shows all journal entries in a table with status badges and filters.
 */

import type { Metadata } from 'next';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { fetchJournalList } from './actions';
import { JournalTable } from './journal-table';

export const metadata: Metadata = {
  title: 'Journal Entries',
};

export default async function JournalsPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const tenantId = (session.user as Record<string, unknown>)?.tenantId as string ?? 'default';
  const journals = await fetchJournalList(tenantId);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brand-ink">Journal Entries</h1>
          <p className="mt-1 text-sm text-brand-ink-3">
            View and manage your general journal entries.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-jade-light px-3 py-1 text-xs font-medium text-brand-jade">
            {journals.length} entries
          </span>
        </div>
      </div>

      {/* Table */}
      <JournalTable journals={journals} />
    </div>
  );
}
