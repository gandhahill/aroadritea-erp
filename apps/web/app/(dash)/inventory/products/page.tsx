import type { Metadata } from 'next';
import Link from 'next/link';
import { displayAssetUrl } from '@/lib/display-asset-url';
import { fetchProductMasterData } from './actions';
import { CategoryForm } from './category-form';
import { ProductRowActions } from './row-actions';

export const metadata: Metadata = {
  title: 'Produk & Menu - Aroadri ERP',
};

type ProductKind = 'finished_good' | 'raw_material' | 'merchandise' | 'consumable' | 'service';

/**
 * "Produk & Menu" only shows items that are SOLD to customers
 * (finished_good, merchandise, service). Raw materials and consumables
 * live on their own page at `/inventory/supplies` so the menu master
 * stays clean of stockroom items that cashiers don't need to see.
 */
const SELLABLE_KINDS: ProductKind[] = ['finished_good', 'merchandise', 'service'];

const KIND_TABS: { value: ProductKind | 'all'; label: string }[] = [
  { value: 'all', label: 'Semua' },
  { value: 'finished_good', label: 'Produk Jual' },
  { value: 'merchandise', label: 'Merchandise' },
  { value: 'service', label: 'Jasa' },
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

export default async function ProductsPage({ searchParams }: Props) {
  const params = await searchParams;
  const search = params.q?.trim() || undefined;
  const kindParam = params.kind as ProductKind | undefined;
  const validKind =
    kindParam && SELLABLE_KINDS.includes(kindParam as ProductKind)
      ? (kindParam as ProductKind)
      : undefined;
  // Default to sellable-only — the service call below uses
  // `isSellable: true` to exclude bahan baku & consumables.
  const data = await fetchProductMasterData(search, validKind);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand-red/80">
            Inventory
          </p>
          <h1 className="mt-2 text-2xl font-bold text-brand-ink">Produk & Menu</h1>
          <p className="mt-1 max-w-2xl text-sm text-brand-ink-3">
            Kelola produk yang dijual ke pelanggan — minuman, makanan, merchandise, dan jasa.
            <Link
              href="/inventory/supplies"
              className="ml-1 font-medium text-brand-ember-5 hover:text-brand-ember-6"
            >
              Bahan baku &amp; perlengkapan
            </Link>{' '}
            dikelola di halaman terpisah.
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

      {/* Kind filter tabs */}
      <div className="flex flex-wrap gap-2">
        {KIND_TABS.map((tab) => {
          const isActive = tab.value === 'all' ? !validKind : validKind === tab.value;
          const href = tab.value === 'all'
            ? `/inventory/products${search ? `?q=${encodeURIComponent(search)}` : ''}`
            : `/inventory/products?kind=${tab.value}${search ? `&q=${encodeURIComponent(search)}` : ''}`;
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
          <span className="text-sm font-medium text-brand-ink">Cari produk</span>
          <div className="flex gap-3">
            <input
              name="q"
              defaultValue={search ?? ''}
              placeholder="SKU atau nama produk"
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
                <th className="px-4 py-3">Foto</th>
                <th className="px-4 py-3">Nama</th>
                <th className="px-4 py-3">Kategori</th>
                <th className="px-4 py-3">Jenis</th>
                <th className="px-4 py-3 text-right">Harga</th>
                <th className="px-4 py-3 text-right">Varian</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-cream-3 bg-card">
              {data.products.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-brand-ink-3">
                    Belum ada produk yang cocok.
                  </td>
                </tr>
              ) : (
                data.products.map((product) => (
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
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        product.kind === 'finished_good' ? 'bg-brand-jade-light text-brand-jade' :
                        product.kind === 'raw_material' ? 'bg-amber-100 text-amber-700' :
                        product.kind === 'merchandise' ? 'bg-blue-100 text-blue-700' :
                        product.kind === 'consumable' ? 'bg-purple-100 text-purple-700' :
                        'bg-brand-cream-2 text-brand-ink-3'
                      }`}>
                        {KIND_LABELS[product.kind as ProductKind] ?? product.kind}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-brand-ink">
                      {formatPrice(product)}
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

/**
 * Catalog rows show per-variant pricing when variants exist:
 *  - 1 variant: "Rp 42.000"
 *  - 2+ variants, same price: single price
 *  - 2+ variants, different price: "Rp 42.000 – Rp 47.000"
 *  - 0 variants: fall back to product.defaultSellPrice
 *
 * This keeps the table compact while reflecting that each variant
 * has its own price (per user request 2026-05-19).
 */
function formatPrice(product: {
  defaultSellPrice: string;
  variantCount: number;
  variantPriceMin: string | null;
  variantPriceMax: string | null;
}): string {
  if (product.variantCount === 0 || !product.variantPriceMin) {
    return formatRupiah(product.defaultSellPrice);
  }
  if (product.variantPriceMin === product.variantPriceMax || !product.variantPriceMax) {
    return formatRupiah(product.variantPriceMin);
  }
  return `${formatRupiah(product.variantPriceMin)} – ${formatRupiah(product.variantPriceMax)}`;
}
