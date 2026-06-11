import { PageHeader } from '@/components/page-header';
import { getSession } from '@/lib/auth';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { fetchUomConversionsPageData } from './actions';
import { UomConversionsClient } from './uom-conversions-client';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('inventory.uomConversions');
  return { title: t('title') };
}

export default async function UomConversionsPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const t = await getTranslations('inventory.uomConversions');

  const data = await fetchUomConversionsPageData();

  return (
    <div className="space-y-6">
      <PageHeader title={<>{t('title')}</>} description={<>{t('subtitle')}</>} />
      <UomConversionsClient data={data} />
    </div>
  );
}
