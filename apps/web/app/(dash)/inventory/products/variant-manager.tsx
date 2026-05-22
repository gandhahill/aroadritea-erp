'use client';

import type { VariantResult } from '@erp/services/inventory';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';
import { createVariantAction, toggleVariantStatusAction } from './actions';

const INPUT =
  'w-full rounded-lg border border-brand-cream-3 bg-card px-3 py-2 text-sm text-brand-ink shadow-sm transition-colors placeholder:text-brand-ink-3/60 focus:border-brand-ember-5 focus:outline-none focus:ring-1 focus:ring-brand-ember-5';

export function VariantManager({
  productId,
  variants,
}: { productId: string; variants: VariantResult[] }) {
  const tc = useTranslations('common');
  const tp = useTranslations('inventory.products');
  const [state, submitAction, isPending] = useActionState(createVariantAction, null);

  return (
    <section className="rounded-xl border border-brand-cream-3 bg-card p-5 shadow-sm">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold text-brand-ink">{tp('variantPrice')}</h2>
        <p className="text-sm text-brand-ink-3">
          {tp('variantDesc')}
        </p>
      </div>

      <div className="mt-5 overflow-hidden rounded-lg border border-brand-cream-3">
        <table className="min-w-full divide-y divide-brand-cream-3 text-sm">
          <thead className="bg-brand-cream-1 text-left text-xs font-semibold uppercase tracking-wider text-brand-ink-3">
            <tr>
              <th className="px-4 py-3">{tc('fields.sku')}</th>
              <th className="px-4 py-3">{tc('fields.name')}</th>
              <th className="px-4 py-3">{tc('fields.attributes')}</th>
              <th className="px-4 py-3 text-right">{tc('fields.price')}</th>
              <th className="px-4 py-3">{tc('fields.status')}</th>
              <th className="px-4 py-3 text-right">{tc('fields.actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-cream-3 bg-card">
            {variants.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-brand-ink-3">
                  {tp('emptyVariants')}
                </td>
              </tr>
            ) : (
              variants.map((variant) => (
                <tr key={variant.id}>
                  <td className="px-4 py-3 font-mono text-xs text-brand-ink">{variant.sku}</td>
                  <td className="px-4 py-3 font-medium text-brand-ink">{variant.name.id}</td>
                  <td className="px-4 py-3 text-brand-ink-3">
                    {Object.entries(variant.attributes)
                      .map(([key, value]) => `${key}: ${value}`)
                      .join(', ') || '-'}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-brand-ink">
                    {formatRupiah(variant.sellPrice)}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-brand-jade-light px-2 py-1 text-xs font-semibold text-brand-jade">
                      {variant.isActive ? tc('status.active') : tc('status.inactive')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <form action={toggleVariantStatusAction}>
                      <input type="hidden" name="productId" value={productId} />
                      <input type="hidden" name="variantId" value={variant.id} />
                      <input type="hidden" name="version" value={variant.version} />
                      <input
                        type="hidden"
                        name="isActive"
                        value={variant.isActive ? 'false' : 'true'}
                      />
                      <button
                        type="submit"
                        className="rounded-lg border border-brand-cream-3 px-3 py-1.5 text-xs font-semibold text-brand-ink hover:bg-brand-cream-2"
                      >
                        {variant.isActive ? tc('labels.deactivate') : tc('labels.activate')}
                      </button>
                    </form>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <form action={submitAction} className="mt-5 grid gap-4 lg:grid-cols-6">
        <input type="hidden" name="productId" value={productId} />
        <label className="space-y-1.5 lg:col-span-1">
          <span className="text-sm font-medium text-brand-ink">{tp('skuVariant')}</span>
          <input name="variantSku" required className={INPUT} />
        </label>
        <label className="space-y-1.5 lg:col-span-2">
          <span className="text-sm font-medium text-brand-ink">{tp('variantName')}</span>
          <input name="variantNameId" required placeholder="Regular Cold" className={INPUT} />
          <input type="hidden" name="variantNameEn" value="" />
          <input type="hidden" name="variantNameZh" value="" />
        </label>
        <label className="space-y-1.5 lg:col-span-1">
          <span className="text-sm font-medium text-brand-ink">{tp('size')}</span>
          <select name="size" className={INPUT}>
            <option value="">-</option>
            <option value="Regular">Regular</option>
            <option value="Large">Large</option>
            <option value="Small">Small</option>
          </select>
        </label>
        <label className="space-y-1.5 lg:col-span-1">
          <span className="text-sm font-medium text-brand-ink">{tp('temp')}</span>
          <select name="temp" className={INPUT}>
            <option value="">-</option>
            <option value="Hot">Hot</option>
            <option value="Cold">Cold</option>
            <option value="Warm">Warm</option>
            <option value="Ice">Ice</option>
          </select>
        </label>
        <label className="space-y-1.5 lg:col-span-1">
          <span className="text-sm font-medium text-brand-ink">{tp('sellingPrice')}</span>
          <input name="variantSellPrice" type="number" required min={0} className={INPUT} />
        </label>
        <label className="space-y-1.5 lg:col-span-1">
          <span className="text-sm font-medium text-brand-ink">{tp('costPrice')}</span>
          <input
            name="variantCostPrice"
            type="number"
            required
            min={0}
            defaultValue={0}
            className={INPUT}
          />
        </label>
        <label className="space-y-1.5 lg:col-span-1">
          <span className="text-sm font-medium text-brand-ink">{tp('order')}</span>
          <input name="variantSortOrder" type="number" required min={0} defaultValue={0} className={INPUT} />
        </label>
        <div className="flex items-end lg:col-span-2">
          <button
            type="submit"
            disabled={isPending}
            className="w-full rounded-lg bg-brand-red px-4 py-2 font-semibold text-white shadow-sm hover:bg-brand-red-dark disabled:opacity-70"
          >
            {isPending ? tc('actions.saving') : tp('addVariant')}
          </button>
        </div>
      </form>
      {state?.error ? <p className="mt-3 text-sm text-rose-700">{state.error}</p> : null}
    </section>
  );
}

function formatRupiah(value: string) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(Number(value));
}
