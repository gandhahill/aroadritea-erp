'use client';

import { useTranslations } from 'next-intl';
import { useActionState } from 'react';
import { createSupplierAction } from './actions';

const INPUT =
  'w-full rounded-lg border border-brand-cream-3 bg-card px-3 py-2 text-sm text-brand-ink shadow-sm transition-colors placeholder:text-brand-ink-3/60 focus:border-brand-ember-5 focus:outline-none focus:ring-1 focus:ring-brand-ember-5';

export function SupplierForm() {
  const t = useTranslations('purchasing');
  const [state, action, pending] = useActionState(createSupplierAction, { success: false });

  return (
    <form
      action={action}
      className="space-y-4 rounded-xl border border-brand-cream-3 bg-card p-5 shadow-sm"
    >
      <div>
        <h2 className="text-base font-semibold text-brand-ink">{t('addSupplier')}</h2>
        <p className="mt-1 text-sm text-brand-ink-3">{t('addSupplierHelp')}</p>
      </div>

      {state.error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {state.error}
        </div>
      ) : null}
      {state.success ? (
        <div className="rounded-lg border border-brand-jade/30 bg-brand-jade/10 px-3 py-2 text-sm text-brand-jade">
          {t('supplierSaved')}
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2">
        <label className="space-y-1.5">
          <span className="text-sm font-medium text-brand-ink">{t('supplierName')}</span>
          <input name="supplierName" required className={INPUT} />
        </label>
        <label className="space-y-1.5">
          <span className="text-sm font-medium text-brand-ink">Email</span>
          <input name="supplierEmail" type="email" className={INPUT} />
        </label>
        <label className="space-y-1.5">
          <span className="text-sm font-medium text-brand-ink">{t('phone')}</span>
          <input name="supplierPhone" className={INPUT} />
        </label>
        <label className="space-y-1.5">
          <span className="text-sm font-medium text-brand-ink">{t('paymentTermsDays')}</span>
          <input name="paymentTermsDays" type="number" min="0" defaultValue="0" className={INPUT} />
        </label>
      </div>

      <label className="space-y-1.5">
        <span className="text-sm font-medium text-brand-ink">{t('address')}</span>
        <textarea name="supplierAddress" rows={3} className={INPUT} />
      </label>

      <label className="flex items-center gap-2 text-sm font-medium text-brand-ink">
        <input
          name="supplierIsPkp"
          type="checkbox"
          className="h-4 w-4 rounded border-brand-cream-3 text-brand-red focus:ring-brand-red"
        />
        {t('supplierPkp')}
      </label>

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-brand-red px-5 py-2 text-sm font-semibold text-white shadow-soft transition-colors hover:bg-brand-red-dark disabled:opacity-50"
      >
        {pending ? t('saving') : t('saveSupplier')}
      </button>
    </form>
  );
}
