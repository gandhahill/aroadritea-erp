'use client';

import type { VariantResult } from '@erp/services/inventory';
import {
  Button,
  Input,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
} from '@erp/ui';
import { useTranslations } from 'next-intl';
import { useActionState, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { createVariantAction, toggleVariantStatusAction, updateVariantAction } from './actions';

export function VariantManager({
  productId,
  variants,
  defaultCostPrice,
}: { productId: string; variants: VariantResult[]; defaultCostPrice?: string }) {
  const tc = useTranslations('common');
  const tp = useTranslations('inventory.products');
  const [createState, submitCreate, isCreating] = useActionState(createVariantAction, null);
  const [editState, submitEdit, isEditing] = useActionState(updateVariantAction, null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editSellPrice, setEditSellPrice] = useState('');
  const [editCostPrice, setEditCostPrice] = useState('');
  const [values, setValues] = useState({
    variantSku: '',
    variantNameId: '',
    size: '',
    temp: '',
    variantSellPrice: '',
    variantCostPrice: defaultCostPrice || '0',
    variantSortOrder: '0',
  });

  useEffect(() => {
    if (!createState?.ok) return;
    setValues({
      variantSku: '',
      variantNameId: '',
      size: '',
      temp: '',
      variantSellPrice: '',
      variantCostPrice: defaultCostPrice || '0',
      variantSortOrder: '0',
    });
  }, [createState?.ok, defaultCostPrice]);

  useEffect(() => {
    if (!editState?.ok) return;
    setEditingId(null);
  }, [editState?.ok]);

  function updateValue(key: keyof typeof values, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function fieldError(...keys: string[]): string | null {
    for (const key of keys) {
      const message = createState?.fieldErrors?.[key];
      if (message) return message;
    }
    return null;
  }

  function startEdit(variant: VariantResult) {
    setEditingId(variant.id);
    setEditSellPrice(variant.sellPrice);
    setEditCostPrice(variant.costPrice);
  }

  function cancelEdit() {
    setEditingId(null);
  }

  return (
    <section className="rounded-xl border border-brand-cream-3 bg-card p-5 shadow-sm">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold text-brand-ink">{tp('variantPrice')}</h2>
        <p className="text-sm text-brand-ink-3">{tp('variantDesc')}</p>
      </div>

      <div className="mt-5 overflow-hidden rounded-lg border border-brand-cream-3">
        <Table>
          <TableHeader>
            <tr>
              <TableHead className="px-4 py-3">{tc('fields.sku')}</TableHead>
              <TableHead className="px-4 py-3">{tc('fields.name')}</TableHead>
              <TableHead className="px-4 py-3">{tc('fields.attributes')}</TableHead>
              <TableHead className="px-4 py-3 text-right">{tp('sellingPrice')}</TableHead>
              <TableHead className="px-4 py-3 text-right">{tp('costPrice')}</TableHead>
              <TableHead className="px-4 py-3 text-right">{tp('margin', { defaultValue: 'Margin' })}</TableHead>
              <TableHead className="px-4 py-3">{tc('fields.status')}</TableHead>
              <TableHead className="px-4 py-3 text-right">{tc('fields.actions')}</TableHead>
            </tr>
          </TableHeader>
          <TableBody>
            {variants.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-brand-ink-3">
                  {tp('emptyVariants')}
                </td>
              </tr>
            ) : (
              variants.map((variant) => {
                const isEditingThis = editingId === variant.id;
                const sell = Number(isEditingThis ? editSellPrice : variant.sellPrice);
                const cost = Number(isEditingThis ? editCostPrice : variant.costPrice);
                const margin = sell > 0 ? ((sell - cost) / sell) * 100 : 0;
                const marginColor = margin < 15 ? 'text-rose-600' : margin < 30 ? 'text-amber-600' : 'text-brand-jade';

                return (
                  <tr key={variant.id}>
                    <TableCell className="px-4 py-3 font-mono text-xs text-brand-ink">
                      {variant.sku}
                    </TableCell>
                    <TableCell className="px-4 py-3 font-medium text-brand-ink">
                      {variant.name.id}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-brand-ink-3">
                      {Object.entries(variant.attributes)
                        .map(([key, value]) => `${key}: ${value}`)
                        .join(', ') || '-'}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-right">
                      {isEditingThis ? (
                        <Input
                          name="editSellPrice"
                          type="number"
                          min={0}
                          value={editSellPrice}
                          onChange={(e) => setEditSellPrice(e.target.value)}
                          className="w-28 text-right"
                        />
                      ) : (
                        <span className="font-semibold text-brand-ink">{formatRupiah(variant.sellPrice)}</span>
                      )}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-right">
                      {isEditingThis ? (
                        <Input
                          name="editCostPrice"
                          type="number"
                          min={0}
                          value={editCostPrice}
                          onChange={(e) => setEditCostPrice(e.target.value)}
                          className="w-28 text-right"
                        />
                      ) : (
                        <span className="text-brand-ink-2">{formatRupiah(variant.costPrice)}</span>
                      )}
                    </TableCell>
                    <TableCell className={`px-4 py-3 text-right text-sm font-medium ${marginColor}`}>
                      {margin.toFixed(1)}%
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <span className={`rounded-full px-2 py-1 text-xs font-semibold ${
                        variant.isActive
                          ? 'bg-brand-jade-light text-brand-jade'
                          : 'bg-rose-50 text-rose-600'
                      }`}>
                        {variant.isActive ? tc('status.active') : tc('status.inactive')}
                      </span>
                    </TableCell>
                    <TableCell className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {isEditingThis ? (
                          <>
                            <form action={submitEdit}>
                              <input type="hidden" name="productId" value={productId} />
                              <input type="hidden" name="variantId" value={variant.id} />
                              <input type="hidden" name="version" value={variant.version} />
                              <input type="hidden" name="editSellPrice" value={editSellPrice} />
                              <input type="hidden" name="editCostPrice" value={editCostPrice} />
                              <button
                                type="submit"
                                disabled={isEditing}
                                className="rounded-lg border border-brand-jade bg-brand-jade-light px-3 py-1.5 text-xs font-semibold text-brand-jade hover:bg-brand-jade/10 disabled:opacity-50"
                              >
                                {isEditing ? tc('actions.saving') : tc('actions.save')}
                              </button>
                            </form>
                            <button
                              type="button"
                              onClick={cancelEdit}
                              className="rounded-lg border border-brand-cream-3 px-3 py-1.5 text-xs font-semibold text-brand-ink-3 hover:bg-brand-cream-2"
                            >
                              {tc('actions.cancel')}
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => startEdit(variant)}
                              className="rounded-lg border border-brand-cream-3 px-3 py-1.5 text-xs font-semibold text-brand-ink hover:bg-brand-cream-2"
                            >
                              {tc('actions.edit', { defaultValue: 'Edit' })}
                            </button>
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
                                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                                  variant.isActive
                                    ? 'border-rose-200 text-rose-600 hover:bg-rose-50'
                                    : 'border-brand-jade text-brand-jade hover:bg-brand-jade-light'
                                }`}
                              >
                                {variant.isActive ? tc('labels.deactivate') : tc('labels.activate')}
                              </button>
                            </form>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </tr>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {editState?.error ? <p className="mt-3 text-sm text-rose-700">{editState.error}</p> : null}

      <form action={submitCreate} className="mt-5 grid gap-4 lg:grid-cols-6">
        <input type="hidden" name="productId" value={productId} />
        <label htmlFor="variantSku" className="space-y-1.5 lg:col-span-1">
          <span className="text-sm font-medium text-brand-ink">{tp('skuVariant')}</span>
          <Input
            id="variantSku"
            name="variantSku"
            required
            value={values.variantSku}
            onChange={(event) => updateValue('variantSku', event.target.value)}
          />
          {fieldError('sku') ? <ErrorText>{fieldError('sku')}</ErrorText> : null}
        </label>
        <label htmlFor="variantNameId" className="space-y-1.5 lg:col-span-2">
          <span className="text-sm font-medium text-brand-ink">{tp('variantName')}</span>
          <Input
            id="variantNameId"
            name="variantNameId"
            required
            placeholder="Regular Cold"
            value={values.variantNameId}
            onChange={(event) => updateValue('variantNameId', event.target.value)}
          />
          <input type="hidden" name="variantNameEn" value="" />
          <input type="hidden" name="variantNameZh" value="" />
          {fieldError('name.id', 'name.en', 'name.zh') ? (
            <ErrorText>{fieldError('name.id', 'name.en', 'name.zh')}</ErrorText>
          ) : null}
        </label>
        <label htmlFor="size" className="space-y-1.5 lg:col-span-1">
          <span className="text-sm font-medium text-brand-ink">{tp('size')}</span>
          <Select
            id="size"
            name="size"
            value={values.size}
            onChange={(event) => updateValue('size', event.target.value)}
          >
            <option value="">-</option>
            <option value="Regular">Regular</option>
            <option value="Large">Large</option>
            <option value="Small">Small</option>
          </Select>
        </label>
        <label htmlFor="temp" className="space-y-1.5 lg:col-span-1">
          <span className="text-sm font-medium text-brand-ink">{tp('temp')}</span>
          <Select
            id="temp"
            name="temp"
            value={values.temp}
            onChange={(event) => updateValue('temp', event.target.value)}
          >
            <option value="">-</option>
            <option value="Hot">Hot</option>
            <option value="Cold">Cold</option>
            <option value="Warm">Warm</option>
            <option value="Ice">Ice</option>
          </Select>
        </label>
        <label htmlFor="variantSellPrice" className="space-y-1.5 lg:col-span-1">
          <span className="text-sm font-medium text-brand-ink">{tp('sellingPrice')}</span>
          <Input
            id="variantSellPrice"
            name="variantSellPrice"
            type="number"
            required
            min={0}
            value={values.variantSellPrice}
            onChange={(event) => updateValue('variantSellPrice', event.target.value)}
          />
          {fieldError('sellPrice') ? <ErrorText>{fieldError('sellPrice')}</ErrorText> : null}
        </label>
        <label htmlFor="variantCostPrice" className="space-y-1.5 lg:col-span-1">
          <span className="text-sm font-medium text-brand-ink">{tp('costPrice')}</span>
          <Input
            id="variantCostPrice"
            name="variantCostPrice"
            type="number"
            required
            min={0}
            value={values.variantCostPrice}
            onChange={(event) => updateValue('variantCostPrice', event.target.value)}
          />
          {fieldError('costPrice') ? <ErrorText>{fieldError('costPrice')}</ErrorText> : null}
        </label>
        <label htmlFor="variantSortOrder" className="space-y-1.5 lg:col-span-1">
          <span className="text-sm font-medium text-brand-ink">{tp('order')}</span>
          <Input
            id="variantSortOrder"
            name="variantSortOrder"
            type="number"
            required
            min={0}
            value={values.variantSortOrder}
            onChange={(event) => updateValue('variantSortOrder', event.target.value)}
          />
          {fieldError('sortOrder') ? <ErrorText>{fieldError('sortOrder')}</ErrorText> : null}
        </label>
        <div className="flex items-end lg:col-span-2">
          <Button
            type="submit"
            disabled={isCreating}
            className="w-full rounded-lg bg-brand-red px-4 py-2 font-semibold text-white shadow-sm hover:bg-brand-red-dark disabled:opacity-70"
            variant="primary"
            size="md"
          >
            {isCreating ? tc('actions.saving') : tp('addVariant')}
          </Button>
        </div>
      </form>
      {createState?.error ? <p className="mt-3 text-sm text-rose-700">{createState.error}</p> : null}
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

function ErrorText({ children }: { children: ReactNode }) {
  return <p className="text-xs text-rose-700">{children}</p>;
}
