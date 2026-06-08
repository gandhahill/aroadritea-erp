/**
 * New Purchase Return form — T-0180.
 *
 * The user picks a confirmed GRN from a dropdown → the form loads the GRN
 * lines and lets them select qty per line + reason, then submits.
 */

import { PageHeader } from '@/components/page-header';
import { getSession } from '@/lib/auth';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { listConfirmedGrnsForReturn } from '../../actions';
import { NewReturnClient } from './new-return-client';

export const metadata: Metadata = { title: 'New Purchase Return' };

export default async function NewPurchaseReturnPage({
  searchParams,
}: {
  searchParams: Promise<{ grnId?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');
  const t = await getTranslations('purchasing.returns');
  const params = await searchParams;
  const user = session.user as Record<string, unknown>;
  const grns = await listConfirmedGrnsForReturn();

  return (
    <div className="space-y-6">
      <PageHeader title={t('newReturn')} description={t('newReturnDesc')} />
      <NewReturnClient
        defaultGrnId={params.grnId ?? ''}
        defaultLocationId={String(user.locationId ?? '')}
        grns={grns}
      />
    </div>
  );
}
