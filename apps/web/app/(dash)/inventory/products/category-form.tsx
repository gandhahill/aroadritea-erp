'use client';

import { Input } from '@erp/ui';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';
import { createCategoryAction } from './actions';

export function CategoryForm() {
  const t = useTranslations('inventory.categories');
  const [state, submitAction, isPending] = useActionState(createCategory, null);

  async function createCategory(_prev: unknown, formData: FormData) {
    const result = await createCategoryAction(formData);
    if (!result.ok) return { error: result.error ?? t('createFailed') };
    return { ok: true };
  }

  return (
    <form
      action={submitAction}
      className="rounded-xl border border-brand-cream-3 bg-card p-5 shadow-sm"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
        <label className="flex-1 space-y-1.5">
          <span className="text-sm font-medium text-brand-ink">{t('code')}</span>
          <Input name="categoryCode" required placeholder={t('codePlaceholder')} />
        </label>
        <label className="flex-[1.5] space-y-1.5">
          <span className="text-sm font-medium text-brand-ink">{t('nameId')}</span>
          <Input name="categoryNameId" required placeholder={t('namePlaceholderId')} />
        </label>
        <label className="flex-[1.5] space-y-1.5">
          <span className="text-sm font-medium text-brand-ink">{t('nameEn')}</span>
          <Input name="categoryNameEn" placeholder={t('namePlaceholderEn')} />
        </label>
        <label className="flex-[1.5] space-y-1.5">
          <span className="text-sm font-medium text-brand-ink">{t('nameZh')}</span>
          <Input name="categoryNameZh" placeholder={t('namePlaceholderZh')} />
        </label>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-brand-ember-5 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-ember-6 disabled:opacity-50"
        >
          {isPending ? t('saving') : t('add')}
        </button>
      </div>
      {state?.error ? <p className="mt-3 text-sm text-rose-700">{state.error}</p> : null}
      {state?.ok ? <p className="mt-3 text-sm text-brand-jade">{t('saved')}</p> : null}
    </form>
  );
}
