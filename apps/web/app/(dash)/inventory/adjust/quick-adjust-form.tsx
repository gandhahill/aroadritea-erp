'use client';

import { useTranslations } from 'next-intl';
import { useActionState } from 'react';
import { type QuickAdjustData, createQuickAdjustmentAction } from './actions';

const INPUT =
  'h-10 w-full rounded-md border border-brand-cream-3 bg-card px-3 text-sm text-brand-ink focus:border-brand-red focus:outline-none focus:ring-2 focus:ring-brand-red/20';

export function QuickAdjustForm({ data }: { data: QuickAdjustData }) {
  const t = useTranslations('inventory.adjust');
  const [state, action, pending] = useActionState(createQuickAdjustmentAction, null);

  if (data.locations.length === 0 || data.products.length === 0) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
        {t('missingMasterData')}
      </div>
    );
  }

  return (
    <form action={action} className="rounded-xl border border-brand-cream-3 bg-card p-5 shadow-sm">
      {state?.ok ? (
        <div className="mb-4 rounded-lg border border-brand-jade/20 bg-brand-jade-light px-4 py-3 text-sm text-brand-jade">
          {t('success')}
        </div>
      ) : null}
      {state?.error ? (
        <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {state.error}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1.5">
          <span className="text-sm font-medium text-brand-ink">{t('location')}</span>
          <select name="locationId" required defaultValue="" className={INPUT}>
            <option value="" disabled>
              {t('chooseLocation')}
            </option>
            {data.locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.label}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1.5">
          <span className="text-sm font-medium text-brand-ink">{t('reason')}</span>
          <select name="reason" required defaultValue="count_correction" className={INPUT}>
            {['count_correction', 'waste', 'damage', 'opening_balance', 'other'].map((reason) => (
              <option key={reason} value={reason}>
                {t(`reasons.${reason}`)}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1.5 md:col-span-2">
          <span className="text-sm font-medium text-brand-ink">{t('product')}</span>
          <select name="productId" required defaultValue="" className={INPUT}>
            <option value="" disabled>
              {t('chooseProduct')}
            </option>
            {data.products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.label} ({product.uom})
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1.5">
          <span className="text-sm font-medium text-brand-ink">{t('qtyAfter')}</span>
          <input name="qtyAfter" type="number" min="0" step="0.001" required className={INPUT} />
        </label>

        <label className="space-y-1.5">
          <span className="text-sm font-medium text-brand-ink">{t('notes')}</span>
          <input name="notes" placeholder={t('notesPlaceholder')} className={INPUT} />
        </label>
      </div>

      <div className="mt-5 flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-brand-red px-5 py-2 text-sm font-semibold text-white shadow-soft transition-colors hover:bg-brand-red-dark disabled:opacity-50"
        >
          {pending ? t('submitting') : t('submit')}
        </button>
      </div>
    </form>
  );
}
