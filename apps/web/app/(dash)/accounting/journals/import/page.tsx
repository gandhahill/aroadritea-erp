import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { fetchJournalFormData } from '../actions';
import { ImportJournalForm } from './import-journal-form';

export const metadata: Metadata = {
  title: 'Import Journal CSV - Aroadri ERP',
};

export default async function ImportJournalPage() {
  const [data, t, tj] = await Promise.all([
    fetchJournalFormData(),
    getTranslations('accounting.journal.import'),
    getTranslations('accounting.journal'),
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <Link
            href="/accounting/journals"
            className="text-sm font-medium text-brand-ink-3 transition-colors hover:text-brand-ink"
          >
            {t('back')}
          </Link>
          <h1 className="mt-3 text-2xl font-bold text-brand-ink">{t('title')}</h1>
          <p className="mt-1 max-w-2xl text-sm text-brand-ink-3">{t('subtitle')}</p>
        </div>
        <Link
          href="/accounting/journals/import/template"
          className="inline-flex items-center justify-center rounded-lg border border-brand-cream-3 bg-card px-4 py-2 text-sm font-semibold text-brand-ink transition-colors hover:bg-brand-cream-1"
        >
          {tj('downloadTemplate')}
        </Link>
      </div>

      {data.accounts.length === 0 || data.locations.length === 0 ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {t('missingMasterData')}
        </div>
      ) : (
        <ImportJournalForm />
      )}
    </div>
  );
}
