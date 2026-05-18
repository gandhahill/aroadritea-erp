/**
 * Bahan Baku & Perlengkapan Page — SD §25
 *
 * Counterpart to `/inventory/products`. This page lists items that are
 * NOT sold to customers — raw materials that go into a recipe, plus
 * disposable consumables (cups, straws, lids). Keeping them off the
 * "Produk & Menu" page makes the menu master easier to maintain and
 * matches user feedback (2026-05-19).
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { displayAssetUrl } from '@/lib/display-asset-url';
import { fetchProductMasterData } from '../products/actions';
import { ProductRowActions } from '../products/row-actions';

export const metadata: Metadata = {
  title: 'Bahan Baku & Perlengkapan - Aroadri ERP',
};

type ProductKind = 'finished_good' | 'raw_material' | 'merchandise' | 'consumable' | 'service';

const SUPPLY_KINDS: ProductKind[] = ['raw_material', 'consumable'];

const KIND_TABS: { value: ProductKind | 'all'; label: string }[] = [
  { value: 'all', label: 'Semua' },
  { value: 'raw_material', label: 'Bahan Baku' },
  { value: 'consumable', label: 'Perlengkapan' },
];

const KIND_LABELS: Record<ProductKind, string> = {
  finished_good: 'Produk Jual',
  raw_material: 'Bahan Baku',
  merchandise: 'Merchandise',
  consumable: 'Perlengkapan',
  service: 'Jasa',
};

interface Props {
  searchParams: Promise<{ q?: string; kind?: string }>;
}

export default async function SuppliesPage({ searchParams }: Props) {
  const params = await searchParams;
  const search = params.q?.trim() || undefined;
  const kindParam = params.kind as ProductKind | undefined;
  const validKind =
    kindParam && SUPPLY_KINDS.includes(kindParam as ProductKind)
      ? (kindParam as ProductKind)
      : undefined;

  // If no kind is picked, fetch both raw_material and consumable. The
  // service's listProducts doesn't accept an array filter, so we run two
  // calls and concatenate locally — fine since the supply master is
  // small (< few hundred SKUs per outlet).
  let products: Awaited<ReturnType<typeof fetchProductMasterData>>['products'] = [];
  let total = 0;
  let categories: Awaited<ReturnType<typeof fetchProductMasterData>>['categories'] = [];
  let error: string | undefined;

  if (validKind) {
    const data = await fetchProductMasterData(search, validKind);
    products = data.products;
    total = data.total;
    categories = data.categories;
    error = data.error;
  } else {
    const [rawMat, consumable] = await Promise.all([
      fetchProductMasterData(search, 'raw_material'),
      fetchProductMasterData(search, 'consumable'),
    ]);
    products = [...rawMat.products, ...consumable.products].sort((a, b) =>
      a.sku.localeCompare(b.sku),
    );
    total = rawMat.total + consumable.total;
    categories = rawMat.categories;
    error = rawMat.error ?? consumable.error;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand-red/80">
            Inventory
          </p>
          <h1 className="mt-2 text-2xl font-bold text-brand-ink">
            Bahan Baku &amp; Perlengkapan
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-brand-ink-3">
            Daftar bahan baku resep dan perlengkapan operasional (cup, sedotan, tutup, kemasan).
            Item di sini tidak muncul di kasir.
            <Link
              href="/inventory/products"
              className="ml-1 font-medium text-brand-ember-5 hover:text-brand-ember-6"
            >
              Produk yang dijual
            </Link>{' '}
            ada di halaman terpisah.
          </p>
        </div>
        <Link
          href="/inventory/products/new"
          className="inline-flex items-center justify-center rounded-lg bg-brand-red px-4 py-2 text-sm font-semibold text-white shadow-soft transition-colors hover:bg-brand-red-dark"
        >
          Tambah item
        </Link>
      </div>

      {/* Kind filter tabs */}
      <div className="flex flex-wrap gap-2">
        {KIND_TABS.map((tab) => {
          const isActive = tab.value === 'all' ? !validKind : validKind === tab.value;
          const href =
            tab.value === 'all'
              ? `/inventory/supplies${search ? `?q=${encodeURIComponent(search)}` : ''}`
              : `/inventory/supplies?kind=${tab.value}${search ? `&q=${encodeURIComponent(search)}` : ''}`;
          return (
            <Link
              key={tab.value}
              href={href}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                isActive
                  ? 'bg-brand-red text-white'
                  : 'bg-brand-cream-2 text-brand-ink-2 hover:bg-brand-cream-3'
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      <form className="rounded-xl border border-brand-cream-3 bg-card p-4 shadow-sm">
        {validKind && <input type="hidden" name="kind" value={validKind} />}
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-brand-ink">Cari bahan / perlengkapan</span>
          <div className="flex gap-3">
            <input
              name="q"
              defaultValue={search ?? ''}
              placeholder="SKU atau nama item"
              className="min-w-0 flex-1 rounded-lg border border-brand-cream-3 bg-card px-3 py-2 text-sm text-brand-ink shadow-sm placeholder:text-brand-ink-3/60 focus:border-brand-ember-5 focus:outline-none focus:ring-1 focus:ring-brand-ember-5"
            />
            <button
              type="submit"
              className="rounded-lg border border-brand-cream-3 bg-card px-4 py-2 text-sm font-semibold text-brand-ink transition-colors hover:bg-brand-cream-1"
            >
              Cari
            </button>
          </div>
        </label>
      </form>

      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-brand-cream-3 bg-card shadow-sm">
        <div className="border-b border-brand-cream-3 px-5 py-4">
          <p className="text-sm font-semibold text-brand-ink">{total} item</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-brand-cream-3 text-sm">
            <thead className="bg-brand-cream-1 text-left text-xs font-semibold uppercase tracking-wider text-brand-ink-3">
              <tr>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3">Foto</th>
                <th className="px-4 py-3">Nama</th>
                <th className="px-4 py-3">Kategori</th>
                <th className="px-4 py-3">Jenis</th>
                <th className="px-4 py-3 text-right">HPP / Beli</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-cream-3 bg-card">
              {products.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-brand-ink-3">
                    Belum ada bahan baku atau perlengkapan.
                  </td>
                </tr>
              ) : (
                products.map((product) => (
                  <tr key={product.id} className="hover:bg-brand-cream-1/60">
                    <td className="px-4 py-3 font-mono text-xs text-brand-ink">{product.sku}</td>
                    <td className="px-4 py-3">
                      {product.imageUrl ? (
                        <img
                          src={displayAssetUrl(product.imageUrl)}
                          alt={product.name.id ?? product.sku}
                          className="h-12 w-12 rounded-md object-cover"
                        />
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded-md bg-brand-cream-2 text-xs text-brand-ink-3">
                          -
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-semibold text-brand-ink">{product.name.id}</td>
                    <td className="px-4 py-3 text-brand-ink-3">
                      {product.categoryCode || product.categoryName.id || '-'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          product.kind === 'raw_material'
                            ? 'bg-amber-100 text-amber-700'
                            : product.kind === 'consumable'
                              ? 'bg-purple-100 text-purple-700'
                              : 'bg-brand-cream-2 text-brand-ink-3'
                        }`}
                      >
                        {KIND_LABELS[product.kind as ProductKind] ?? product.kind}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-brand-ink">
                      {formatRupiah(product.defaultSellPrice)}
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
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/inventory/products/${product.id}`}
                          className="rounded-md border border-brand-cream-3 bg-card px-3 py-1.5 text-xs font-semibold text-brand-ink transition-colors hover:bg-brand-cream-1"
                        >
                          Edit
                        </Link>
                        <ProductRowActions
                          productId={product.id}
                          isActive={product.isActive}
                        />
                      </div>
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
