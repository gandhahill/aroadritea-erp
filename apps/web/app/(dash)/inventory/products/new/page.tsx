import { PageHeader } from '@/components/page-header';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { fetchProductMasterData } from '../actions';
import { ProductForm } from '../product-form';
import { getActiveLocationOptions } from '@/lib/location-options';
import { getSession } from '@/lib/auth';
import { getLocale } from 'next-intl/server';

export const metadata: Metadata = {
  title: 'New Product',
};

type ProductKind = 'finished_good' | 'raw_material' | 'merchandise' | 'consumable' | 'service';

const SUPPLY_KINDS: ProductKind[] = ['raw_material', 'consumable'];

export default async function NewProductPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string }>;
}) {
  const params = await searchParams;
  const kindParam = params.kind as ProductKind | undefined;
  const isSupply = kindParam ? SUPPLY_KINDS.includes(kindParam) : false;

  const data = await fetchProductMasterData();
  
  const locale = await getLocale();
  const session = await getSession();
  const user = session?.user as Record<string, unknown> | undefined;
  const tenantId = String(user?.tenantId ?? 'default');
  const locationOptions = await getActiveLocationOptions({
    tenantId,
    locale: locale as 'id' | 'en' | 'zh',
    type: 'store',
  });

  const backHref = isSupply ? '/inventory/supplies' : '/inventory/products';
  const t = await getTranslations('inventory.products');

  const backLabel = isSupply ? t('backToSupplies') : t('backToProducts');
  const title = isSupply ? t('addSupply') : t('addProduct');
  const subtitle = isSupply ? t('addSupplyDesc') : t('addProductDesc');

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader title={<>{title}</>} description={<>{subtitle}</>} />
      {data.error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {data.error}
        </div>
      ) : null}
      <ProductForm
        mode="create"
        categories={data.categories}
        defaultKind={kindParam && SUPPLY_KINDS.includes(kindParam) ? kindParam : undefined}
        locations={locationOptions}
      />
    </div>
  );
}
