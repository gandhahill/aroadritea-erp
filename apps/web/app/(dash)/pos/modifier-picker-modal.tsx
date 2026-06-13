/**
 * Modifier Picker Modal — G1 / ADR-0019
 *
 * Lets the cashier choose sugar/ice/topping (and other) options for a
 * product before it's added to the cart. Emits a `ModifierSelection[]`
 * (canonical shape, snapshot at order time) plus the extra price total.
 */

'use client';

import type { ModifierSelection } from '@erp/shared/pos/modifiers';
import { Button } from '@erp/ui';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import type { ModifierGroupItem, ProductListItem, VariantItem } from './actions';

interface ModifierPickerModalProps {
  open: boolean;
  product: ProductListItem;
  variant?: VariantItem;
  onConfirm: (selections: ModifierSelection[]) => void;
  onCancel: () => void;
}

function buildInitialSelections(groups: ModifierGroupItem[]): Record<string, Set<string>> {
  const initial: Record<string, Set<string>> = {};
  for (const group of groups) {
    const defaults = group.options.filter((o) => o.isDefault).map((o) => o.id);
    if (group.selectionType === 'single') {
      initial[group.id] = new Set(defaults.slice(0, 1));
    } else {
      initial[group.id] = new Set(defaults);
    }
  }
  return initial;
}

export function ModifierPickerModal({
  open,
  product,
  variant,
  onConfirm,
  onCancel,
}: ModifierPickerModalProps) {
  const t = useTranslations('pos');
  const groups = useMemo(
    () => [...product.modifierGroups].sort((a, b) => a.sortOrder - b.sortOrder),
    [product.modifierGroups],
  );
  const [selections, setSelections] = useState<Record<string, Set<string>>>(() =>
    buildInitialSelections(groups),
  );

  if (!open) return null;

  function toggleOption(group: ModifierGroupItem, optionId: string) {
    setSelections((prev) => {
      const next = { ...prev };
      const current = new Set(prev[group.id] ?? []);
      if (group.selectionType === 'single') {
        next[group.id] =
          current.has(optionId) && !group.isRequired ? new Set() : new Set([optionId]);
        return next;
      }
      if (current.has(optionId)) {
        current.delete(optionId);
      } else {
        if (group.maxSelections != null && current.size >= group.maxSelections) return prev;
        current.add(optionId);
      }
      next[group.id] = current;
      return next;
    });
  }

  const missingRequired = groups.some((g) => g.isRequired && (selections[g.id]?.size ?? 0) === 0);

  function handleConfirm() {
    if (missingRequired) return;
    const result: ModifierSelection[] = [];
    for (const group of groups) {
      const chosen = selections[group.id] ?? new Set<string>();
      for (const option of group.options) {
        if (!chosen.has(option.id)) continue;
        result.push({
          groupId: group.id,
          groupRole: group.groupRole,
          groupName: group.name,
          optionId: option.id,
          optionName: option.name,
          extraPrice: option.extraPrice,
        });
      }
    }
    onConfirm(result);
  }

  const productName = variant ? `${product.name} (${variant.name})` : product.name;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[85vh] w-full max-w-md flex-col rounded-lg bg-card shadow-lg">
        <div className="border-b border-brand-cream-3 p-4">
          <h2 className="text-lg font-semibold text-brand-ink">{productName}</h2>
          <p className="mt-1 text-sm text-brand-ink-3">{t('modifierPicker.subtitle')}</p>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {groups.map((group) => (
            <div key={group.id}>
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-brand-ink">{group.name}</h3>
                <span className="shrink-0 text-xs text-brand-ink-3">
                  {group.isRequired ? t('modifierPicker.required') : t('modifierPicker.optional')}
                  {group.selectionType === 'multiple' && group.maxSelections != null
                    ? ` · ${t('modifierPicker.maxSelections', { count: group.maxSelections })}`
                    : ''}
                </span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {group.options.map((option) => {
                  const checked = selections[group.id]?.has(option.id) ?? false;
                  const extraPrice = BigInt(option.extraPrice || '0');
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => toggleOption(group, option.id)}
                      className={`flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                        checked
                          ? 'border-brand-red bg-brand-red/10 text-brand-red'
                          : 'border-brand-cream-3 text-brand-ink-2 hover:border-brand-red/40'
                      }`}
                    >
                      <span>{option.name}</span>
                      {extraPrice > BigInt(0) ? (
                        <span className="shrink-0 text-xs font-semibold">
                          +{formatRupiah(option.extraPrice)}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-2 border-t border-brand-cream-3 p-4">
          <Button variant="secondary" onClick={onCancel}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" disabled={missingRequired} onClick={handleConfirm}>
            {t('modifierPicker.addToCart')}
          </Button>
        </div>
      </div>
    </div>
  );
}

function formatRupiah(value: string): string {
  const num = Number(value);
  if (Number.isNaN(num)) return 'Rp 0';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(num);
}
