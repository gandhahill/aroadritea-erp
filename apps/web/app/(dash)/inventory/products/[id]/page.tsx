import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { fetchProductDetail } from '../actions';
import { ProductForm } from '../product-form';
import type { ProductFormInitial } from '../product-types';
import { VariantManager } from '../variant-manager';

export const metadata: Metadata = {
  title: 'Edit Produk - Aroadri ERP',
};

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ProductDetailPage({ params }: Props) {
  const { id } = await params;
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
      <div>
        {/* Adapt the back link to the originating list — supplies for
            raw_material/consumable, otherwise the menu master. */}
        {product && (product.kind === 'raw_material' || product.kind === 'consumable') ? (
          <Link
            href="/inventory/supplies"
            className="text-sm font-medium text-brand-ink-3 transition-colors hover:text-brand-ink"
          >
            Kembali ke Bahan &amp; Perlengkapan
          </Link>
        ) : (
          <Link
            href="/inventory/products"
            className="text-sm font-medium text-brand-ink-3 transition-colors hover:text-brand-ink"
          >
            Kembali ke Produk &amp; Menu
          </Link>
        )}
        <h1 className="mt-3 text-2xl font-bold text-brand-ink">
          {product ? product.name.id : 'Produk tidak bisa dimuat'}
        </h1>
        <p className="mt-1 text-sm text-brand-ink-3">
          Edit data produk, harga default, gambar, dan varian POS.
        </p>
      </div>

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
