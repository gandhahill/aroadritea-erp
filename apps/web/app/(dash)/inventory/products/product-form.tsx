'use client';

import { FileUploadField } from '@/components/file-upload-field';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect } from 'react';
import { createProductAction, updateProductAction } from './actions';
import type { ProductCategoryOption, ProductFormInitial, ProductKind } from './product-types';

const INPUT =
  'w-full rounded-lg border border-brand-cream-3 bg-brand-cream px-3 py-2 text-sm text-brand-ink shadow-sm transition-colors placeholder:text-brand-ink-3/60 focus:border-brand-ember-5 focus:outline-none focus:ring-1 focus:ring-brand-ember-5';

interface Props {
  mode: 'create' | 'edit';
  categories: ProductCategoryOption[];
  product?: ProductFormInitial | null;
  /** When creating a new product, pre-select this kind (used by /inventory/supplies). */
  defaultKind?: ProductKind;
}

export function ProductForm({ mode, categories, product, defaultKind }: Props) {
  const router = useRouter();
  const t = useTranslations('inventory.products');
  const f = useTranslations('inventory.products.form');
  const action = mode === 'create' ? createProductAction : updateProductAction;
  const [state, submitAction, isPending] = useActionState(action, null);

  const KIND_OPTIONS: Array<{ value: ProductKind; label: string }> = [
    { value: 'finished_good', label: f('kindFinishedGood') },
    { value: 'raw_material', label: f('kindRawMaterial') },
    { value: 'merchandise', label: f('kindMerchandise') },
    { value: 'consumable', label: f('kindConsumable') },
    { value: 'service', label: f('kindService') },
  ];

  useEffect(() => {
    if (!state?.ok || !state.productId) return;
    router.push(`/inventory/products/${state.productId}`);
    router.refresh();
  }, [router, state]);

  return (
    <form action={submitAction} className="space-y-6">
      {product ? (
        <>
          <input type="hidden" name="productId" value={product.id} />
          <input type="hidden" name="version" value={product.version} />
        </>
      ) : null}

      {state?.error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {state.error}
        </div>
      ) : null}

      <section className="rounded-xl border border-brand-cream-3 bg-card p-5 shadow-sm">
        <h2 className="text-base font-semibold text-brand-ink">{f('identitySection')}</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <Field label={f('sku')} required>
            <input
              name="sku"
              required
              readOnly={mode === 'edit'}
              defaultValue={product?.sku ?? ''}
              className={`${INPUT} ${mode === 'edit' ? 'bg-brand-cream-1 text-brand-ink-3' : ''}`}
            />
          </Field>
          <Field label={f('category')} required>
            <select
              name="categoryId"
              required
              defaultValue={product?.categoryId ?? categories[0]?.id ?? ''}
              className={INPUT}
            >
              {categories.length === 0 ? (
                <option value="">{t('createCategory')}</option>
              ) : (
                categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.code} - {category.name.id}
                  </option>
                ))
              )}
            </select>
          </Field>
          <Field label={f('name')} required>
            <input
              name="nameEn"
              required
              defaultValue={product?.name.en ?? product?.name.id ?? ''}
              placeholder="e.g. Brown Sugar Milk Tea"
              className={INPUT}
            />
            <p className="mt-1 text-[11px] text-brand-ink-3">{f('nameHint')}</p>
          </Field>
          <Field label={f('kind')} required>
            <select
              name="kind"
              required
              defaultValue={product?.kind ?? defaultKind ?? 'finished_good'}
              className={INPUT}
            >
              {KIND_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label={f('uom')} required>
            <input name="uom" required defaultValue={product?.uom ?? 'pcs'} className={INPUT} />
          </Field>
          <Field label={f('taxCode')}>
            <input name="taxCode" defaultValue={product?.taxCode ?? ''} className={INPUT} />
          </Field>
        </div>
        <div className="mt-4">
          <FileUploadField
            label={f('image')}
            hiddenName="imageUrl"
            value={product?.imageUrl}
            area="product-images"
            visibility="public"
            accept="image/*"
            imageOnly
          />
        </div>
      </section>

      <section className="rounded-xl border border-brand-cream-3 bg-card p-5 shadow-sm">
        <h2 className="text-base font-semibold text-brand-ink">{f('descriptionSection')}</h2>
        <div className="mt-5">
          <TextArea
            label={f('description')}
            name="descriptionEn"
            value={product?.description?.en ?? product?.description?.id ?? ''}
          />
          <p className="mt-1 text-[11px] text-brand-ink-3">{f('nameHint')}</p>
        </div>
      </section>

      <section className="rounded-xl border border-brand-cream-3 bg-card p-5 shadow-sm">
        <h2 className="text-base font-semibold text-brand-ink">{f('pricingSection')}</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <Field label={f('sellPrice')}>
            <input
              name="defaultSellPrice"
              inputMode="numeric"
              defaultValue={product?.defaultSellPrice ?? '0'}
              className={INPUT}
            />
          </Field>
          <Field label={f('costPrice')}>
            <input
              name="defaultCostPrice"
              inputMode="numeric"
              defaultValue={product?.defaultCostPrice ?? '0'}
              className={INPUT}
            />
          </Field>
          <Field label={f('shelfLife')}>
            <input
              name="shelfLifeDays"
              type="number"
              min={1}
              defaultValue={product?.shelfLifeDays ?? ''}
              className={INPUT}
            />
          </Field>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Toggle
            name="isSellable"
            label={f('isSellable')}
            defaultChecked={product?.isSellable ?? true}
          />
          <Toggle
            name="isPurchasable"
            label={f('isPurchasable')}
            defaultChecked={product?.isPurchasable ?? false}
          />
          <Toggle
            name="trackBatch"
            label={f('trackBatch')}
            defaultChecked={product?.trackBatch ?? false}
          />
          <Toggle
            name="trackExpiry"
            label={f('trackExpiry')}
            defaultChecked={product?.trackExpiry ?? false}
          />
          {mode === 'edit' ? (
            <Toggle name="isActive" label={f('isActive')} defaultChecked={product?.isActive ?? true} />
          ) : null}
        </div>
      </section>

      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={() => router.push('/inventory/products')}
          className="rounded-lg border border-brand-cream-3 bg-brand-cream px-4 py-2 text-sm font-semibold text-brand-ink transition-colors hover:bg-brand-cream-1"
        >
          {t('cancel')}
        </button>
        <button
          type="submit"
          disabled={isPending || categories.length === 0}
          className="rounded-lg bg-brand-red px-5 py-2 text-sm font-semibold text-white shadow-soft transition-colors hover:bg-brand-red-dark disabled:opacity-50"
        >
          {isPending ? t('saving') : mode === 'create' ? t('saveProduct') : t('saveChanges')}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="block space-y-1.5">
      <p className="text-sm font-medium text-brand-ink">
        {label} {required ? <span className="text-brand-red">*</span> : null}
      </p>
      {children}
    </div>
  );
}

function TextArea({ label, name, value }: { label: string; name: string; value: string }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-brand-ink">{label}</span>
      <textarea name={name} rows={4} defaultValue={value} className={INPUT} />
    </label>
  );
}

function Toggle({
  name,
  label,
  defaultChecked,
}: {
  name: string;
  label: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="flex items-center gap-3 rounded-lg border border-brand-cream-3 bg-brand-cream px-3 py-2 text-sm font-medium text-brand-ink">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="h-4 w-4 rounded border-brand-cream-3 text-brand-red focus:ring-brand-red"
      />
      {label}
    </label>
  );
}
