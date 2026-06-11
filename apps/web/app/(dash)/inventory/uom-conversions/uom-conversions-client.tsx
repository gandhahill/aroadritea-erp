'use client';

import { Input, SearchableSelect, TableCell, TableHead } from '@erp/ui';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  type UomConversionsPageData,
  deleteUomConversionAction,
  upsertUomConversionAction,
} from './actions';

function localized(name: unknown, locale: string): string {
  const record = name as Record<string, string> | null | undefined;
  if (!record) return '';
  return record[locale] ?? record.id ?? record.en ?? record.zh ?? '';
}

export function UomConversionsClient({ data }: { data: UomConversionsPageData }) {
  const router = useRouter();
  const locale = useLocale() as 'id' | 'en' | 'zh';
  const t = useTranslations('inventory.uomConversions');
  const tCommon = useTranslations('common');

  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [productId, setProductId] = useState('');
  const [fromUom, setFromUom] = useState('');
  const [toUom, setToUom] = useState('');
  const [multiplyBy, setMultiplyBy] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const productOptions = [
    { value: '', label: t('scopeGlobalOption') },
    ...data.products.map((p) => ({
      value: p.id,
      label: `${p.sku} — ${localized(p.name, locale)} (${p.uom})`,
    })),
  ];

  const resetForm = () => {
    setEditingId(null);
    setProductId('');
    setFromUom('');
    setToUom('');
    setMultiplyBy('');
  };

  const startEdit = (conversion: UomConversionsPageData['conversions'][number]) => {
    setEditingId(conversion.id);
    setProductId(conversion.productId ?? '');
    setFromUom(conversion.fromUom);
    setToUom(conversion.toUom);
    setMultiplyBy(conversion.multiplyBy);
    setMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage(null);
    try {
      const formData = new FormData();
      if (editingId) formData.set('conversionId', editingId);
      formData.set('productId', productId);
      formData.set('fromUom', fromUom);
      formData.set('toUom', toUom);
      formData.set('multiplyBy', multiplyBy);

      const result = await upsertUomConversionAction(formData);
      if (!result.ok) {
        setMessage({ type: 'error', text: result.error ?? t('saveFailed') });
      } else {
        setMessage({ type: 'success', text: t('saved') });
        resetForm();
        router.refresh();
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setConfirmDeleteId(null);
    setMessage(null);
    const result = await deleteUomConversionAction(id);
    if (!result.ok) {
      setMessage({ type: 'error', text: result.error ?? t('deleteFailed') });
    } else {
      if (editingId === id) resetForm();
      router.refresh();
    }
  };

  const preview =
    fromUom.trim() && toUom.trim() && Number.parseFloat(multiplyBy) > 0
      ? t('preview', { fromUom: fromUom.trim(), multiplyBy, toUom: toUom.trim() })
      : null;

  return (
    <div className="space-y-6">
      {(message || data.error) && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            message?.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-rose-200 bg-rose-50 text-rose-700'
          }`}
        >
          {message?.text ?? data.error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="surface-card space-y-4 p-4">
        <h2 className="text-sm font-semibold text-brand-ink">
          {editingId ? t('editTitle') : t('addTitle')}
        </h2>
        <div className="grid gap-4 lg:grid-cols-4">
          <label className="space-y-1.5 lg:col-span-2">
            <span className="text-sm font-medium text-brand-ink">{t('scope')}</span>
            <SearchableSelect
              options={productOptions}
              value={productId}
              onChange={(value) => setProductId(value)}
              placeholder={t('scopeGlobalOption')}
            />
            <span className="block text-xs text-brand-ink-3">{t('scopeHint')}</span>
          </label>
          <label className="space-y-1.5">
            <span className="text-sm font-medium text-brand-ink">{t('fromUom')}</span>
            <Input
              value={fromUom}
              onChange={(e) => setFromUom(e.target.value)}
              required
              maxLength={32}
              placeholder={t('fromUomPlaceholder')}
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-sm font-medium text-brand-ink">{t('toUom')}</span>
            <Input
              value={toUom}
              onChange={(e) => setToUom(e.target.value)}
              required
              maxLength={32}
              placeholder={t('toUomPlaceholder')}
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-sm font-medium text-brand-ink">{t('multiplyBy')}</span>
            <Input
              value={multiplyBy}
              onChange={(e) => setMultiplyBy(e.target.value)}
              required
              inputMode="decimal"
              placeholder="25"
            />
            <span className="block text-xs text-brand-ink-3">{preview ?? t('multiplyByHint')}</span>
          </label>
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={isSaving || !fromUom.trim() || !toUom.trim() || !multiplyBy.trim()}
            className="rounded-lg bg-brand-ember-5 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-ember-6 disabled:opacity-50"
          >
            {isSaving ? t('saving') : editingId ? tCommon('actions.save') : t('add')}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="rounded-lg border border-brand-cream-3 px-4 py-2 text-sm font-semibold text-brand-ink-3 hover:bg-brand-cream-2"
            >
              {tCommon('actions.cancel')}
            </button>
          )}
        </div>
      </form>

      <div className="surface-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-brand-cream-2 bg-brand-cream/50">
              <TableHead className="px-4 py-3 text-left font-medium text-brand-ink-2">
                {t('scope')}
              </TableHead>
              <TableHead className="px-4 py-3 text-left font-medium text-brand-ink-2">
                {t('rule')}
              </TableHead>
              <TableHead className="px-4 py-3 text-right font-medium text-brand-ink-2">
                {tCommon('labels.actions')}
              </TableHead>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-cream-2">
            {data.conversions.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-brand-ink-3">
                  {t('empty')}
                </td>
              </tr>
            ) : (
              data.conversions.map((conversion) => (
                <tr key={conversion.id} className="hover:bg-brand-cream/50">
                  <TableCell className="px-4 py-3 text-brand-ink">
                    {conversion.productId ? (
                      <span>
                        {conversion.productSku} — {localized(conversion.productName, locale)}
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-brand-cream-2 px-2 py-0.5 text-xs font-medium text-brand-ink-2">
                        {t('global')}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="px-4 py-3 font-medium text-brand-ink">
                    {t('preview', {
                      fromUom: conversion.fromUom,
                      multiplyBy: conversion.multiplyBy,
                      toUom: conversion.toUom,
                    })}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-right">
                    {confirmDeleteId === conversion.id ? (
                      <span className="inline-flex items-center gap-2">
                        <span className="text-xs text-brand-ink-3">{t('confirmDelete')}</span>
                        <button
                          type="button"
                          onClick={() => handleDelete(conversion.id)}
                          className="rounded bg-rose-500 px-2 py-1 text-xs font-semibold text-white hover:bg-rose-600"
                        >
                          {tCommon('labels.yes')}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="rounded border border-brand-cream-3 px-2 py-1 text-xs font-semibold text-brand-ink-3 hover:bg-brand-cream-2"
                        >
                          {tCommon('labels.no')}
                        </button>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => startEdit(conversion)}
                          className="text-xs text-brand-ink-2 hover:underline"
                        >
                          {tCommon('actions.edit')}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(conversion.id)}
                          className="text-xs text-brand-red hover:underline"
                        >
                          {tCommon('actions.delete')}
                        </button>
                      </span>
                    )}
                  </TableCell>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
