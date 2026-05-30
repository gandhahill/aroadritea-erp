import { PageHeader } from '@/components/page-header';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { fetchPromotionPageData } from './actions';
import { PromotionsClient } from './promotions-client';

export const metadata: Metadata = {
  title: 'Promotions',
};

export default async function PromotionsPage() {
  const [data, t] = await Promise.all([
    fetchPromotionPageData(),
    getTranslations('settings.promotions'),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title={<>{t('title')}</>} description={<>{t('subtitle')}</>} />

      <PromotionsClient
        initialPromotions={data.promotions}
        locations={data.locations}
        products={data.products}
        variants={data.variants}
        expenseAccounts={data.expenseAccounts}
        labels={{
          add: t('add'),
          save: t('save'),
          saving: t('saving'),
          saved: t('saved'),
          code: t('code'),
          nameId: t('nameId'),
          nameEn: t('nameEn'),
          nameZh: t('nameZh'),
          kind: t('kind'),
          status: t('status'),
          priority: t('priority'),
          startsAt: t('startsAt'),
          endsAt: t('endsAt'),
          locations: t('locations'),
          channels: t('channels'),
          conditions: t('conditions'),
          benefits: t('benefits'),
          stackable: t('stackable'),
          requiresApproval: t('requiresApproval'),
          usageLimit: t('usageLimit'),
          minSubtotal: t('minSubtotal'),
          minQty: t('minQty'),
          memberOnly: t('memberOnly'),
          percent: t('percent'),
          amount: t('amount'),
          buyQty: t('buyQty'),
          buyProductId: t('buyProductId'),
          getQty: t('getQty'),
          getProductId: t('getProductId'),
          getVariantId: t('getVariantId'),
          discountPercent: t('discountPercent'),
          expenseAccount: t('expenseAccount'),
          active: t('active'),
          draft: t('draft'),
          paused: t('paused'),
          expired: t('expired'),
          percentDiscount: t('percentDiscount'),
          fixedDiscount: t('fixedDiscount'),
          buyXGetY: t('buyXGetY'),
          freeItem: t('freeItem'),
          complimentary: t('complimentary'),
          allLocations: t('allLocations'),
        }}
      />
    </div>
  );
}
