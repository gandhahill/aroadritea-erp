import { getSession } from '@/lib/auth';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { fetchBankAccounts, fetchCoaAccounts } from './actions';
import { BankAccountsClient } from './bank-accounts-client';

export const metadata: Metadata = {
  title: 'Bank Accounts - Settings',
};

export default async function BankAccountsPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const [accounts, coaAccounts, t, common] = await Promise.all([
    fetchBankAccounts(),
    fetchCoaAccounts(),
    getTranslations('settings.bankAccounts'),
    getTranslations('common'),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-ink">{t('title')}</h1>
        <p className="mt-1 max-w-3xl text-sm text-brand-ink-3">{t('subtitle')}</p>
      </div>

      <BankAccountsClient
        accounts={accounts}
        coaAccounts={coaAccounts}
        labels={{
          add: t('add'),
          edit: t('edit'),
          bankName: t('bankName'),
          accountNumber: t('accountNumber'),
          accountHolder: t('accountHolder'),
          linkedCoa: t('linkedCoa'),
          selectCoa: t('selectCoa'),
          status: t('status'),
          save: t('save'),
          saving: t('saving'),
          empty: t('empty'),
          delete: t('delete'),
          deleteConfirm: t('deleteConfirm'),
          active: common('active'),
          inactive: common('inactive'),
        }}
      />
    </div>
  );
}
