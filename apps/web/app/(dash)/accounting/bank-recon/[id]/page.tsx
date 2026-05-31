import { PageHeader } from '@/components/page-header';
import { getSession } from '@/lib/auth';
import { authorizedLocationIdsForTenant } from '@/lib/authz';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { notFound, redirect } from 'next/navigation';
import { fetchStatementDetails } from '../actions';
import { DetailClient } from './detail-client';

export const metadata: Metadata = {
  title: 'Bank Reconciliation Detail',
};

export default async function BankReconDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect('/login');
  const user = session.user as Record<string, unknown>;
  const scope = await authorizedLocationIdsForTenant(
    String(user.id ?? ''),
    'accounting.bank_recon.view',
    String(user.tenantId ?? 'default'),
  );
  if (!scope.global && scope.locationIds.length === 0) redirect('/dashboard');

  const resolvedParams = await params;
  const data = await fetchStatementDetails(resolvedParams.id);
  if (!data) notFound();

  const [t] = await Promise.all([getTranslations('accounting.bankRecon')]);

  return (
    <div className="space-y-6 max-w-7xl">
      <PageHeader
        title={
          <>
            {data.statement.bankName}- {data.statement.accountNumber}({data.statement.date})
          </>
        }
        description={
          <>
            Status:{' '}
            {t(
              `status.${data.statement.status === 'in_progress' ? 'inProgress' : data.statement.status}` as any,
            )}
          </>
        }
      />

      <DetailClient
        statement={{
          ...data.statement,
          openingBalance: data.statement.openingBalance.toString(),
          closingBalance: data.statement.closingBalance.toString(),
        }}
        lines={data.lines.map((l: any) => ({
          ...l,
          debit: l.debit.toString(),
          credit: l.credit.toString(),
          balance: l.balance.toString(),
          isMatched: l.matchStatus === 'matched',
          matchedJournalId: l.matchedJournalEntryId,
        }))}
        labels={{
          back: t('back'),
          finalize: t('finalize'),
          finalizing: t('finalizing'),
          finalized: t('finalized'),
          delete: t('delete'),
          deleteConfirm: t('deleteConfirm'),
          deleteSuccess: t('deleteSuccess'),
          deleteFailed: t('deleteFailed'),
          match: t('match'),
          unmatch: t('unmatch'),
          matched: t('matched'),
          unmatched: t('unmatched'),
          created: t('created'),
          createJournal: t('createJournal'),
          suggestMatches: t('suggestMatches'),
          suggesting: t('suggesting'),
          suggested: t('suggested'),
          noSuggestions: t('noSuggestions'),
          detail: {
            matchedCount: t('detail.matchedCount'),
            allMatched: t('detail.allMatched'),
            unmatchedWarning: t('detail.unmatchedWarning'),
            selectJournal: t('detail.selectJournal'),
            noJournalSuggestion: t('detail.noJournalSuggestion'),
            matchSuccess: t('detail.matchSuccess'),
            unmatchSuccess: t('detail.unmatchSuccess'),
            journalCreated: t('detail.journalCreated'),
            cancel: t('detail.cancel'),
            ref: t('detail.ref'),
          },
          columns: {
            date: t('columns.date'),
            description: t('columns.description'),
            debit: t('columns.debit'),
            credit: t('columns.credit'),
            balance: t('columns.balance'),
            matchStatus: t('columns.matchStatus'),
            journal: t('columns.journal'),
            actions: t('columns.actions'),
          },
          summary: {
            matched: t('summary.matched'),
            unmatched: t('summary.unmatched'),
            total: t('summary.total'),
          },
        }}
      />
    </div>
  );
}
