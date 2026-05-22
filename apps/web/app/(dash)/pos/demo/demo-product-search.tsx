/**
 * Demo Product Search + List — reads from demo IndexedDB, not server.
 *
 * Mirrors production `product-search.tsx` but fetches from `packages/offline`
 * demo stores and uses `useDemoCart` instead of `usePosCart`.
 */

'use client';

import { displayAssetUrl } from '@/lib/display-asset-url';
import { type DbProduct, type DbVariant, getProducts, getVariants } from '@erp/offline';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { useDemoCart } from './demo-cart-context';

interface ProductWithVariants extends DbProduct {
  variants: DbVariant[];
}

export function DemoProductSearch() {
  const t = useTranslations('pos');
  const { addLine } = useDemoCart();
  const [products, setProducts] = useState<ProductWithVariants[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Load products from demo IndexedDB on mount
  useEffect(() => {
    async function load() {
      try {
        const [allProducts, allVariants] = await Promise.all([getProducts(), getVariants()]);
        const variantMap = new Map<string, DbVariant[]>();
        for (const v of allVariants) {
          const variants = variantMap.get(v.productId) ?? [];
          variants.push(v);
          variantMap.set(v.productId, variants);
        }
        setProducts(
          allProducts.map((p) => ({
            ...p,
            variants: variantMap.get(p.id) ?? [],
          })),
        );
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filtered = products.filter((p) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      p.variants.some((v) => v.name.toLowerCase().includes(q))
    );
  });

  const handleAddVariant = useCallback(
    (product: ProductWithVariants, variant?: DbVariant) => {
      const price = variant?.sellPrice ?? product.defaultSellPrice;
      const name: string = product.name as string;
      const variantName = variant?.name;
      const variantNameStr: string | undefined =
        variantName != null ? String(variantName) : undefined;
      addLine({
        productId: product.id,
        variantId: variant?.id,
        productName: name,
        variantName: variantNameStr,
        qty: 1,
        unitPrice: price,
      });
    },
    [addLine],
  );

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-brand-ink-3">{t('loading')}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden min-h-0">
      {/* Search */}
      <div className="border-b border-brand-cream-3 p-3 shrink-0">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('searchProduct')}
          className="h-10 w-full rounded-lg border border-brand-cream-3 bg-brand-cream-2 px-3 text-sm text-brand-ink placeholder:text-brand-ink-3/50 focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_var(--color-brand-cream),0_0_0_4px_var(--color-brand-red)]"
        />
      </div>

      {/* Product grid */}
      <div className="flex-1 overflow-y-auto p-3 min-h-0">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <svg
              className="h-10 w-10 text-brand-red/40"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M3 8h12v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z" />
              <path d="M15 10h2a3 3 0 0 1 0 6h-2" />
              <path d="M7 3v3M11 3v3" strokeLinecap="round" />
            </svg>
            <p className="mt-2 text-sm text-brand-ink-3">{t('noProductSelected')}</p>
            {search && <p className="mt-1 text-xs text-brand-ink-3">Coba kata kunci lain</p>}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {filtered.map((product) => {
              const hasVariants = product.variants.length > 0;
              return (
                <div
                  key={product.id}
                  className="flex min-h-[190px] flex-col gap-2 rounded-lg border border-brand-cream-3 bg-card p-3 text-left transition-shadow hover:border-brand-red/30 hover:shadow-sm"
                >
                  {product.imageUrl ? (
                    <img
                      src={displayAssetUrl(product.imageUrl)}
                      alt={String(product.name)}
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
                  <p className="w-full text-xs font-medium leading-tight text-brand-ink">
                    {String(product.name)}
                  </p>
                  {hasVariants ? (
                    <div className="mt-auto grid grid-cols-2 gap-1">
                      {product.variants.map((v) => {
                        const vName: string = String(v.name);
                        return (
                          <button
                            key={v.id}
                            type="button"
                            onClick={() => handleAddVariant(product, v)}
                            title={`${vName} - ${formatRupiah(v.sellPrice)}`}
                            className="min-h-9 rounded-md border border-brand-cream-3 bg-brand-cream-2 px-2 py-1 text-left text-[10px] font-medium leading-tight text-brand-ink-2 hover:border-brand-red/40 hover:text-brand-red"
                          >
                            <span className="line-clamp-1 block">{vName}</span>
                            <span className="block text-[10px] font-semibold text-brand-red">
                              {formatRupiah(v.sellPrice)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleAddVariant(product)}
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
