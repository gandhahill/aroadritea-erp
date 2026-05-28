'use client';

import { PageHeader } from '@/components/page-header';
import { Button, Input, Select } from '@erp/ui';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useActionState, useEffect, useState } from 'react';
import { createConsumedIngredientsAction } from './actions';

interface Props {
  data: {
    locations: Array<{ id: string; label: string; code: string }>;
    ingredients: Array<{ id: string; name: string; uom: string }>;
  };
  defaultLocationId: string;
}

export function ConsumedClient({ data, defaultLocationId }: Props) {
  const t = useTranslations('pos.manualSales');
  const [state, submitAction, isPending] = useActionState(createConsumedIngredientsAction, null);
  const [consumedIngredients, setConsumedIngredients] = useState<
    Array<{ ingredientId: string; name: string; qty: number; uom: string }>
  >([]);

  useEffect(() => {
    if (state?.ok) {
      const form = document.getElementById('consumed-ingredients-form') as HTMLFormElement | null;
      form?.reset();
      setConsumedIngredients([]);
    }
  }, [state]);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="h-full w-full overflow-y-auto space-y-6 pb-24 px-4 pt-4">
      <div className="flex items-start justify-between">
        <PageHeader
          title={<>{t('consumedIngredients', { defaultValue: 'Pemakaian Bahan' })}</>}
          description={<>{t('consumedIngredientsDesc', { defaultValue: 'Rekap stok bahan baku yang terpakai.' })}</>}
          eyebrow={<>{t('eyebrow', { defaultValue: 'POS' })}</>}
        />
        <Link 
          href="/pos/manual-sales" 
          className="inline-flex items-center justify-center rounded-lg bg-brand-cream px-4 py-2 text-sm font-semibold text-brand-ink transition-colors hover:bg-brand-cream-2 border border-brand-cream-3"
        >
          &larr; {t('backToSales', { defaultValue: 'Kembali ke Penjualan' })}
        </Link>
      </div>

      <section className="rounded-xl border border-brand-cream-3 bg-card p-5 shadow-sm">
        <form id="consumed-ingredients-form" action={submitAction} className="grid gap-4 lg:grid-cols-4">
          <Field label={t('location')}>
            <Select name="locationId" defaultValue={defaultLocationId} required>
              {data.locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('date', { defaultValue: 'Tanggal' })}>
            <Input name="date" type="date" defaultValue={today} required />
          </Field>
          
          <div className="lg:col-span-4 rounded-xl border border-brand-cream-3 p-4 mt-4">
            <h3 className="mb-3 text-sm font-semibold text-brand-ink">{t('consumedIngredients')}</h3>
            <div className="space-y-3">
              {consumedIngredients.map((item, index) => (
                <div
                  key={index}
                  className="flex flex-wrap items-end gap-3 rounded-lg border border-brand-cream-3 bg-brand-cream-2/50 p-3"
                >
                  <div className="flex-1 min-w-[200px]">
                    <span className="mb-1.5 block text-xs font-medium text-brand-ink-3">
                      {t('ingredient', { defaultValue: 'Bahan Baku' })}
                    </span>
                    <Select
                      value={item.ingredientId}
                      onChange={(e) => {
                        const ingredient = data.ingredients.find((p) => p.id === e.target.value);
                        if (!ingredient) return;
                        const newItems = [...consumedIngredients];
                        newItems[index] = {
                          ingredientId: ingredient.id,
                          name: ingredient.name,
                          qty: newItems[index]?.qty || 1,
                          uom: ingredient.uom,
                        };
                        setConsumedIngredients(newItems);
                      }}
                    >
                      <option value="" disabled>
                        {t('selectIngredient', { defaultValue: 'Pilih Bahan Baku...' })}
                      </option>
                      {data.ingredients.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.uom})
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="w-24">
                    <span className="mb-1.5 block text-xs font-medium text-brand-ink-3">
                      {t('qty')}
                    </span>
                    <Input
                      type="number"
                      min={1}
                      step="1"
                      value={item.qty}
                      onKeyDown={(e) => {
                        if (['.', ',', 'e', 'E', '+', '-'].includes(e.key)) {
                          e.preventDefault();
                        }
                      }}
                      onChange={(e) => {
                        const qty = Math.max(1, Number.parseInt(e.target.value, 10) || 1);
                        const newItems = [...consumedIngredients];
                        newItems[index] = { ...newItems[index]!, qty };
                        setConsumedIngredients(newItems);
                      }}
                    />
                  </div>
                  <div className="w-24">
                    <span className="mb-1.5 block text-xs font-medium text-brand-ink-3">
                      {t('uom')}
                    </span>
                    <Input type="text" readOnly value={item.uom} className="bg-brand-cream/50" />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-brand-red mb-1"
                    onClick={() => {
                      setConsumedIngredients(consumedIngredients.filter((_, i) => i !== index));
                    }}
                  >
                    {t('delete')}
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setConsumedIngredients([
                    ...consumedIngredients,
                    { ingredientId: '', name: '', qty: 1, uom: '' },
                  ]);
                }}
              >
                + {t('addIngredient', { defaultValue: 'Tambah Bahan Baku' })}
              </Button>
            </div>
            <input
              type="hidden"
              name="consumedIngredientsJson"
              value={JSON.stringify(consumedIngredients.filter((i) => i.ingredientId))}
            />
          </div>

          <div className="lg:col-span-4 flex items-end">
            <Button
              type="submit"
              disabled={isPending || consumedIngredients.filter(i => i.ingredientId).length === 0}
              className="w-full rounded-lg bg-brand-red px-5 py-2.5 text-sm font-semibold text-white shadow-soft transition-colors hover:bg-brand-red-dark disabled:opacity-50"
              variant="primary"
              size="lg"
            >
              {isPending ? t('posting') : t('post')}
            </Button>
          </div>
          {state?.error ? (
            <div className="lg:col-span-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {state.error}
            </div>
          ) : null}
          {state?.ok ? (
            <div className="lg:col-span-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {t('posted')}
            </div>
          ) : null}
        </form>
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-brand-ink">{label}</span>
      {children}
    </label>
  );
}
