import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { fetchJournalFormData } from '../actions';
import { JournalForm } from './journal-form';
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = {
  title: 'New Journal - Aroadri ERP',
};

export default async function NewJournalPage() {
  const [data, t] = await Promise.all([
    fetchJournalFormData(),
    getTranslations('accounting.journal.new'),
  ]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader 
            title={<>{t('title')}</>}
            description={<>{t('subtitle')}</>}
          />

      {data.accounts.length === 0 || data.locations.length === 0 ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {t('missingMasterData')}
        </div>
      ) : null}

      <JournalForm accounts={data.accounts} locations={data.locations} partners={data.partners} />
    </div>
  );
}
