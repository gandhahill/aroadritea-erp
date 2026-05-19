import type { Metadata } from 'next';
import Link from 'next/link';
import { fetchProductMasterData } from '../actions';
import { ProductForm } from '../product-form';

export const metadata: Metadata = {
  title: 'Tambah Produk - Aroadri ERP',
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

  const backHref = isSupply ? '/inventory/supplies' : '/inventory/products';
  const backLabel = isSupply ? 'Kembali ke Bahan & Perlengkapan' : 'Kembali ke Produk & Menu';
  const title = isSupply ? 'Tambah bahan / perlengkapan' : 'Tambah produk';
  const subtitle = isSupply
    ? 'Buat bahan baku atau perlengkapan baru (cup, sedotan, dll.). Item ini tidak akan muncul di kasir.'
    : 'Buat produk/menu baru. Varian Regular/Large dan Hot/Cold bisa ditambahkan setelah produk tersimpan.';

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <Link
          href={backHref}
          className="text-sm font-medium text-brand-ink-3 transition-colors hover:text-brand-ink"
        >
          {backLabel}
        </Link>
        <h1 className="mt-3 text-2xl font-bold text-brand-ink">{title}</h1>
        <p className="mt-1 text-sm text-brand-ink-3">{subtitle}</p>
      </div>
      {data.error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {data.error}
        </div>
      ) : null}
      <ProductForm
        mode="create"
        categories={data.categories}
        defaultKind={kindParam && SUPPLY_KINDS.includes(kindParam) ? kindParam : undefined}
      />
    </div>
  );
}
