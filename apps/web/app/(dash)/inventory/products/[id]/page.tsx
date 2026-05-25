import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { fetchProductDetail } from '../actions';
import { ProductForm } from '../product-form';
import type { ProductFormInitial } from '../product-types';
import { VariantManager } from '../variant-manager';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('inventory.products');
  return {
    title: `${t('editProduct')} - Aroadri ERP`,
  };
}

interface Props {
  params: Promise<{ id: string }>;
}

import { PageHeader } from '@/components/page-header';
import { getLocale, getTranslations } from 'next-intl/server';

export default async function ProductDetailPage({ params }: Props) {
  const { id } = await params;
  const t = await getTranslations('inventory.products');
  const locale = await getLocale();
  const data = await fetchProductDetail(id);

  if (!data.product && !data.error) notFound();

  const product = data.product
    ? ({
        id: data.product.id,
        sku: data.product.sku,
        name: data.product.name,
        description: data.product.description,
        categoryId: data.product.categoryId,
        kind: data.product.kind,
        opnameFrequency: data.product.opnameFrequency,
        opnameFrequencies: data.product.opnameFrequencies,
        uom: data.product.uom,
        isSellable: data.product.isSellable,
        isPurchasable: data.product.isPurchasable,
        trackBatch: data.product.trackBatch,
        trackExpiry: data.product.trackExpiry,
        shelfLifeDays: data.product.shelfLifeDays,
        defaultSellPrice: data.product.defaultSellPrice,
        defaultCostPrice: data.product.defaultCostPrice,
        taxCode: data.product.taxCode,
        imageUrl: data.product.imageUrl,
        isActive: data.product.isActive,
        version: data.product.version,
        variants: data.product.variants,
      } satisfies ProductFormInitial)
    : null;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title={
          <>
            {product
              ? ((product.name as Record<string, string>)[locale] ?? product.name.id)
              : t('loadFailed')}
          </>
        }
        description={<>{t('editProductDesc')}</>}
      />

      {data.error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {data.error}
        </div>
      ) : null}

      {product ? (
        <>
          <ProductForm mode="edit" categories={data.categories} product={product} />
          <VariantManager productId={product.id} variants={product.variants} />
        </>
      ) : null}
    </div>
  );
}
