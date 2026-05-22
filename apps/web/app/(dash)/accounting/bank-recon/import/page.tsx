import { getSession } from '@/lib/auth';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { fetchImportMasterData } from '../actions';
import { ImportClient } from './import-client';

export const metadata: Metadata = {
  title: 'Import Bank Statement - Settings',
};

export default async function ImportBankReconPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const [masterData, t, tRecon] = await Promise.all([
    fetchImportMasterData(),
    getTranslations('accounting.bankRecon.import'),
    getTranslations('accounting.bankRecon'),
  ]);

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-brand-ink">{t('title')}</h1>
        <p className="mt-1 max-w-3xl text-sm text-brand-ink-3">{t('subtitle')}</p>
      </div>

      <ImportClient
        bankAccounts={masterData.bankAccounts}
        locations={masterData.locations}
        labels={{
          back: t('back'),
          file: t('file'),
          location: t('location'),
          selectLocation: t('selectLocation'),
          submit: t('submit'),
          submitting: t('submitting'),
          success: t('success'),
          failed: t('failed'),
          missingMasterData: t('missingMasterData'),
          templateHint: t('templateHint'),
          downloadTemplate: t('downloadTemplate'),
          pdfHint: t('pdfHint'),
          orManual: t('orManual'),
          manualTitle: t('manualTitle'),
          manualSubtitle: t('manualSubtitle'),
          addLine: t('addLine'),
          removeLine: t('removeLine'),
          transactionDate: t('transactionDate'),
          description: t('description'),
          debitAmount: t('debitAmount'),
          creditAmount: t('creditAmount'),
          runningBalance: t('runningBalance'),
          noLines: t('noLines'),
        }}
        commonLabels={{
          bankAccount: tRecon('bankAccount'),
        }}
      />
    </div>
  );
}
