'use client';

import { useActionState } from 'react';
import { createCategoryAction } from './actions';

const INPUT =
  'w-full rounded-lg border border-brand-cream-3 bg-white px-3 py-2 text-sm text-brand-ink shadow-sm transition-colors placeholder:text-brand-ink-3/60 focus:border-brand-ember-5 focus:outline-none focus:ring-1 focus:ring-brand-ember-5';

export function CategoryForm() {
  const [state, submitAction, isPending] = useActionState(createCategory, null);

  async function createCategory(_prev: unknown, formData: FormData) {
    const result = await createCategoryAction(formData);
    if (!result.ok) return { error: result.error ?? 'Gagal membuat kategori' };
    return { ok: true };
  }

  return (
    <form
      action={submitAction}
      className="rounded-xl border border-brand-cream-3 bg-card p-5 shadow-sm"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
        <label className="flex-1 space-y-1.5">
          <span className="text-sm font-medium text-brand-ink">Kode kategori</span>
          <input name="categoryCode" required placeholder="TEA" className={INPUT} />
        </label>
        <label className="flex-[2] space-y-1.5">
          <span className="text-sm font-medium text-brand-ink">Nama kategori</span>
          <input name="categoryNameId" required placeholder="Teh" className={INPUT} />
          <input type="hidden" name="categoryNameEn" value="" />
          <input type="hidden" name="categoryNameZh" value="" />
        </label>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-brand-ember-5 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-ember-6 disabled:opacity-50"
        >
          {isPending ? 'Menyimpan...' : 'Tambah kategori'}
        </button>
      </div>
      {state?.error ? <p className="mt-3 text-sm text-rose-700">{state.error}</p> : null}
      {state?.ok ? <p className="mt-3 text-sm text-brand-jade">Kategori tersimpan.</p> : null}
    </form>
  );
}
