'use client';

import { Button, Input, TableCell, TableHead } from '@erp/ui';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { CategoryForm } from './category-form';
import {
  type CategoryWithCount,
  deleteCategoryAction,
  updateCategoryAction,
} from './actions';

export function CategoriesClient({ categories }: { categories: CategoryWithCount[] }) {
  const router = useRouter();
  const locale = useLocale() as 'id' | 'en' | 'zh';
  const t = useTranslations('inventory.categories');
  const tCommon = useTranslations('common');
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingCode, setEditingCode] = useState('');
  const [editingNameId, setEditingNameId] = useState('');
  const [editingNameEn, setEditingNameEn] = useState('');
  const [editingNameZh, setEditingNameZh] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const handleDelete = async (id: string) => {
    setMessage(null);
    setConfirmDeleteId(null);
    try {
      const result = await deleteCategoryAction(id);
      if (!result.ok) {
        setMessage({ type: 'error', text: result.error ?? t('deleteFailed') });
      } else {
        router.refresh();
      }
    } catch {
      setMessage({ type: 'error', text: t('deleteFailed') });
    }
  };

  const startEdit = (cat: CategoryWithCount) => {
    setEditingId(cat.id);
    setEditingCode(cat.code || '');
    setEditingNameId(cat.name.id || '');
    setEditingNameEn(cat.name.en || '');
    setEditingNameZh(cat.name.zh || '');
    setMessage(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const saveEdit = async (e: React.FormEvent, id: string) => {
    e.preventDefault();
    if (!editingCode.trim() || !editingNameId.trim()) return;
    setIsSavingEdit(true);
    try {
      const formData = new FormData();
      formData.set('categoryCode', editingCode);
      formData.set('categoryNameId', editingNameId);
      formData.set('categoryNameEn', editingNameEn);
      formData.set('categoryNameZh', editingNameZh);

      const result = await updateCategoryAction(id, formData);
      if (!result.ok) {
        setMessage({ type: 'error', text: result.error ?? t('updateFailed') });
      } else {
        setEditingId(null);
        router.refresh();
      }
    } finally {
      setIsSavingEdit(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast-style message */}
      {message && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            message.type === 'error'
              ? 'border-rose-200 bg-rose-50 text-rose-700'
              : 'border-emerald-200 bg-emerald-50 text-emerald-700'
          }`}
        >
          {message.text}
        </div>
      )}

      <CategoryForm />

      <div className="surface-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-brand-cream-2 bg-brand-cream/50">
              <TableHead className="px-4 py-3 text-left font-medium text-brand-ink-2">
                {t('code')}
              </TableHead>
              <TableHead className="px-4 py-3 text-left font-medium text-brand-ink-2">
                {t('name')}
              </TableHead>
              <TableHead className="px-4 py-3 text-center font-medium text-brand-ink-2">
                {t('productCount')}
              </TableHead>
              <TableHead className="px-4 py-3 text-right font-medium text-brand-ink-2">
                {tCommon('labels.actions')}
              </TableHead>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-cream-2">
            {categories.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-brand-ink-3">
                  {t('empty')}
                </td>
              </tr>
            ) : (
              categories.map((cat) => {
                const nameObj = cat.name as { id?: string; en?: string; zh?: string } | null;
                const display =
                  nameObj?.[locale] ?? nameObj?.id ?? nameObj?.en ?? nameObj?.zh ?? t('unnamed');
                const isEditing = editingId === cat.id;
                if (isEditing) {
                  return (
                    <tr key={cat.id} className="hover:bg-brand-cream/50">
                      <TableCell colSpan={4} className="px-4 py-3">
                        <form onSubmit={(e) => saveEdit(e, cat.id)} className="flex flex-col gap-4 lg:flex-row lg:items-end">
                          <label className="flex-1 space-y-1.5">
                            <span className="text-sm font-medium text-brand-ink">{t('code')}</span>
                            <Input value={editingCode} onChange={e => setEditingCode(e.target.value)} required placeholder={t('codePlaceholder')} />
                          </label>
                          <label className="flex-[1.5] space-y-1.5">
                            <span className="text-sm font-medium text-brand-ink">{t('nameId')}</span>
                            <Input value={editingNameId} onChange={e => setEditingNameId(e.target.value)} required placeholder={t('namePlaceholderId')} />
                          </label>
                          <label className="flex-[1.5] space-y-1.5">
                            <span className="text-sm font-medium text-brand-ink">{t('nameEn')}</span>
                            <Input value={editingNameEn} onChange={e => setEditingNameEn(e.target.value)} placeholder={t('namePlaceholderEn')} />
                          </label>
                          <label className="flex-[1.5] space-y-1.5">
                            <span className="text-sm font-medium text-brand-ink">{t('nameZh')}</span>
                            <Input value={editingNameZh} onChange={e => setEditingNameZh(e.target.value)} placeholder={t('namePlaceholderZh')} />
                          </label>
                          <div className="flex gap-2">
                            <button
                              type="submit"
                              disabled={isSavingEdit || !editingCode.trim() || !editingNameId.trim()}
                              className="rounded-lg bg-brand-ember-5 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-ember-6 disabled:opacity-50"
                            >
                              {isSavingEdit ? t('saving') : tCommon('actions.save')}
                            </button>
                            <button
                              type="button"
                              onClick={cancelEdit}
                              className="rounded-lg border border-brand-cream-3 px-4 py-2 text-sm font-semibold text-brand-ink-3 hover:bg-brand-cream-2"
                            >
                              {tCommon('actions.cancel')}
                            </button>
                          </div>
                        </form>
                      </TableCell>
                    </tr>
                  );
                }

                return (
                  <tr key={cat.id} className="hover:bg-brand-cream/50">
                    <TableCell className="px-4 py-3 font-medium text-brand-ink">
                      {cat.code}
                    </TableCell>
                    <TableCell className="px-4 py-3 font-medium text-brand-ink">
                      {display}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          cat.productCount > 0
                            ? 'bg-brand-red/10 text-brand-red'
                            : 'bg-brand-cream-2 text-brand-ink-3'
                        }`}
                      >
                        {cat.productCount}
                      </span>
                    </TableCell>
                    <TableCell className="px-4 py-3 text-right">
                      {confirmDeleteId === cat.id ? (
                        <span className="inline-flex items-center gap-2">
                          <span className="text-xs text-brand-ink-3">{t('confirmDelete')}</span>
                          <button
                            type="button"
                            onClick={() => handleDelete(cat.id)}
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
                            onClick={() => startEdit(cat)}
                            className="text-xs text-brand-ink-2 hover:underline"
                          >
                            {tCommon('actions.edit')}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(cat.id)}
                            disabled={cat.productCount > 0}
                            title={cat.productCount > 0 ? t('hasProducts') : undefined}
                            className="text-xs text-brand-red hover:underline disabled:cursor-not-allowed disabled:text-brand-ink-3 disabled:no-underline disabled:opacity-50"
                          >
                            {t('delete')}
                          </button>
                        </span>
                      )}
                    </TableCell>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
