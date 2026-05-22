/**
 * Journal Entries List Page — SD §21.1
 * Shows all journal entries in a table with status badges and filters.
 */

import { getSession } from '@/lib/auth';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { fetchJournalList } from './actions';
import { JournalTable } from './journal-table';

import { Pagination } from '@/components/pagination';
import { ExportJournalsButton } from './export-journals-button';

export const metadata: Metadata = {
  title: 'Journal Entries',
};

export default async function JournalsPage({
  searchParams,
}: {
  searchParams?: Promise<{ page?: string; pageSize?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');

  const params = await searchParams;
  const page = Number.parseInt(params?.page ?? '1', 10);
  const pageSize = Number.parseInt(params?.pageSize ?? '20', 10); // Default to 20 or read from action logic
  const [journals, t] = await Promise.all([
    fetchJournalList(Number.isFinite(page) ? page : 1, Number.isFinite(pageSize) ? pageSize : 20),
    getTranslations('accounting.journal'),
  ]);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brand-ink">{t('title')}</h1>
          <p className="mt-1 text-sm text-brand-ink-3">{t('subtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-jade-light px-3 py-1 text-xs font-medium text-brand-jade">
            {t('entryCount', { count: journals.total })}
          </span>
          <Link
            href="/accounting/journals/import/template"
            className="rounded-lg border border-brand-cream-3 bg-card px-4 py-2 text-sm font-semibold text-brand-ink transition-colors hover:bg-brand-cream-1"
          >
            {t('downloadTemplate')}
          </Link>
          <Link
            href="/accounting/journals/import"
            className="rounded-lg border border-brand-cream-3 bg-card px-4 py-2 text-sm font-semibold text-brand-ink transition-colors hover:bg-brand-cream-1"
          >
            {t('importCsv')}
          </Link>
          <ExportJournalsButton />
          <Link
            href="/accounting/journals/new"
            className="rounded-lg bg-brand-red px-4 py-2 text-sm font-semibold text-white shadow-soft transition-colors hover:bg-brand-red-dark"
          >
            {t('create')}
          </Link>
        </div>
      </div>

      {/* Table */}
      <JournalTable journals={journals.items} />

      <Pagination
        currentPage={journals.page}
        totalItems={journals.total}
        pageSize={journals.pageSize}
      />
    </div>
  );
}
