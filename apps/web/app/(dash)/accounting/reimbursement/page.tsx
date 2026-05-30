import { PageHeader } from '@/components/page-header';
import { getSession } from '@/lib/auth';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { fetchLocations, fetchReimbursements } from './actions';
import { ReimbursementClient } from './reimbursement-view';

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
      <PageHeader title={<>{t('title')}</>} description={<>{t('subtitle')}</>} />

      <ReimbursementClient
        initialItems={items}
        locations={locations}
        tenantId={tenantId}
        userId={userId}
      />
    </div>
  );
}
