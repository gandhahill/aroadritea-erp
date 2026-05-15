import type { Metadata } from 'next';
import Link from 'next/link';
import { fetchProductMasterData } from '../actions';
import { ProductForm } from '../product-form';

export const metadata: Metadata = {
  title: 'Tambah Produk - Aroadri ERP',
};

export default async function NewProductPage() {
  const data = await fetchProductMasterData();

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <Link
          href="/inventory/products"
          className="text-sm font-medium text-brand-ink-3 transition-colors hover:text-brand-ink"
        >
          Kembali ke Produk & Menu
        </Link>
        <h1 className="mt-3 text-2xl font-bold text-brand-ink">Tambah produk</h1>
        <p className="mt-1 text-sm text-brand-ink-3">
          Buat produk/menu baru. Varian Regular/Large dan Hot/Cold bisa ditambahkan setelah produk
          tersimpan.
        </p>
      </div>
      {data.error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {data.error}
        </div>
      ) : null}
      <ProductForm mode="create" categories={data.categories} />
    </div>
  );
}
