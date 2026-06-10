'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface Option {
  id: string;
  name: Record<string, string>;
}

export function StockLedgerFilter({
  products,
  locations,
  productId,
  locationId,
}: {
  products: Option[];
  locations: Option[];
  productId?: string;
  locationId?: string;
}) {
  const t = useTranslations('inventory.stockLedger');
  const locale = useLocale();
  const router = useRouter();
  const [product, setProduct] = useState(productId ?? '');
  const [location, setLocation] = useState(locationId ?? '');

  const label = (name: Record<string, string>, id: string) => name?.[locale] ?? name?.id ?? id;

  function apply() {
    if (!product || !location) return;
    router.push(
      `/inventory/stock-ledger?productId=${encodeURIComponent(product)}&locationId=${encodeURIComponent(location)}`,
    );
  }

  const selectClass =
    'h-9 w-full rounded-md border border-brand-cream-3 bg-card px-2.5 text-sm text-brand-ink focus:border-brand-red focus:outline-none';

  return (
    <div className="surface-card flex flex-wrap items-end gap-3 p-4">
      <div className="grid w-full gap-1 sm:w-64">
        <label className="text-xs font-semibold text-brand-ink-2">{t('product')}</label>
        <select
          value={product}
          onChange={(e) => setProduct(e.target.value)}
          className={selectClass}
        >
          <option value="">{t('selectProduct')}</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {label(p.name, p.id)}
            </option>
          ))}
        </select>
      </div>
      <div className="grid w-full gap-1 sm:w-64">
        <label className="text-xs font-semibold text-brand-ink-2">{t('location')}</label>
        <select
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          className={selectClass}
        >
          <option value="">{t('selectLocation')}</option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {label(l.name, l.id)}
            </option>
          ))}
        </select>
      </div>
      <button
        type="button"
        onClick={apply}
        disabled={!product || !location}
        className="h-9 rounded-md bg-brand-red px-4 text-sm font-semibold text-white hover:bg-brand-red-dark disabled:opacity-50"
      >
        {t('view')}
      </button>
    </div>
  );
}
