'use client';

import type { VariantResult } from '@erp/services/inventory';
import { useActionState } from 'react';
import { createVariantAction } from './actions';

const INPUT =
  'w-full rounded-lg border border-brand-cream-3 bg-white px-3 py-2 text-sm text-brand-ink shadow-sm transition-colors placeholder:text-brand-ink-3/60 focus:border-brand-ember-5 focus:outline-none focus:ring-1 focus:ring-brand-ember-5';

export function VariantManager({
  productId,
  variants,
}: { productId: string; variants: VariantResult[] }) {
  const [state, submitAction, isPending] = useActionState(createVariantAction, null);

  return (
    <section className="rounded-xl border border-brand-cream-3 bg-card p-5 shadow-sm">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold text-brand-ink">Varian harga</h2>
        <p className="text-sm text-brand-ink-3">
          Gunakan untuk Regular/Large dan Hot/Cold. Harga varian dipakai POS saat tersedia.
        </p>
      </div>

      <div className="mt-5 overflow-hidden rounded-lg border border-brand-cream-3">
        <table className="min-w-full divide-y divide-brand-cream-3 text-sm">
          <thead className="bg-brand-cream-1 text-left text-xs font-semibold uppercase tracking-wider text-brand-ink-3">
            <tr>
              <th className="px-4 py-3">SKU</th>
              <th className="px-4 py-3">Nama</th>
              <th className="px-4 py-3">Atribut</th>
              <th className="px-4 py-3 text-right">Harga</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-cream-3 bg-white">
            {variants.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-brand-ink-3">
                  Belum ada varian.
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
                      {variant.isActive ? 'Aktif' : 'Nonaktif'}
                    </span>
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
          <span className="text-sm font-medium text-brand-ink">SKU varian</span>
          <input name="variantSku" required className={INPUT} />
        </label>
        <label className="space-y-1.5 lg:col-span-2">
          <span className="text-sm font-medium text-brand-ink">Nama varian</span>
          <input name="variantNameId" required placeholder="Regular Cold" className={INPUT} />
          <input type="hidden" name="variantNameEn" value="" />
          <input type="hidden" name="variantNameZh" value="" />
        </label>
        <label className="space-y-1.5">
          <span className="text-sm font-medium text-brand-ink">Ukuran</span>
          <select name="size" className={INPUT}>
            <option value="">-</option>
            <option value="regular">Regular</option>
            <option value="large">Large</option>
          </select>
        </label>
        <label className="space-y-1.5">
          <span className="text-sm font-medium text-brand-ink">Suhu</span>
          <select name="temperature" className={INPUT}>
            <option value="">-</option>
            <option value="cold">Cold</option>
            <option value="hot">Hot</option>
          </select>
        </label>
        <label className="space-y-1.5">
          <span className="text-sm font-medium text-brand-ink">Harga jual</span>
          <input name="variantSellPrice" inputMode="numeric" required className={INPUT} />
        </label>
        <label className="space-y-1.5">
          <span className="text-sm font-medium text-brand-ink">Harga modal</span>
          <input name="variantCostPrice" inputMode="numeric" defaultValue="0" className={INPUT} />
        </label>
        <label className="space-y-1.5">
          <span className="text-sm font-medium text-brand-ink">Urutan</span>
          <input name="variantSortOrder" type="number" min={0} defaultValue="0" className={INPUT} />
        </label>
        <div className="flex items-end">
          <button
            type="submit"
            disabled={isPending}
            className="w-full rounded-lg bg-brand-ember-5 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-ember-6 disabled:opacity-50"
          >
            {isPending ? 'Menyimpan...' : 'Tambah varian'}
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
