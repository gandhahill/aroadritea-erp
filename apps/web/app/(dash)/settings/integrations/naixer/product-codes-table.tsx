/**
 * Product Codes Table — CRUD for Naixer product code mappings.
 */

'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  createProductCode,
  updateProductCode,
  deleteProductCode,
  type ProductCodeItem,
} from './actions';

interface Props {
  codes: ProductCodeItem[];
  tenantId: string;
}

export function ProductCodesTable({ codes, tenantId }: Props) {
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
      setError(result.error ?? 'Failed to create');
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
    if (!result.success) setError(result.error ?? 'Failed to update');
    startTransition(() => router.refresh());
  }

  async function handleDelete(id: string) {
    setError(null);
    const result = await deleteProductCode(id);
    if (!result.success) setError(result.error ?? 'Failed to delete');
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
            <th className="px-4 py-3 text-left font-medium text-brand-ink-2">
              Product ID
            </th>
            <th className="px-4 py-3 text-left font-medium text-brand-ink-2">
              Variant ID
            </th>
            <th className="px-4 py-3 text-left font-medium text-brand-ink-2">
              Naixer Code
            </th>
            <th className="px-4 py-3 text-left font-medium text-brand-ink-2">
              Status
            </th>
            <th className="px-4 py-3 text-right font-medium text-brand-ink-2">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {codes.map((code) => (
            <tr
              key={code.id}
              className="border-b border-brand-cream-3 last:border-0"
            >
              <td className="px-4 py-3 font-mono text-xs text-brand-ink">
                {code.productId}
              </td>
              <td className="px-4 py-3 font-mono text-xs text-brand-ink-3">
                {code.variantId ?? '(all)'}
              </td>
              <td className="px-4 py-3">
                <code className="rounded bg-brand-cream-2 px-1.5 py-0.5 text-xs font-mono font-bold text-brand-ink">
                  {code.naixerCode}
                </code>
              </td>
              <td className="px-4 py-3">
                <button
                  type="button"
                  onClick={() => handleToggle(code.id, code.isActive)}
                  disabled={isPending}
                  className="cursor-pointer"
                >
                  {code.isActive ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-brand-jade-light px-2 py-0.5 text-[11px] font-medium text-brand-jade">
                      <span className="h-1.5 w-1.5 rounded-full bg-brand-jade" />
                      Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-brand-cream-2 px-2 py-0.5 text-[11px] font-medium text-brand-ink-3">
                      Inactive
                    </span>
                  )}
                </button>
              </td>
              <td className="px-4 py-3 text-right">
                <button
                  type="button"
                  onClick={() => handleDelete(code.id)}
                  disabled={isPending}
                  className="text-xs text-brand-red hover:underline disabled:opacity-50"
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
          {codes.length === 0 && !showAddForm && (
            <tr>
              <td
                colSpan={5}
                className="px-4 py-8 text-center text-sm text-brand-ink-3"
              >
                No product code mappings yet. Add one below.
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
                Product ID
              </label>
              <input
                type="text"
                value={newProductId}
                onChange={(e) => setNewProductId(e.target.value)}
                placeholder="e.g. product-uuid"
                className="w-full rounded border border-brand-cream-3 bg-white px-2.5 py-1.5 text-sm text-brand-ink placeholder:text-brand-ink-3 focus:border-brand-red focus:outline-none"
              />
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-brand-ink-2">
                Variant ID (optional)
              </label>
              <input
                type="text"
                value={newVariantId}
                onChange={(e) => setNewVariantId(e.target.value)}
                placeholder="leave empty for all"
                className="w-full rounded border border-brand-cream-3 bg-white px-2.5 py-1.5 text-sm text-brand-ink placeholder:text-brand-ink-3 focus:border-brand-red focus:outline-none"
              />
            </div>
            <div className="w-32">
              <label className="mb-1 block text-xs font-medium text-brand-ink-2">
                Naixer Code
              </label>
              <input
                type="text"
                value={newNaixerCode}
                onChange={(e) => setNewNaixerCode(e.target.value)}
                placeholder="e.g. T003"
                className="w-full rounded border border-brand-cream-3 bg-white px-2.5 py-1.5 text-sm font-mono text-brand-ink placeholder:text-brand-ink-3 focus:border-brand-red focus:outline-none"
              />
            </div>
            <button
              type="button"
              onClick={handleAdd}
              disabled={isPending || !newProductId || !newNaixerCode}
              className="rounded bg-brand-red px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-red/90 disabled:opacity-50"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="rounded px-3 py-1.5 text-sm text-brand-ink-3 hover:text-brand-ink"
            >
              Cancel
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
            + Add product code mapping
          </button>
        </div>
      )}
    </div>
  );
}
