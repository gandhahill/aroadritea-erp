import { PageHeader } from '@/components/page-header';
import { getSession } from '@/lib/auth';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { fetchBankAccounts, fetchCoaAccounts } from './actions';
import { BankAccountsClient } from './bank-accounts-client';

export const metadata: Metadata = {
  title: 'Bank Accounts | Aroadri ERP',
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
      <PageHeader title={<>{t('title')}</>} description={<>{t('subtitle')}</>} />

      <BankAccountsClient
        accounts={accounts}
        coaAccounts={coaAccounts}
        labels={{
          add: t('add'),
          edit: t('edit'),
          bankName: t('bankName'),
          bankNamePlaceholder: t('bankNamePlaceholder'),
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
          active: common('status.active'),
          inactive: common('status.inactive'),
        }}
      />
    </div>
  );
}
