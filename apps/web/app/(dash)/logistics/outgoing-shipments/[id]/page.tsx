import { PageHeader } from '@/components/page-header';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { fetchOutgoingShipmentById } from '../actions';
import { OutgoingShipmentDetailClient } from './client';

export default async function OutgoingShipmentDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  const [detail, t] = await Promise.all([
    fetchOutgoingShipmentById(id),
    getTranslations('logistics.outgoingShipment.detail'),
  ]);

  if (!detail) return notFound();

  return (
    <div className="space-y-6">
      <section className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-5 py-8 lg:px-8">
        <PageHeader
          title={
            <>
              {t('title')}: {detail.number}
            </>
          }
          description={
            <>
              {detail.subject}
            </>
          }
          eyebrow={<>{t('eyebrow')}</>}
          actions={
            <Link
              href="/logistics/outgoing-shipments"
              className="inline-flex items-center justify-center rounded-lg border border-brand-cream-3 bg-card px-4 py-2 text-sm font-semibold text-brand-ink hover:bg-brand-cream-1"
            >
              {t('back')}
            </Link>
          }
        />

        <OutgoingShipmentDetailClient detail={detail} />
      </section>
    </div>
  );
}
