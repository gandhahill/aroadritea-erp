/**
 * New Purchase Return form — T-0180.
 *
 * Simple flow: user picks a confirmed GRN (by ID/number) → form
 * loads the GRN lines and lets the user select qty per line +
 * reason. On submit we POST to the createPurchaseReturnAction.
 *
 * Loading the GRN by typing its ID is intentional — picking a GRN
 * dropdown would need its own server action and adds complexity for
 * a screen that's rarely opened. The detail page link from the GRN
 * itself (TODO) will deep-link here with `?grnId=...` in a follow-up.
 */

import { PageHeader } from '@/components/page-header';
import { getSession } from '@/lib/auth';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
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

  return (
    <main className="space-y-6 p-6">
      <PageHeader title={t('newReturn')} description={t('newReturnDesc')} />
      <NewReturnClient
        defaultGrnId={params.grnId ?? ''}
        defaultLocationId={String(user.locationId ?? '')}
      />
    </main>
  );
}
