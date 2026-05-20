import { getSession } from '@/lib/auth';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { fetchAssetPageData } from './actions';
import { AssetsClient } from './assets-client';

export const metadata: Metadata = {
  title: 'Aset Tetap',
};

export default async function FixedAssetsPage({
  searchParams,
}: {
  searchParams: Promise<{ locationId?: string; status?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');

  const params = await searchParams;
  const status = ['active', 'fully_depreciated', 'disposed'].includes(params.status ?? '')
    ? (params.status as 'active' | 'fully_depreciated' | 'disposed')
    : undefined;
  const [data, t] = await Promise.all([
    fetchAssetPageData({ locationId: params.locationId, status }),
    getTranslations('accounting.assets'),
  ]);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-ink">{t('title')}</h1>
        <p className="mt-1 text-sm text-brand-ink-3">{t('description')}</p>
      </div>
      <AssetsClient
        {...data}
        initialLocationId={params.locationId ?? ''}
        initialStatus={params.status ?? ''}
        today={today}
      />
    </div>
  );
}
