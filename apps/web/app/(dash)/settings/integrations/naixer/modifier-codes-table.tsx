/**
 * Modifier Codes Table — CRUD for Naixer modifier code mappings.
 */

'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import {
  type ModifierCodeItem,
  createModifierCode,
  deleteModifierCode,
  updateModifierCode,
} from './actions';

interface Props {
  codes: ModifierCodeItem[];
  tenantId: string;
}

const MODIFIER_KINDS = ['size', 'ice', 'sugar', 'topping', 'cup', 'other'];

function KindBadge({ kind }: { kind: string }) {
  const colors: Record<string, string> = {
    size: 'bg-blue-50 text-blue-700',
    ice: 'bg-cyan-50 text-cyan-700',
    sugar: 'bg-amber-50 text-amber-700',
    topping: 'bg-purple-50 text-purple-700',
    cup: 'bg-brand-cream-2 text-brand-ink-2',
    other: 'bg-brand-cream-2 text-brand-ink-3',
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${colors[kind] ?? colors.other}`}
    >
      {kind}
    </span>
  );
}

export function ModifierCodesTable({ codes, tenantId }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showAddForm, setShowAddForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [newKind, setNewKind] = useState('size');
  const [newOptionId, setNewOptionId] = useState('');
  const [newNaixerCode, setNewNaixerCode] = useState('');
  const [newOrder, setNewOrder] = useState('0');

  async function handleAdd() {
    setError(null);
    const result = await createModifierCode(tenantId, {
      modifierKind: newKind,
      modifierOptionId: newOptionId.trim(),
      naixerCode: newNaixerCode.trim(),
      displayOrder: Number.parseInt(newOrder, 10) || 0,
    });
    if (!result.success) {
      setError(result.error ?? 'Failed to create');
      return;
    }
    setNewOptionId('');
    setNewNaixerCode('');
    setNewOrder('0');
    setShowAddForm(false);
    startTransition(() => router.refresh());
  }

  async function handleToggle(id: string, isActive: boolean) {
    setError(null);
    const result = await updateModifierCode(id, { isActive: !isActive });
    if (!result.success) setError(result.error ?? 'Failed to update');
    startTransition(() => router.refresh());
  }

  async function handleDelete(id: string) {
    setError(null);
    const result = await deleteModifierCode(id);
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
            <th className="px-4 py-3 text-left font-medium text-brand-ink-2">Jenis</th>
            <th className="px-4 py-3 text-left font-medium text-brand-ink-2">ID Opsi Modifier</th>
            <th className="px-4 py-3 text-left font-medium text-brand-ink-2">Kode Naixer</th>
            <th className="px-4 py-3 text-center font-medium text-brand-ink-2">Urutan</th>
            <th className="px-4 py-3 text-left font-medium text-brand-ink-2">Status</th>
            <th className="px-4 py-3 text-right font-medium text-brand-ink-2">Aksi</th>
          </tr>
        </thead>
        <tbody>
          {codes.map((code) => (
            <tr key={code.id} className="border-b border-brand-cream-3 last:border-0">
              <td className="px-4 py-3">
                <KindBadge kind={code.modifierKind} />
              </td>
              <td className="px-4 py-3 font-mono text-xs text-brand-ink-3">
                {code.modifierOptionId}
              </td>
              <td className="px-4 py-3">
                <code className="rounded bg-brand-cream-2 px-1.5 py-0.5 text-xs font-mono font-bold text-brand-ink">
                  {code.naixerCode}
                </code>
              </td>
              <td className="px-4 py-3 text-center text-xs text-brand-ink-3">
                {code.displayOrder}
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
                      Aktif
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-brand-cream-2 px-2 py-0.5 text-[11px] font-medium text-brand-ink-3">
                      Nonaktif
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
                  Hapus
                </button>
              </td>
            </tr>
          ))}
          {codes.length === 0 && !showAddForm && (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-sm text-brand-ink-3">
                No modifier code mappings yet. Add one below.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {showAddForm ? (
        <div className="border-t border-brand-cream-3 bg-brand-cream px-4 py-3">
          <div className="flex items-end gap-3">
            <div className="w-28">
              <label className="mb-1 block text-xs font-medium text-brand-ink-2">Kind</label>
              <select
                value={newKind}
                onChange={(e) => setNewKind(e.target.value)}
                className="w-full rounded border border-brand-cream-3 bg-card px-2.5 py-1.5 text-sm text-brand-ink focus:border-brand-red focus:outline-none"
              >
                {MODIFIER_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-brand-ink-2">
                Modifier Option ID
              </label>
              <input
                type="text"
                value={newOptionId}
                onChange={(e) => setNewOptionId(e.target.value)}
                placeholder="e.g. option-uuid"
                className="w-full rounded border border-brand-cream-3 bg-card px-2.5 py-1.5 text-sm text-brand-ink placeholder:text-brand-ink-3 focus:border-brand-red focus:outline-none"
              />
            </div>
            <div className="w-28">
              <label className="mb-1 block text-xs font-medium text-brand-ink-2">Naixer Code</label>
              <input
                type="text"
                value={newNaixerCode}
                onChange={(e) => setNewNaixerCode(e.target.value)}
                placeholder="e.g. C01"
                className="w-full rounded border border-brand-cream-3 bg-card px-2.5 py-1.5 text-sm font-mono text-brand-ink placeholder:text-brand-ink-3 focus:border-brand-red focus:outline-none"
              />
            </div>
            <div className="w-20">
              <label className="mb-1 block text-xs font-medium text-brand-ink-2">Order</label>
              <input
                type="number"
                value={newOrder}
                onChange={(e) => setNewOrder(e.target.value)}
                className="w-full rounded border border-brand-cream-3 bg-card px-2.5 py-1.5 text-sm text-brand-ink focus:border-brand-red focus:outline-none"
              />
            </div>
            <button
              type="button"
              onClick={handleAdd}
              disabled={isPending || !newOptionId || !newNaixerCode}
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
            + Add modifier code mapping
          </button>
        </div>
      )}
    </div>
  );
}
