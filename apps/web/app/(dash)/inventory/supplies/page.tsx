/**
 * Bahan Baku & Perlengkapan Page — SD §25
 *
 * Counterpart to `/inventory/products`. This page lists items that are
 * NOT sold to customers — raw materials that go into a recipe, plus
 * disposable consumables (cups, straws, lids). Keeping them off the
 * "Produk & Menu" page makes the menu master easier to maintain and
 * matches user feedback (2026-05-19).
 */

import { PageHeader } from '@/components/page-header';
import { getSession } from '@/lib/auth';
import { displayAssetUrl } from '@/lib/display-asset-url';
import { getActiveLocationOptions } from '@/lib/location-options';
import { Button, Table, TableBody, TableCell, TableHead, TableHeader } from '@erp/ui';
import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { fetchProductMasterData } from '../products/actions';
import { ImportCsvPanel } from '../products/import-csv';
import { ProductRowActions } from '../products/row-actions';

export const metadata: Metadata = {
  title: 'Bahan Baku & Perlengkapan',
};

type ProductKind = 'finished_good' | 'raw_material' | 'merchandise' | 'consumable' | 'service';

const SUPPLY_KINDS: ProductKind[] = ['raw_material', 'consumable'];

const KIND_TABS: { value: ProductKind | 'all'; labelKey: string }[] = [
  { value: 'all', labelKey: 'all' },
  { value: 'raw_material', labelKey: 'rawMaterial' },
  { value: 'consumable', labelKey: 'consumable' },
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

export default async function SuppliesPage({ searchParams }: Props) {
  const [locale, t] = await Promise.all([getLocale(), getTranslations('inventory.products')]);
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

  const session = await getSession();
  const user = session?.user as Record<string, unknown> | undefined;
  const tenantId = String(user?.tenantId ?? 'default');
  const userLocationId = String(user?.locationId ?? '');
  const locationOptions = await getActiveLocationOptions({
    tenantId,
    locale: locale as 'id' | 'en' | 'zh',
    type: ['store', 'warehouse', 'office'],
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title={<>{t('suppliesTitle')}</>}
        description={
          <>
            {t('suppliesDescriptionPrefix')}
            <Link
              href="/inventory/products"
              className="ml-1 font-medium text-brand-ember-5 hover:text-brand-ember-6"
            >
              {t('sellableLink')}
            </Link>{' '}
            {t('suppliesDescriptionSuffix')}
          </>
        }
        eyebrow={<>{t('eyebrow')}</>}
        actions={
          <>
            <Link
              href="/inventory/products/new?kind=raw_material"
              className="inline-flex items-center justify-center rounded-lg "
            >
              {t('addItem')}
            </Link>
          </>
        }
      />

      <ImportCsvPanel
        locations={locationOptions}
        defaultLocationId={userLocationId || locationOptions[0]?.id || ''}
      />

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
              {t(tab.labelKey)}
            </Link>
          );
        })}
      </div>

      <form className="rounded-xl border border-brand-cream-3 bg-card p-4 shadow-sm">
        {validKind && <input type="hidden" name="kind" value={validKind} />}
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-brand-ink">{t('searchSupplies')}</span>
          <div className="flex gap-3">
            <input
              name="q"
              defaultValue={search ?? ''}
              placeholder={t('searchItemPlaceholder')}
              className="min-w-0 flex-1 rounded-lg border border-brand-cream-3 bg-card px-3 py-2 text-sm text-brand-ink shadow-sm placeholder:text-brand-ink-3/60 focus:border-brand-ember-5 focus:outline-none focus:ring-1 focus:ring-brand-ember-5"
            />
            <Button type="submit" className="rounded-lg " variant="secondary" size="md">
              {t('searchBtn')}
            </Button>
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
          <p className="text-sm font-semibold text-brand-ink">{t('itemCount', { count: total })}</p>
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
                <TableHead className="px-4 py-3 text-right">{t('costPrice')}</TableHead>
                <TableHead className="px-4 py-3">{t('status')}</TableHead>
                <TableHead className="px-4 py-3" />
              </tr>
            </TableHeader>
            <TableBody>
              {products.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-brand-ink-3">
                    {t('suppliesEmpty')}
                  </td>
                </tr>
              ) : (
                products.map((product) => (
                  <tr key={product.id} className="hover:bg-brand-cream-1/60">
                    <TableCell className="px-4 py-3 font-mono text-xs text-brand-ink">
                      {product.sku}
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      {product.imageUrl ? (
                        <img
                          src={displayAssetUrl(product.imageUrl)}
                          alt={localized(product.name, locale) || product.sku}
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
                          product.kind === 'raw_material'
                            ? 'bg-amber-100 text-amber-700'
                            : product.kind === 'consumable'
                              ? 'bg-purple-100 text-purple-700'
                              : 'bg-brand-cream-2 text-brand-ink-3'
                        }`}
                      >
                        {t(KIND_LABEL_KEYS[product.kind as ProductKind] ?? 'kind')}
                      </span>
                    </TableCell>
                    <TableCell className="px-4 py-3 text-right font-semibold text-brand-ink">
                      {formatRupiah(product.defaultSellPrice, locale)}
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
