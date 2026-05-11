/**
 * Demo Product Search + List — reads from demo IndexedDB, not server.
 *
 * Mirrors production `product-search.tsx` but fetches from `packages/offline`
 * demo stores and uses `useDemoCart` instead of `usePosCart`.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useDemoCart } from './demo-cart-context';
import {
  getProducts,
  getVariants,
  type DbProduct,
  type DbVariant,
} from '@erp/offline';

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
        const [allProducts, allVariants] = await Promise.all([
          getProducts(),
          getVariants(),
        ]);
        const variantMap = new Map<string, DbVariant[]>();
        for (const v of allVariants) {
          if (!variantMap.has(v.productId)) variantMap.set(v.productId, []);
          variantMap.get(v.productId)!.push(v);
        }
        setProducts(
          allProducts.map(p => ({
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

  const filtered = products.filter(p => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      p.variants.some(v => v.name.toLowerCase().includes(q))
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
    <div className="flex flex-1 flex-col">
      {/* Search */}
      <div className="border-b border-brand-cream-3 p-3">
        <input
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={t('searchProduct')}
          className="h-10 w-full rounded-lg border border-brand-cream-3 bg-brand-cream-2 px-3 text-sm text-brand-ink placeholder:text-brand-ink-3/50 focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_var(--color-brand-cream),0_0_0_4px_var(--color-brand-red)]"
        />
      </div>

      {/* Product grid */}
      <div className="flex-1 overflow-y-auto p-3">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <span className="text-3xl">🧋</span>
            <p className="mt-2 text-sm text-brand-ink-3">{t('noProductSelected')}</p>
            {search && (
              <p className="mt-1 text-xs text-brand-ink-3">Coba kata kunci lain</p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {filtered.map(product => (
              <div key={product.id} className="flex flex-col">
                {/* Main product card */}
                <button
                  onClick={() => handleAddVariant(product)}
                  className="flex flex-1 flex-col items-center gap-1.5 rounded-xl border border-brand-cream-3 bg-white p-3 text-center transition-all hover:border-brand-red/40 hover:shadow-sm active:scale-95"
                >
                  {product.imageUrl ? (
                    <img
                      src={product.imageUrl}
                      alt={String(product.name)}
                      className="h-16 w-16 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-brand-cream-2 text-3xl">
                      🧋
                    </div>
                  )}
                  <div className="w-full">
                    <p className="line-clamp-2 text-xs font-medium leading-tight text-brand-ink">
                      {String(product.name)}
                    </p>
                    <p className="mt-0.5 text-xs font-semibold text-brand-red">
                      {formatRupiah(product.defaultSellPrice)}
                    </p>
                  </div>
                </button>

                {/* Variant pills — shown if product has variants */}
                {product.variants.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {product.variants.map(v => {
                      const vName: string = String(v.name);
                      return (
                        <button
                          key={v.id}
                          onClick={() => handleAddVariant(product, v)}
                          className="rounded border border-brand-cream-3 bg-brand-cream-2 px-1.5 py-0.5 text-[10px] text-brand-ink-2 transition-colors hover:border-brand-red/40 hover:text-brand-red"
                          title={`${vName} — ${formatRupiah(v.sellPrice)}`}
                        >
                          {vName}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function formatRupiah(value: string): string {
  const num = Number(value);
  if (isNaN(num)) return 'Rp 0';
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num);
}