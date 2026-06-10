import { PageHeader } from '@/components/page-header';
import { Pagination } from '@/components/pagination';
import { getSession } from '@/lib/auth';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { fetchLocations, fetchReimbursements } from './actions';
import { ReimbursementClient } from './reimbursement-view';

export const metadata: Metadata = {
  title: 'Reimbursement',
};

export default async function ReimbursementPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string; pageSize?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');

  const userId = ((session.user as Record<string, unknown>)?.id as string) ?? '';
  const tenantId = ((session.user as Record<string, unknown>)?.tenantId as string) ?? 'default';

  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const pageSize = [10, 20, 50, 100].includes(Number(params.pageSize))
    ? Number(params.pageSize)
    : 20;

  const [{ items, total }, locations] = await Promise.all([
    fetchReimbursements(tenantId, params.status, {
      limit: pageSize,
      offset: (page - 1) * pageSize,
    }),
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

      {total > 0 && <Pagination currentPage={page} totalItems={total} pageSize={pageSize} />}
    </div>
  );
}
