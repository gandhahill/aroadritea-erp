import { PageHeader } from '@/components/page-header';
import { getTranslations } from 'next-intl/server';
import { fetchDefaultKitchenLocationId, fetchKdsBoard, fetchKitchenLocations } from './actions';
import { KitchenBoardClient } from './client';

export const metadata = {
  title: 'Kitchen Display',
};

export default async function KitchenPage() {
  const t = await getTranslations('kitchen');
  const locations = await fetchKitchenLocations();
  const defaultLocationId = await fetchDefaultKitchenLocationId();
  const board = defaultLocationId ? await fetchKdsBoard(defaultLocationId) : null;

  return (
    <div className="space-y-6">
      <PageHeader title={<>{t('title')}</>} description={<>{t('subtitle')}</>} />
      <KitchenBoardClient
        locations={locations}
        initialLocationId={defaultLocationId}
        initialBoard={board}
      />
    </div>
  );
}
