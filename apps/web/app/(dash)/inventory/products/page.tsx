import type { Metadata } from 'next';
import Link from 'next/link';
import { fetchProductMasterData } from './actions';
import { CategoryForm } from './category-form';

export const metadata: Metadata = {
  title: 'Produk & Menu - Aroadri ERP',
};

interface Props {
  searchParams: Promise<{ q?: string }>;
}

export default async function ProductsPage({ searchParams }: Props) {
  const params = await searchParams;
  const search = params.q?.trim() || undefined;
  const data = await fetchProductMasterData(search);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand-red/80">
            Inventory
          </p>
          <h1 className="mt-2 text-2xl font-bold text-brand-ink">Produk & Menu</h1>
          <p className="mt-1 max-w-2xl text-sm text-brand-ink-3">
            Kelola menu jual, bahan baku, harga varian, gambar, dan kategori langsung dari ERP.
          </p>
        </div>
        <Link
          href="/inventory/products/new"
          className="inline-flex items-center justify-center rounded-lg bg-brand-red px-4 py-2 text-sm font-semibold text-white shadow-soft transition-colors hover:bg-brand-red-dark"
        >
          Tambah produk
        </Link>
      </div>

      <CategoryForm />

      <form className="rounded-xl border border-brand-cream-3 bg-card p-4 shadow-sm">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-brand-ink">Cari produk</span>
          <div className="flex gap-3">
            <input
              name="q"
              defaultValue={search ?? ''}
              placeholder="SKU atau nama produk"
              className="min-w-0 flex-1 rounded-lg border border-brand-cream-3 bg-white px-3 py-2 text-sm text-brand-ink shadow-sm placeholder:text-brand-ink-3/60 focus:border-brand-ember-5 focus:outline-none focus:ring-1 focus:ring-brand-ember-5"
            />
            <button
              type="submit"
              className="rounded-lg border border-brand-cream-3 bg-white px-4 py-2 text-sm font-semibold text-brand-ink transition-colors hover:bg-brand-cream-1"
            >
              Cari
            </button>
          </div>
        </label>
      </form>

      {data.error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {data.error}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-brand-cream-3 bg-card shadow-sm">
        <div className="border-b border-brand-cream-3 px-5 py-4">
          <p className="text-sm font-semibold text-brand-ink">{data.total} produk</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-brand-cream-3 text-sm">
            <thead className="bg-brand-cream-1 text-left text-xs font-semibold uppercase tracking-wider text-brand-ink-3">
              <tr>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3">Nama</th>
                <th className="px-4 py-3">Kategori</th>
                <th className="px-4 py-3">Jenis</th>
                <th className="px-4 py-3 text-right">Harga</th>
                <th className="px-4 py-3 text-right">Varian</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-cream-3 bg-white">
              {data.products.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-brand-ink-3">
                    Belum ada produk yang cocok.
                  </td>
                </tr>
              ) : (
                data.products.map((product) => (
                  <tr key={product.id} className="hover:bg-brand-cream-1/60">
                    <td className="px-4 py-3 font-mono text-xs text-brand-ink">{product.sku}</td>
                    <td className="px-4 py-3 font-semibold text-brand-ink">{product.name.id}</td>
                    <td className="px-4 py-3 text-brand-ink-3">
                      {product.categoryCode || product.categoryName.id || '-'}
                    </td>
                    <td className="px-4 py-3 text-brand-ink-3">{product.kind}</td>
                    <td className="px-4 py-3 text-right font-semibold text-brand-ink">
                      {formatRupiah(product.defaultSellPrice)}
                    </td>
                    <td className="px-4 py-3 text-right text-brand-ink-3">
                      {product.variantCount}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-semibold ${
                          product.isActive
                            ? 'bg-brand-jade-light text-brand-jade'
                            : 'bg-brand-cream-2 text-brand-ink-3'
                        }`}
                      >
                        {product.isActive ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/inventory/products/${product.id}`}
                        className="rounded-md border border-brand-cream-3 bg-white px-3 py-1.5 text-xs font-semibold text-brand-ink transition-colors hover:bg-brand-cream-1"
                      >
                        Edit
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function formatRupiah(value: string) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(Number(value));
}
