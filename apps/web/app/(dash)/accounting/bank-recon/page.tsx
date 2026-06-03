import { PageHeader } from '@/components/page-header';
import { Pagination } from '@/components/pagination';
import { getSession } from '@/lib/auth';
import { authorizedLocationIdsForTenant } from '@/lib/authz';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { fetchStatements } from './actions';
import { BankReconListClient } from './list-client';

export const metadata: Metadata = {
  title: 'Bank Reconciliation',
};

export default async function BankReconPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; pageSize?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');
  const user = session.user as Record<string, unknown>;
  const scope = await authorizedLocationIdsForTenant(
    String(user.id ?? ''),
    'accounting.bank_recon.view',
    String(user.tenantId ?? 'default'),
  );
  if (!scope.global && scope.locationIds.length === 0) redirect('/dashboard');

  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const pageSize = [10, 20, 50, 100].includes(Number(params.pageSize)) ? Number(params.pageSize) : 20;

  const [{ items: statements, total }, t] = await Promise.all([
    fetchStatements({ limit: pageSize, offset: (page - 1) * pageSize }),
    getTranslations('accounting.bankRecon'),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={<>{t('title')}</>}
        description={<>{t('subtitle')}</>}
        actions={
          <>
            <Link
              href="/accounting/bank-recon/import"
              className="rounded-md bg-brand-red px-4 py-2 text-sm font-semibold text-white hover:bg-brand-red-dark"
            >
              {t('importBtn')}
            </Link>
          </>
        }
      />

      <BankReconListClient
        statements={statements.map((s) => ({
          ...s,
          openingBalance: s.openingBalance.toString(),
          closingBalance: s.closingBalance.toString(),
          createdAt: s.createdAt.toISOString(),
          status: s.status as 'draft' | 'in_progress' | 'reconciled',
        }))}
        labels={{
          bankAccount: t('bankAccount'),
          statementDate: t('statementDate'),
          status: {
            draft: t('status.draft'),
            inProgress: t('status.inProgress'),
            reconciled: t('status.reconciled'),
          },
          openingBalance: t('openingBalance'),
          closingBalance: t('closingBalance'),
          statusCol: t('statusCol'),
          empty: t('empty'),
        }}
      />

      {total > 0 && <Pagination currentPage={page} totalItems={total} pageSize={pageSize} />}
    </div>
  );
}
