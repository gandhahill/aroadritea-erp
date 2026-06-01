'use client';

import { Button, Input, Select } from '@erp/ui';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';
import { type QuickAdjustData, createQuickAdjustmentAction } from './actions';

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
          <Select name="locationId" required defaultValue="">
            <option value="" disabled>
              {t('chooseLocation')}
            </option>
            {data.locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.label}
              </option>
            ))}
          </Select>
        </label>

        <label className="space-y-1.5">
          <span className="text-sm font-medium text-brand-ink">{t('reason')}</span>
          <Select name="reason" required defaultValue="count_correction">
            {['count_correction', 'waste', 'damage', 'opening_balance', 'other'].map((reason) => (
              <option key={reason} value={reason}>
                {t(`reasons.${reason}`)}
              </option>
            ))}
          </Select>
        </label>

        <label className="space-y-1.5 md:col-span-2">
          <span className="text-sm font-medium text-brand-ink">{t('product')}</span>
          <Select name="productId" required defaultValue="">
            <option value="" disabled>
              {t('chooseProduct')}
            </option>
            {data.products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.label} ({product.uom})
              </option>
            ))}
          </Select>
        </label>

        <label className="space-y-1.5">
          <span className="text-sm font-medium text-brand-ink">{t('qtyAfter')}</span>
          <Input name="qtyAfter" type="number" min="0" step="0.001" required />
        </label>

        <label className="space-y-1.5">
          <span className="text-sm font-medium text-brand-ink">{t('batchNo')}</span>
          <Input name="batchNo" placeholder={t('batchNoPlaceholder')} />
        </label>

        <label className="space-y-1.5">
          <span className="text-sm font-medium text-brand-ink">{t('expiryDate')}</span>
          <Input name="expiryDate" type="date" />
        </label>

        <label className="space-y-1.5">
          <span className="text-sm font-medium text-brand-ink">{t('notes')}</span>
          <Input name="notes" placeholder={t('notesPlaceholder')} />
        </label>
      </div>

      <div className="mt-5 flex justify-end">
        <Button
          type="submit"
          disabled={pending}
          className="rounded-lg "
          variant="primary"
          size="lg"
        >
          {pending ? t('submitting') : t('submit')}
        </Button>
      </div>
    </form>
  );
}
