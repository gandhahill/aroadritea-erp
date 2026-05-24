import { getSession } from '@/lib/auth';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import {
  fetchEmptyPettyCashLocations,
  fetchPettyCashAccounts,
  fetchPettyCashTransactions,
} from './actions';
import { PettyCashView } from './petty-cash-view';
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = {
  title: 'Kas Kecil',
};

export default async function PettyCashPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const tenantId = ((session.user as Record<string, unknown>)?.tenantId as string) ?? 'default';
  const [accounts, emptyLocations] = await Promise.all([
    fetchPettyCashAccounts(tenantId),
    fetchEmptyPettyCashLocations(tenantId),
  ]);

  const transactions: Record<string, Awaited<ReturnType<typeof fetchPettyCashTransactions>>> = {};
  for (const acct of accounts) {
    transactions[acct.id] = await fetchPettyCashTransactions(acct.id);
  }

  const t = await getTranslations('accounting.pettyCash');

  return (
    <div className="space-y-6">
      <PageHeader 
            title={<>{t('title')}</>}
            description={<>{t('subtitle')}</>}
          />

      <PettyCashView
        accounts={accounts}
        transactions={transactions}
        emptyLocations={emptyLocations}
      />
    </div>
  );
}
