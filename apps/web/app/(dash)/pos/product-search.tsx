/**
 * Product Search — SD §21.4
 *
 * Searches and browses the product catalog.
 * Clicking a product (or variant) adds it to the cart.
 */

'use client';

import { displayAssetUrl } from '@/lib/display-asset-url';
import { Input } from '@erp/ui';
import { useTranslations } from 'next-intl';
import { useEffect, useState, useTransition } from 'react';
import {
  type ProductListItem,
  type VariantItem,
  fetchCategories,
  fetchProducts,
  setProductAvailabilityAction,
} from './actions';
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
  const [toggleError, setToggleError] = useState<string | null>(null);

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

  // Auto-clear availability-toggle errors after a few seconds.
  useEffect(() => {
    if (!toggleError) return;
    const timer = setTimeout(() => setToggleError(null), 4000);
    return () => clearTimeout(timer);
  }, [toggleError]);

  async function handleToggleAvailability(product: ProductListItem) {
    setToggleError(null);
    const result = await setProductAvailabilityAction(product.id, !product.isAvailable);
    if (!result.ok) {
      setToggleError(result.error);
      return;
    }
    setProducts((prev) =>
      prev.map((p) => (p.id === product.id ? { ...p, isAvailable: result.isAvailable } : p)),
    );
  }

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
          <Input
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

      {toggleError ? (
        <div className="mx-3 mt-2 shrink-0 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {t('toggleAvailabilityFailed')}
        </div>
      ) : null}

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
              // Out-of-stock guard: `null` qtyAvailable means the product
              // isn't tracked at the location level (e.g. teas whose stock
              // is consumed via BOM ingredients), so don't block those.
              // "0" or negative means we have a stock record and it's empty.
              const productOutOfStock =
                product.qtyAvailable !== null && Number(product.qtyAvailable) <= 0;
              // "86" toggle (G4/T-0301): manually marked unavailable for today.
              const is86d = !product.isAvailable;
              const unavailable = productOutOfStock || is86d;
              return (
                <div
                  key={product.id}
                  className={`flex min-h-[190px] flex-col gap-2 rounded-lg border border-brand-cream-3 bg-card p-3 text-left transition-shadow hover:border-brand-red/30 hover:shadow-sm ${
                    unavailable ? 'opacity-60' : ''
                  }`}
                >
                  {/* Product image */}
                  <div className="relative">
                    {product.imageUrl ? (
                      <img
                        src={displayAssetUrl(product.imageUrl)}
                        alt={product.name}
                        className="h-16 w-full rounded-md object-cover"
                      />
                    ) : (
                      <div className="flex h-16 w-full items-center justify-center rounded-md bg-brand-cream-2">
                        <svg
                          className="h-8 w-8 text-brand-red/40"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                        >
                          <path d="M3 8h12v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z" />
                          <path d="M15 10h2a3 3 0 0 1 0 6h-2" />
                          <path d="M7 3v3M11 3v3" strokeLinecap="round" />
                        </svg>
                      </div>
                    )}
                    {product.canToggleAvailability ? (
                      <button
                        type="button"
                        onClick={() => void handleToggleAvailability(product)}
                        title={is86d ? t('markAvailableAgain') : t('markUnavailableToday')}
                        aria-label={is86d ? t('markAvailableAgain') : t('markUnavailableToday')}
                        className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-card/90 text-brand-ink-3 shadow-sm hover:text-brand-red"
                      >
                        {is86d ? (
                          <svg
                            aria-hidden="true"
                            className="h-3.5 w-3.5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z"
                            />
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
                            />
                          </svg>
                        ) : (
                          <svg
                            aria-hidden="true"
                            className="h-3.5 w-3.5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88"
                            />
                          </svg>
                        )}
                      </button>
                    ) : null}
                  </div>
                  <p className="w-full text-xs font-medium leading-tight text-brand-ink">
                    {product.name}
                    {is86d ? (
                      <span className="ml-1 rounded bg-rose-100 px-1 text-[9px] font-semibold uppercase text-rose-700">
                        {t('unavailableToday')}
                      </span>
                    ) : productOutOfStock && !hasVariants ? (
                      <span className="ml-1 rounded bg-rose-100 px-1 text-[9px] font-semibold uppercase text-rose-700">
                        {t('outOfStock')}
                      </span>
                    ) : null}
                  </p>
                  {hasVariants ? (
                    <div className="mt-auto grid grid-cols-2 gap-1">
                      {product.variants.map((variant) => {
                        const variantOutOfStock =
                          variant.qtyAvailable !== null && Number(variant.qtyAvailable) <= 0;
                        const disabled = variantOutOfStock || unavailable;
                        return (
                          <button
                            key={variant.id}
                            type="button"
                            disabled={disabled}
                            onClick={() => !disabled && handleAddProduct(product, variant)}
                            title={
                              disabled
                                ? is86d
                                  ? t('unavailableToday')
                                  : t('outOfStock')
                                : `${variant.name} - ${formatRupiah(variant.sellPrice)}`
                            }
                            className="min-h-9 rounded-md border border-brand-cream-3 bg-brand-cream-2 px-2 py-1 text-left text-[10px] font-medium leading-tight text-brand-ink-2 hover:border-brand-red/40 hover:text-brand-red disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-brand-cream-3 disabled:hover:text-brand-ink-2"
                          >
                            <span className="line-clamp-1 block">
                              {variant.name}
                              {disabled ? ` · ${is86d ? t('unavailableToday') : t('outOfStock')}` : ''}
                            </span>
                            <span className="block text-[10px] font-semibold text-brand-red">
                              {formatRupiah(variant.sellPrice)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={unavailable}
                      onClick={() => !unavailable && handleAddProduct(product)}
                      className="mt-auto flex min-h-9 items-center justify-between rounded-md border border-brand-cream-3 bg-brand-cream-2 px-2 py-1 text-xs font-semibold text-brand-red hover:border-brand-red/40 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-brand-cream-3"
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
