import { getSession } from '@/lib/auth';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { fetchLocations, fetchReimbursements } from './actions';
import { ReimbursementClient } from './reimbursement-view';
import { getTranslations } from 'next-intl/server';

export const metadata: Metadata = {
  title: 'Reimbursement',
};

export default async function ReimbursementPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const userId = ((session.user as Record<string, unknown>)?.id as string) ?? '';
  const tenantId = ((session.user as Record<string, unknown>)?.tenantId as string) ?? 'default';

  const [items, locations] = await Promise.all([
    fetchReimbursements(tenantId),
    fetchLocations(tenantId),
  ]);

  const t = await getTranslations('accounting.reimbursement');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-ink">{t('title')}</h1>
        <p className="mt-1 text-sm text-brand-ink-3">
          {t('subtitle')}
        </p>
      </div>

      <ReimbursementClient
        initialItems={items}
        locations={locations}
        tenantId={tenantId}
        userId={userId}
      />
    </div>
  );
}
