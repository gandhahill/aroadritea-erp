import { PageHeader } from '@/components/page-header';
import { getSession } from '@/lib/auth';
import { authorizedLocationIdsForTenant } from '@/lib/authz';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import {
  fetchEmptyPettyCashLocations,
  fetchPettyCashAccounts,
  fetchPettyCashTransactions,
} from './actions';
import { PettyCashView } from './petty-cash-view';

export const metadata: Metadata = {
  title: 'Petty Cash | Aroadri ERP',
};

export default async function PettyCashPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const user = session.user as Record<string, unknown>;
  const tenantId = String(user.tenantId ?? 'default');
  const scope = await authorizedLocationIdsForTenant(
    String(user.id ?? ''),
    'accounting.petty_cash.view',
    tenantId,
  );
  if (!scope.global && scope.locationIds.length === 0) redirect('/dashboard');
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
      <PageHeader title={<>{t('title')}</>} description={<>{t('subtitle')}</>} />

      <PettyCashView
        accounts={accounts}
        transactions={transactions}
        emptyLocations={emptyLocations}
      />
    </div>
  );
}
