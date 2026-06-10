import { PageHeader } from '@/components/page-header';
import { getSession } from '@/lib/auth';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { fetchAssetPageData } from './actions';
import { AssetsClient } from './assets-client';

export const metadata: Metadata = {
  title: 'Fixed Assets',
};

export default async function FixedAssetsPage({
  searchParams,
}: {
  searchParams: Promise<{ locationId?: string; status?: string; page?: string; pageSize?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');

  const params = await searchParams;
  const status = ['active', 'fully_depreciated', 'disposed'].includes(params.status ?? '')
    ? (params.status as 'active' | 'fully_depreciated' | 'disposed')
    : undefined;
  const page = Math.max(1, Number(params.page) || 1);
  const pageSize = [10, 20, 50, 100].includes(Number(params.pageSize))
    ? Number(params.pageSize)
    : 20;
  const [data, t] = await Promise.all([
    fetchAssetPageData({
      locationId: params.locationId,
      status,
      limit: pageSize,
      offset: (page - 1) * pageSize,
    }),
    getTranslations('accounting.assets'),
  ]);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <PageHeader title={<>{t('title')}</>} description={<>{t('description')}</>} />
      <AssetsClient
        {...data}
        initialLocationId={params.locationId ?? ''}
        initialStatus={params.status ?? ''}
        today={today}
        page={page}
        pageSize={pageSize}
      />
    </div>
  );
}
