'use client';

import { Button, Input, TableCell, TableHead } from '@erp/ui';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { CategoryForm } from './category-form';
import {
  type CategoryWithCount,
  deleteCategoryAction,
  updateCategoryNameAction,
} from './actions';

export function CategoriesClient({ categories }: { categories: CategoryWithCount[] }) {
  const router = useRouter();
  const locale = useLocale() as 'id' | 'en' | 'zh';
  const t = useTranslations('inventory.categories');
  const tCommon = useTranslations('common');
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
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
    const display = cat.name[locale] ?? cat.name.id ?? cat.name.en ?? cat.name.zh ?? '';
    setEditingId(cat.id);
    setEditingName(display);
    setMessage(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingName('');
  };

  const saveEdit = async (id: string) => {
    if (!editingName.trim()) return;
    setIsSavingEdit(true);
    try {
      const result = await updateCategoryNameAction(id, editingName);
      if (!result.ok) {
        setMessage({ type: 'error', text: result.error ?? t('updateFailed') });
      } else {
        setEditingId(null);
        setEditingName('');
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
                <td colSpan={3} className="px-4 py-8 text-center text-brand-ink-3">
                  {t('empty')}
                </td>
              </tr>
            ) : (
              categories.map((cat) => {
                const nameObj = cat.name as { id?: string; en?: string; zh?: string } | null;
                const display =
                  nameObj?.[locale] ?? nameObj?.id ?? nameObj?.en ?? nameObj?.zh ?? t('unnamed');
                const isEditing = editingId === cat.id;
                return (
                  <tr key={cat.id} className="hover:bg-brand-cream/50">
                    <TableCell className="px-4 py-3 font-medium text-brand-ink">
                      {isEditing ? (
                        <Input
                          autoFocus
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveEdit(cat.id);
                            if (e.key === 'Escape') cancelEdit();
                          }}
                          className="w-full rounded border border-brand-cream-3 bg-brand-cream px-2 py-1 text-sm text-brand-ink focus:border-brand-red focus:outline-none"
                        />
                      ) : (
                        display
                      )}
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
                      {isEditing ? (
                        <span className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => saveEdit(cat.id)}
                            disabled={isSavingEdit || !editingName.trim()}
                            className="rounded bg-brand-red px-2 py-1 text-xs font-semibold text-white hover:bg-brand-red-dark disabled:opacity-50"
                          >
                            {isSavingEdit ? t('saving') : tCommon('actions.save')}
                          </button>
                          <button
                            type="button"
                            onClick={cancelEdit}
                            className="rounded border border-brand-cream-3 px-2 py-1 text-xs font-semibold text-brand-ink-3 hover:bg-brand-cream-2"
                          >
                            {tCommon('actions.cancel')}
                          </button>
                        </span>
                      ) : confirmDeleteId === cat.id ? (
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
