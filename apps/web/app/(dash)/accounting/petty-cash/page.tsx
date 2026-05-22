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
      <div>
        <h1 className="text-2xl font-bold text-brand-ink">{t('title')}</h1>
        <p className="mt-1 text-sm text-brand-ink-3">
          {t('subtitle')}
        </p>
      </div>

      <PettyCashView
        accounts={accounts}
        transactions={transactions}
        emptyLocations={emptyLocations}
      />
    </div>
  );
}
