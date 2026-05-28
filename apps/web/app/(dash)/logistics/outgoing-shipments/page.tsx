import { getTranslations } from 'next-intl/server';
import { fetchOutgoingShipments } from './actions';
import { ShipmentsClient } from './client';
import { PageHeader } from '@/components/page-header';
import Link from 'next/link';

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
        actions={
          <Link
            href="/logistics/outgoing-shipments/new"
            className="inline-flex h-9 items-center justify-center rounded-md bg-brand-ink px-4 py-2 text-sm font-medium text-brand-cream shadow transition-colors hover:bg-brand-ink/90"
          >
            {t('createNew')}
          </Link>
        }
      />
      <ShipmentsClient shipments={shipments} />
    </div>
  );
}
