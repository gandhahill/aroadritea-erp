import { displayAssetUrl } from '@/lib/display-asset-url';
import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { fetchProductMasterData } from './actions';
import { CategoryForm } from './category-form';
import { ProductRowActions } from './row-actions';
import { TableCell, TableBody, TableHead, TableHeader, Table, Button } from "@erp/ui";

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

const KIND_TABS: { value: ProductKind | 'all'; labelKey: string }[] = [
  { value: 'all', labelKey: 'all' },
  { value: 'finished_good', labelKey: 'productsSold' },
  { value: 'merchandise', labelKey: 'merchandise' },
  { value: 'service', labelKey: 'service' },
];

const KIND_LABEL_KEYS: Record<ProductKind, string> = {
  finished_good: 'productsSold',
  raw_material: 'rawMaterial',
  merchandise: 'merchandise',
  consumable: 'consumable',
  service: 'service',
};

interface Props {
  searchParams: Promise<{ q?: string; kind?: string }>;
}

export default async function ProductsPage({ searchParams }: Props) {
  const [locale, t] = await Promise.all([getLocale(), getTranslations('inventory.products')]);
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
            {t('eyebrow')}
          </p>
          <h1 className="mt-2 text-2xl font-bold text-brand-ink">{t('title')}</h1>
          <p className="mt-1 max-w-2xl text-sm text-brand-ink-3">
            {t('sellableDescriptionPrefix')}
            <Link
              href="/inventory/supplies"
              className="ml-1 font-medium text-brand-ember-5 hover:text-brand-ember-6"
            >
              {t('suppliesLink')}
            </Link>{' '}
            {t('sellableDescriptionSuffix')}
          </p>
        </div>
        <Link
          href="/inventory/products/new"
          className="inline-flex items-center justify-center rounded-lg "
        >
          {t('add')}
        </Link>
      </div>

      <CategoryForm />

      {/* Kind filter tabs */}
      <div className="flex flex-wrap gap-2">
        {KIND_TABS.map((tab) => {
          const isActive = tab.value === 'all' ? !validKind : validKind === tab.value;
          const href =
            tab.value === 'all'
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
              {t(tab.labelKey)}
            </Link>
          );
        })}
      </div>

      <form className="rounded-xl border border-brand-cream-3 bg-card p-4 shadow-sm">
        {validKind && <input type="hidden" name="kind" value={validKind} />}
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-brand-ink">{t('searchLabel')}</span>
          <div className="flex gap-3">
            <input
              name="q"
              defaultValue={search ?? ''}
              placeholder={t('searchInputPlaceholder')}
              className="min-w-0 flex-1 rounded-lg border border-brand-cream-3 bg-card px-3 py-2 text-sm text-brand-ink shadow-sm placeholder:text-brand-ink-3/60 focus:border-brand-ember-5 focus:outline-none focus:ring-1 focus:ring-brand-ember-5"
            />
            <Button
              type="submit"
              className="rounded-lg " variant="secondary" size="md"
            >
              {t('searchBtn')}
            </Button>
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
          <p className="text-sm font-semibold text-brand-ink">
            {t('count', { count: data.total })}
          </p>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <tr>
                <TableHead className="px-4 py-3">{t('sku')}</TableHead>
                <TableHead className="px-4 py-3">{t('photo')}</TableHead>
                <TableHead className="px-4 py-3">{t('name')}</TableHead>
                <TableHead className="px-4 py-3">{t('category')}</TableHead>
                <TableHead className="px-4 py-3">{t('kind')}</TableHead>
                <TableHead className="px-4 py-3 text-right">{t('price')}</TableHead>
                <TableHead className="px-4 py-3 text-right">{t('variant')}</TableHead>
                <TableHead className="px-4 py-3">{t('status')}</TableHead>
                <TableHead className="px-4 py-3" />
              </tr>
            </TableHeader>
            <TableBody>
              {data.products.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-brand-ink-3">
                    {t('empty')}
                  </td>
                </tr>
              ) : (
                data.products.map((product) => (
                  <tr key={product.id} className="hover:bg-brand-cream-1/60">
                    <TableCell className="px-4 py-3 font-mono text-xs text-brand-ink">{product.sku}</TableCell>
                    <TableCell className="px-4 py-3">
                      {product.imageUrl ? (
                        <img
                          src={displayAssetUrl(product.imageUrl)}
                          alt={localized(product.name, locale) ?? product.sku}
                          className="h-12 w-12 rounded-md object-cover"
                        />
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded-md bg-brand-cream-2 text-xs text-brand-ink-3">
                          -
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="px-4 py-3 font-semibold text-brand-ink">
                      {localized(product.name, locale)}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-brand-ink-3">
                      {product.categoryCode || localized(product.categoryName, locale) || '-'}
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          product.kind === 'finished_good'
                            ? 'bg-brand-jade-light text-brand-jade'
                            : product.kind === 'raw_material'
                              ? 'bg-amber-100 text-amber-700'
                              : product.kind === 'merchandise'
                                ? 'bg-blue-100 text-blue-700'
                                : product.kind === 'consumable'
                                  ? 'bg-purple-100 text-purple-700'
                                  : 'bg-brand-cream-2 text-brand-ink-3'
                        }`}
                      >
                        {t(KIND_LABEL_KEYS[product.kind as ProductKind] ?? 'kind')}
                      </span>
                    </TableCell>
                    <TableCell className="px-4 py-3 text-right font-semibold text-brand-ink">
                      {formatPrice(product, locale)}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-right text-brand-ink-3">
                      {product.variantCount}
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-semibold ${
                          product.isActive
                            ? 'bg-brand-jade-light text-brand-jade'
                            : 'bg-brand-cream-2 text-brand-ink-3'
                        }`}
                      >
                        {product.isActive ? t('active') : t('inactive')}
                      </span>
                    </TableCell>
                    <TableCell className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/inventory/products/${product.id}`}
                          className="rounded-md border border-brand-cream-3 bg-card px-3 py-1.5 text-xs font-semibold text-brand-ink transition-colors hover:bg-brand-cream-1"
                        >
                          {t('edit')}
                        </Link>
                        <ProductRowActions productId={product.id} isActive={product.isActive} />
                      </div>
                    </TableCell>
                  </tr>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

function localized(
  value: { id?: string; en?: string; zh?: string } | null | undefined,
  locale: string,
): string {
  if (!value) return '';
  const key = locale === 'zh' ? 'zh' : locale === 'en' ? 'en' : 'id';
  return value[key] ?? value.id ?? value.en ?? value.zh ?? '';
}

function formatRupiah(value: string, locale: string) {
  return new Intl.NumberFormat(locale, {
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
function formatPrice(
  product: {
    defaultSellPrice: string;
    variantCount: number;
    variantPriceMin: string | null;
    variantPriceMax: string | null;
  },
  locale: string,
): string {
  if (product.variantCount === 0 || !product.variantPriceMin) {
    return formatRupiah(product.defaultSellPrice, locale);
  }
  if (product.variantPriceMin === product.variantPriceMax || !product.variantPriceMax) {
    return formatRupiah(product.variantPriceMin, locale);
  }
  return `${formatRupiah(product.variantPriceMin, locale)} - ${formatRupiah(product.variantPriceMax, locale)}`;
}
