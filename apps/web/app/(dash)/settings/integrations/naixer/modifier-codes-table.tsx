/**
 * Modifier Codes Table — CRUD for Naixer modifier code mappings.
 */

'use client';

import { Button, Input, Select, TableCell, TableHead } from '@erp/ui';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import {
  type ModifierCodeItem,
  type NaixerModifierOption,
  createModifierCode,
  deleteModifierCode,
  updateModifierCode,
} from './actions';

interface Props {
  codes: ModifierCodeItem[];
  tenantId: string;
  modifierOptions: NaixerModifierOption[];
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

export function ModifierCodesTable({ codes, tenantId, modifierOptions }: Props) {
  const tc = useTranslations('common');
  const t = useTranslations('settings.naixer');
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
      setError(result.error ?? t('errors.createFailed'));
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
    if (!result.success) setError(result.error ?? t('errors.updateFailed'));
    startTransition(() => router.refresh());
  }

  async function handleDelete(id: string) {
    setError(null);
    const result = await deleteModifierCode(id);
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
              {t('modifierKind')}
            </TableHead>
            <TableHead className="px-4 py-3 text-left font-medium text-brand-ink-2">
              {t('modifierOptionId')}
            </TableHead>
            <TableHead className="px-4 py-3 text-left font-medium text-brand-ink-2">
              {t('naixerCode')}
            </TableHead>
            <TableHead className="px-4 py-3 text-center font-medium text-brand-ink-2">
              {t('displayOrder')}
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
              <TableCell className="px-4 py-3">
                <KindBadge kind={code.modifierKind} />
              </TableCell>
              <TableCell className="px-4 py-3 text-sm text-brand-ink">
                {code.modifierOptionLabel}
              </TableCell>
              <TableCell className="px-4 py-3">
                <code className="rounded bg-brand-cream-2 px-1.5 py-0.5 text-xs font-mono font-bold text-brand-ink">
                  {code.naixerCode}
                </code>
              </TableCell>
              <TableCell className="px-4 py-3 text-center text-xs text-brand-ink-3">
                {code.displayOrder}
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
              <td colSpan={6} className="px-4 py-8 text-center text-sm text-brand-ink-3">
                {t('noModifierMappings')}
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {showAddForm ? (
        <div className="border-t border-brand-cream-3 bg-brand-cream px-4 py-3">
          <div className="flex items-end gap-3">
            <div className="w-28">
              <label className="mb-1 block text-xs font-medium text-brand-ink-2">
                {t('modifierKind')}
              </label>
              <Select
                value={newKind}
                onChange={(e) => setNewKind(e.target.value)}
                className="w-full rounded border border-brand-cream-3 bg-card px-2.5 py-1.5 text-sm text-brand-ink focus:border-brand-red focus:outline-none"
              >
                {MODIFIER_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-brand-ink-2">
                {t('modifierOptionId')}
              </label>
              <Select
                value={newOptionId}
                onChange={(e) => setNewOptionId(e.target.value)}
                className="w-full rounded border border-brand-cream-3 bg-card px-2.5 py-1.5 text-sm text-brand-ink focus:border-brand-red focus:outline-none"
              >
                <option value="">
                  {t('selectModifierOption')}
                </option>
                {modifierOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="w-28">
              <label className="mb-1 block text-xs font-medium text-brand-ink-2">
                {t('naixerCode')}
              </label>
              <Input
                type="text"
                value={newNaixerCode}
                onChange={(e) => setNewNaixerCode(e.target.value)}
                placeholder={t('placeholders.modifierCode')}
                className="w-full rounded border border-brand-cream-3 bg-card px-2.5 py-1.5 text-sm font-mono text-brand-ink placeholder:text-brand-ink-3 focus:border-brand-red focus:outline-none"
              />
            </div>
            <div className="w-20">
              <label className="mb-1 block text-xs font-medium text-brand-ink-2">
                {t('displayOrder')}
              </label>
              <Input
                type="number"
                value={newOrder}
                onChange={(e) => setNewOrder(e.target.value)}
                className="w-full rounded border border-brand-cream-3 bg-card px-2.5 py-1.5 text-sm text-brand-ink focus:border-brand-red focus:outline-none"
              />
            </div>
            <Button
              type="button"
              onClick={handleAdd}
              disabled={isPending || !newOptionId || !newNaixerCode}
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
            + {t('addModifierMapping')}
          </button>
        </div>
      )}
    </div>
  );
}
