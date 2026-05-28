import { getTranslations } from 'next-intl/server';
import { fetchOutgoingShipments } from './actions';
import { ShipmentsClient } from './client';
import { PageHeader } from '@/components/page-header';

export const metadata = {
  title: 'Outgoing Shipments | Aroadri ERP',
};

export default async function OutgoingShipmentsPage() {
  const t = await getTranslations('logistics');
  const shipments = await fetchOutgoingShipments();

  return (
    <div className="space-y-6">
      <PageHeader
        title={<>{t('outgoingShipments')}</>}
        description={<>{t('outgoingShipmentsSubtitle')}</>}
      />
      <ShipmentsClient shipments={shipments} />
    </div>
  );
}
