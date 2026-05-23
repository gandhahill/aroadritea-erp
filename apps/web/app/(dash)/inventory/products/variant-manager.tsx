'use client';

import type { VariantResult } from '@erp/services/inventory';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';
import { createVariantAction, toggleVariantStatusAction } from './actions';
import { Button, Input, Select, TableCell, TableBody, TableHead, TableHeader, Table } from "@erp/ui";

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
        <Table>
          <TableHeader>
            <tr>
              <TableHead className="px-4 py-3">{tc('fields.sku')}</TableHead>
              <TableHead className="px-4 py-3">{tc('fields.name')}</TableHead>
              <TableHead className="px-4 py-3">{tc('fields.attributes')}</TableHead>
              <TableHead className="px-4 py-3 text-right">{tc('fields.price')}</TableHead>
              <TableHead className="px-4 py-3">{tc('fields.status')}</TableHead>
              <TableHead className="px-4 py-3 text-right">{tc('fields.actions')}</TableHead>
            </tr>
          </TableHeader>
          <TableBody>
            {variants.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-brand-ink-3">
                  {tp('emptyVariants')}
                </td>
              </tr>
            ) : (
              variants.map((variant) => (
                <tr key={variant.id}>
                  <TableCell className="px-4 py-3 font-mono text-xs text-brand-ink">{variant.sku}</TableCell>
                  <TableCell className="px-4 py-3 font-medium text-brand-ink">{variant.name.id}</TableCell>
                  <TableCell className="px-4 py-3 text-brand-ink-3">
                    {Object.entries(variant.attributes)
                      .map(([key, value]) => `${key}: ${value}`)
                      .join(', ') || '-'}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-right font-semibold text-brand-ink">
                    {formatRupiah(variant.sellPrice)}
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <span className="rounded-full bg-brand-jade-light px-2 py-1 text-xs font-semibold text-brand-jade">
                      {variant.isActive ? tc('status.active') : tc('status.inactive')}
                    </span>
                  </TableCell>
                  <TableCell className="px-4 py-3 text-right">
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
                  </TableCell>
                </tr>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <form action={submitAction} className="mt-5 grid gap-4 lg:grid-cols-6">
        <input type="hidden" name="productId" value={productId} />
        <label className="space-y-1.5 lg:col-span-1">
          <span className="text-sm font-medium text-brand-ink">{tp('skuVariant')}</span>
          <Input name="variantSku" required />
        </label>
        <label className="space-y-1.5 lg:col-span-2">
          <span className="text-sm font-medium text-brand-ink">{tp('variantName')}</span>
          <Input name="variantNameId" required placeholder="Regular Cold" />
          <input type="hidden" name="variantNameEn" value="" />
          <input type="hidden" name="variantNameZh" value="" />
        </label>
        <label className="space-y-1.5 lg:col-span-1">
          <span className="text-sm font-medium text-brand-ink">{tp('size')}</span>
          <Select name="size">
            <option value="">-</option>
            <option value="Regular">Regular</option>
            <option value="Large">Large</option>
            <option value="Small">Small</option>
          </Select>
        </label>
        <label className="space-y-1.5 lg:col-span-1">
          <span className="text-sm font-medium text-brand-ink">{tp('temp')}</span>
          <Select name="temp">
            <option value="">-</option>
            <option value="Hot">Hot</option>
            <option value="Cold">Cold</option>
            <option value="Warm">Warm</option>
            <option value="Ice">Ice</option>
          </Select>
        </label>
        <label className="space-y-1.5 lg:col-span-1">
          <span className="text-sm font-medium text-brand-ink">{tp('sellingPrice')}</span>
          <Input name="variantSellPrice" type="number" required min={0} />
        </label>
        <label className="space-y-1.5 lg:col-span-1">
          <span className="text-sm font-medium text-brand-ink">{tp('costPrice')}</span>
          <Input
            name="variantCostPrice"
            type="number"
            required
            min={0}
            defaultValue={0}
           
          />
        </label>
        <label className="space-y-1.5 lg:col-span-1">
          <span className="text-sm font-medium text-brand-ink">{tp('order')}</span>
          <Input name="variantSortOrder" type="number" required min={0} defaultValue={0} />
        </label>
        <div className="flex items-end lg:col-span-2">
          <Button
            type="submit"
            disabled={isPending}
            className="w-full rounded-lg bg-brand-red px-4 py-2 font-semibold text-white shadow-sm hover:bg-brand-red-dark disabled:opacity-70" variant="primary" size="md"
          >
            {isPending ? tc('actions.saving') : tp('addVariant')}
          </Button>
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
