/**
 * Product Codes Table — CRUD for Naixer product code mappings.
 */

'use client';

import { Button, Input, Select, TableCell, TableHead } from '@erp/ui';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import {
  type NaixerProductOption,
  type NaixerVariantOption,
  type ProductCodeItem,
  createProductCode,
  deleteProductCode,
  updateProductCode,
} from './actions';

interface Props {
  codes: ProductCodeItem[];
  tenantId: string;
  products: NaixerProductOption[];
  variants: NaixerVariantOption[];
}

export function ProductCodesTable({ codes, tenantId, products, variants }: Props) {
  const tc = useTranslations('common');
  const t = useTranslations('settings.naixer');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showAddForm, setShowAddForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Add form state
  const [newProductId, setNewProductId] = useState('');
  const [newVariantId, setNewVariantId] = useState('');
  const [newNaixerCode, setNewNaixerCode] = useState('');

  async function handleAdd() {
    setError(null);
    const result = await createProductCode(tenantId, {
      productId: newProductId.trim(),
      variantId: newVariantId.trim() || undefined,
      naixerCode: newNaixerCode.trim(),
    });
    if (!result.success) {
      setError(result.error ?? t('errors.createFailed'));
      return;
    }
    setNewProductId('');
    setNewVariantId('');
    setNewNaixerCode('');
    setShowAddForm(false);
    startTransition(() => router.refresh());
  }

  async function handleToggle(id: string, isActive: boolean) {
    setError(null);
    const result = await updateProductCode(id, { isActive: !isActive });
    if (!result.success) setError(result.error ?? t('errors.updateFailed'));
    startTransition(() => router.refresh());
  }

  async function handleDelete(id: string) {
    setError(null);
    const result = await deleteProductCode(id);
    if (!result.success) setError(result.error ?? t('errors.deleteFailed'));
    startTransition(() => router.refresh());
  }

  return (
    <div className="overflow-hidden rounded-lg border border-brand-cream-3">
      {error && (
        <div className="border-b border-brand-red/20 bg-brand-red/5 px-4 py-2 text-sm text-brand-red">
          {error}
        </div>
      )}

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-brand-cream-3 bg-brand-cream">
            <TableHead className="px-4 py-3 text-left font-medium text-brand-ink-2">
              {t('product')}
            </TableHead>
            <TableHead className="px-4 py-3 text-left font-medium text-brand-ink-2">
              {t('variant')}
            </TableHead>
            <TableHead className="px-4 py-3 text-left font-medium text-brand-ink-2">
              {t('naixerCode')}
            </TableHead>
            <TableHead className="px-4 py-3 text-left font-medium text-brand-ink-2">
              {tc('fields.status')}
            </TableHead>
            <TableHead className="px-4 py-3 text-right font-medium text-brand-ink-2">
              {tc('fields.actions')}
            </TableHead>
          </tr>
        </thead>
        <tbody>
          {codes.map((code) => (
            <tr key={code.id} className="border-b border-brand-cream-3 last:border-0">
              <TableCell className="px-4 py-3 text-sm text-brand-ink">
                {code.productLabel}
              </TableCell>
              <TableCell className="px-4 py-3 text-xs text-brand-ink-3">
                {code.variantLabel ?? t('allVariants')}
              </TableCell>
              <TableCell className="px-4 py-3">
                <code className="rounded bg-brand-cream-2 px-1.5 py-0.5 text-xs font-mono font-bold text-brand-ink">
                  {code.naixerCode}
                </code>
              </TableCell>
              <TableCell className="px-4 py-3">
                <button
                  type="button"
                  onClick={() => handleToggle(code.id, code.isActive)}
                  disabled={isPending}
                  className="cursor-pointer"
                >
                  {code.isActive ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-brand-jade-light px-2 py-0.5 text-[11px] font-medium text-brand-jade">
                      <span className="h-1.5 w-1.5 rounded-full bg-brand-jade" />
                      {tc('status.active')}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-brand-cream-2 px-2 py-0.5 text-[11px] font-medium text-brand-ink-3">
                      {tc('status.inactive')}
                    </span>
                  )}
                </button>
              </TableCell>
              <TableCell className="px-4 py-3 text-right">
                <button
                  type="button"
                  onClick={() => handleDelete(code.id)}
                  disabled={isPending}
                  className="text-xs text-brand-red hover:underline disabled:opacity-50"
                >
                  {tc('actions.delete')}
                </button>
              </TableCell>
            </tr>
          ))}
          {codes.length === 0 && !showAddForm && (
            <tr>
              <td colSpan={5} className="px-4 py-8 text-center text-sm text-brand-ink-3">
                {t('noProductMappings')}
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Add form */}
      {showAddForm ? (
        <div className="border-t border-brand-cream-3 bg-brand-cream px-4 py-3">
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-brand-ink-2">
                {t('product')}
              </label>
              <Select
                value={newProductId}
                onChange={(e) => {
                  setNewProductId(e.target.value);
                  // Reset variant if it no longer matches the chosen product
                  if (
                    newVariantId &&
                    !variants.some((v) => v.id === newVariantId && v.productId === e.target.value)
                  ) {
                    setNewVariantId('');
                  }
                }}
                className="w-full rounded border border-brand-cream-3 bg-card px-2.5 py-1.5 text-sm text-brand-ink focus:border-brand-red focus:outline-none"
              >
                <option value="">{t('selectProduct')}</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-brand-ink-2">
                {t('variantOptional')}
              </label>
              <Select
                value={newVariantId}
                onChange={(e) => setNewVariantId(e.target.value)}
                disabled={!newProductId}
                className="w-full rounded border border-brand-cream-3 bg-card px-2.5 py-1.5 text-sm text-brand-ink focus:border-brand-red focus:outline-none disabled:opacity-50"
              >
                <option value="">{t('allVariants')}</option>
                {variants
                  .filter((v) => !newProductId || v.productId === newProductId)
                  .map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.label}
                    </option>
                  ))}
              </Select>
            </div>
            <div className="w-32">
              <label className="mb-1 block text-xs font-medium text-brand-ink-2">
                {t('naixerCode')}
              </label>
              <Input
                type="text"
                value={newNaixerCode}
                onChange={(e) => setNewNaixerCode(e.target.value)}
                placeholder={t('placeholders.productCode')}
                className="w-full rounded border border-brand-cream-3 bg-card px-2.5 py-1.5 text-sm font-mono text-brand-ink placeholder:text-brand-ink-3 focus:border-brand-red focus:outline-none"
              />
            </div>
            <Button
              type="button"
              onClick={handleAdd}
              disabled={isPending || !newProductId || !newNaixerCode}
              className="rounded bg-brand-red px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-red/90 disabled:opacity-50"
              variant="primary"
              size="sm"
            >
              {tc('labels.add')}
            </Button>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="rounded px-3 py-1.5 text-sm text-brand-ink-3 hover:text-brand-ink"
            >
              {tc('labels.cancel')}
            </button>
          </div>
        </div>
      ) : (
        <div className="border-t border-brand-cream-3 px-4 py-3">
          <button
            type="button"
            onClick={() => setShowAddForm(true)}
            className="text-sm font-medium text-brand-red hover:underline"
          >
            + {t('addProductMapping')}
          </button>
        </div>
      )}
    </div>
  );
}
