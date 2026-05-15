/**
 * Product Search — SD §21.4
 *
 * Searches and browses the product catalog.
 * Clicking a product (or variant) adds it to the cart.
 */

'use client';

import { displayAssetUrl } from '@/lib/display-asset-url';
import { useTranslations } from 'next-intl';
import { useEffect, useState, useTransition } from 'react';
import { type ProductListItem, type VariantItem, fetchCategories, fetchProducts } from './actions';
import { usePosCart } from './pos-cart-context';

export function ProductSearch() {
  const t = useTranslations('pos');
  const { addLine, state } = usePosCart();
  const [products, setProducts] = useState<ProductListItem[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [isPending, startTransition] = useTransition();

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Load categories once.
  useEffect(() => {
    startTransition(async () => {
      setCategories(await fetchCategories());
    });
  }, []);

  // Load products when filters change
  useEffect(() => {
    startTransition(async () => {
      const prods = await fetchProducts({
        categoryId: activeCategory || undefined,
        search: debouncedSearch || undefined,
      });
      setProducts(prods);
    });
  }, [activeCategory, debouncedSearch]);

  function handleAddProduct(product: ProductListItem, variant?: VariantItem) {
    const unitPrice = variant ? variant.sellPrice : product.defaultSellPrice;
    const variantName = variant ? variant.name : undefined;
    addLine({
      productId: product.id,
      variantId: variant?.id,
      productName: product.name,
      variantName,
      qty: 1,
      unitPrice,
    });
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden min-h-0">
      {/* Search bar */}
      <div className="border-b border-brand-cream-3 p-3 shrink-0">
        <div className="relative">
          <svg
            aria-hidden="true"
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-ink-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607z"
            />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('searchProduct')}
            className="h-10 w-full rounded-md border border-brand-cream-3 bg-card py-2 pl-10 pr-3 text-sm text-brand-ink placeholder:text-brand-ink-3/50 focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_var(--color-brand-cream),0_0_0_4px_var(--color-brand-red)]"
          />
        </div>
      </div>

      {/* Category filter pills */}
      <div className="flex gap-2 overflow-x-auto border-b border-brand-cream-3 px-3 py-2 shrink-0">
        <button
          type="button"
          onClick={() => setActiveCategory('')}
          className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            !activeCategory
              ? 'bg-brand-red text-white'
              : 'bg-brand-cream-2 text-brand-ink-3 hover:bg-brand-cream-3'
          }`}
        >
          {t('allCategories')}
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setActiveCategory(cat.id)}
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              activeCategory === cat.id
                ? 'bg-brand-red text-white'
                : 'bg-brand-cream-2 text-brand-ink-3 hover:bg-brand-cream-3'
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* Product grid */}
      <div className="flex-1 overflow-y-auto p-3 min-h-0">
        {isPending && products.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-sm text-brand-ink-3">{t('loading')}</p>
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12">
            <svg
              aria-hidden="true"
              className="h-12 w-12 text-brand-ink-3/30"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
              />
            </svg>
            <p className="text-sm text-brand-ink-3">{t('noProductSelected')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {products.map((product) => {
              const hasVariants = product.variants.length > 0;
              return (
                <div
                  key={product.id}
                  className="flex min-h-[190px] flex-col gap-2 rounded-lg border border-brand-cream-3 bg-card p-3 text-left transition-shadow hover:border-brand-red/30 hover:shadow-sm"
                >
                  {/* Product image */}
                  {product.imageUrl ? (
                    <img
                      src={displayAssetUrl(product.imageUrl)}
                      alt={product.name}
                      className="h-16 w-full rounded-md object-cover"
                    />
                  ) : (
                    <div className="flex h-16 w-full items-center justify-center rounded-md bg-brand-cream-2">
                      <span className="text-2xl">🍵</span>
                    </div>
                  )}
                  <p className="w-full text-xs font-medium leading-tight text-brand-ink">
                    {product.name}
                  </p>
                  {hasVariants ? (
                    <div className="mt-auto grid grid-cols-2 gap-1">
                      {product.variants.map((variant) => (
                        <button
                          key={variant.id}
                          type="button"
                          onClick={() => handleAddProduct(product, variant)}
                          title={`${variant.name} - ${formatRupiah(variant.sellPrice)}`}
                          className="min-h-9 rounded-md border border-brand-cream-3 bg-brand-cream-2 px-2 py-1 text-left text-[10px] font-medium leading-tight text-brand-ink-2 hover:border-brand-red/40 hover:text-brand-red"
                        >
                          <span className="line-clamp-1 block">{variant.name}</span>
                          <span className="block text-[10px] font-semibold text-brand-red">
                            {formatRupiah(variant.sellPrice)}
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleAddProduct(product)}
                      className="mt-auto flex min-h-9 items-center justify-between rounded-md border border-brand-cream-3 bg-brand-cream-2 px-2 py-1 text-xs font-semibold text-brand-red hover:border-brand-red/40"
                    >
                      <span>{formatRupiah(product.defaultSellPrice)}</span>
                      <span className="text-brand-ink-3">+</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function formatRupiah(value: string): string {
  const num = Number(value);
  if (Number.isNaN(num)) return 'Rp 0';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(num);
}
