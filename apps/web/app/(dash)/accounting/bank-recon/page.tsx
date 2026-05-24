import { getSession } from '@/lib/auth';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { fetchStatements } from './actions';
import { BankReconListClient } from './list-client';
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = {
  title: 'Bank Reconciliation',
};

export default async function BankReconPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const [statements, t] = await Promise.all([
    fetchStatements(),
    getTranslations('accounting.bankRecon'),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader 
            title={<>{t('title')}</>}
            description={<>{t('subtitle')}</>}
            actions={<>
          <Link
                    href="/accounting/bank-recon/import"
                    className="rounded-md bg-brand-red px-4 py-2 text-sm font-semibold text-white hover:bg-brand-red-dark"
                  >
                    {t('importBtn')}
                  </Link>
            </>}
          />

      <BankReconListClient
        statements={statements.map((s) => ({
          ...s,
          openingBalance: Number(s.openingBalance),
          closingBalance: Number(s.closingBalance),
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
    </div>
  );
}
