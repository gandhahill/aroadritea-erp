import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { fetchQuickAdjustData } from './actions';
import { QuickAdjustForm } from './quick-adjust-form';

export const metadata: Metadata = {
  title: 'Quick Adjustment - Inventory',
};

export default async function QuickAdjustPage() {
  const [data, t] = await Promise.all([
    fetchQuickAdjustData(),
    getTranslations('inventory.adjust'),
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link
          href="/inventory/stock"
          className="text-sm font-medium text-brand-ink-3 transition-colors hover:text-brand-ink"
        >
          {t('back')}
        </Link>
        <h1 className="mt-3 text-2xl font-bold text-brand-ink">{t('title')}</h1>
        <p className="mt-1 max-w-2xl text-sm text-brand-ink-3">{t('subtitle')}</p>
      </div>

      <QuickAdjustForm data={data} />
    </div>
  );
}
