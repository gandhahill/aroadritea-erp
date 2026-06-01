import { PageHeader } from '@/components/page-header';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { fetchAdjustments, fetchQuickAdjustData } from './actions';
import { AdjustmentList } from './adjustment-list';
import { QuickAdjustForm } from './quick-adjust-form';

export const metadata: Metadata = {
  title: 'Quick Adjustment',
};

export default async function QuickAdjustPage() {
  const [data, adjustments, t] = await Promise.all([
    fetchQuickAdjustData(),
    fetchAdjustments(),
    getTranslations('inventory.adjust'),
  ]);

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <PageHeader title={<>{t('title')}</>} description={<>{t('subtitle')}</>} />

      <QuickAdjustForm data={data} />

      <AdjustmentList rows={adjustments} />
    </div>
  );
}
