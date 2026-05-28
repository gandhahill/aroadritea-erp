import { PageHeader } from '@/components/page-header';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { fetchQuickAdjustData } from './actions';
import { QuickAdjustForm } from './quick-adjust-form';

export const metadata: Metadata = {
  title: 'Quick Adjustment | Aroadri ERP',
};

export default async function QuickAdjustPage() {
  const [data, t] = await Promise.all([
    fetchQuickAdjustData(),
    getTranslations('inventory.adjust'),
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader title={<>{t('title')}</>} description={<>{t('subtitle')}</>} />

      <QuickAdjustForm data={data} />
    </div>
  );
}
