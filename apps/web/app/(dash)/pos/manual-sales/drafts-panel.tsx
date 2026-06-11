'use client';

import { Button, toast } from '@erp/ui';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { type PosDraftItem, deletePosDraftAction, savePosDraftAction } from './draft-actions';

export type { PosDraftItem };

interface Props {
  kind: 'manual_sales' | 'consumed_ingredients';
  drafts: PosDraftItem[];
  activeDraftId: string | null;
  /** Snapshot the current form state, or null when there is nothing worth saving. */
  collectDraft: () => {
    title: string;
    locationId: string;
    payload: Record<string, unknown>;
  } | null;
  /** Push a stored draft back into the form state. */
  applyDraft: (draft: PosDraftItem) => void;
  onActiveDraftChange: (id: string | null) => void;
}

export function DraftsPanel({
  kind,
  drafts,
  activeDraftId,
  collectDraft,
  applyDraft,
  onActiveDraftChange,
}: Props) {
  const t = useTranslations('pos.manualSales');
  const locale = useLocale();
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleSave = async () => {
    const snapshot = collectDraft();
    if (!snapshot) {
      toast.error(t('draftEmptyForm'));
      return;
    }
    setIsSaving(true);
    try {
      const result = await savePosDraftAction({
        draftId: activeDraftId,
        kind,
        ...snapshot,
      });
      if (!result.ok) {
        toast.error(result.error ?? t('draftSaveFailed'));
        return;
      }
      onActiveDraftChange(result.id ?? null);
      toast.success(t('draftSaved'));
      router.refresh();
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setConfirmDeleteId(null);
    const result = await deletePosDraftAction(id);
    if (!result.ok) {
      toast.error(result.error ?? t('draftDeleteFailed'));
      return;
    }
    if (id === activeDraftId) onActiveDraftChange(null);
    router.refresh();
  };

  const formatUpdatedAt = (iso: string) => {
    const date = new Date(iso);
    if (!Number.isFinite(date.getTime())) return iso;
    return date.toLocaleString(locale, {
      timeZone: 'Asia/Jakarta',
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  };

  return (
    <div className="mt-4 border-t border-brand-cream-3 pt-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-brand-ink">{t('draftsTitle')}</h3>
        <Button type="button" variant="secondary" disabled={isSaving} onClick={handleSave}>
          {isSaving ? t('savingDraft') : t('saveDraft')}
        </Button>
      </div>
      {activeDraftId ? (
        <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {t('draftActive')}
        </p>
      ) : null}
      {drafts.length > 0 ? (
        <ul className="mt-3 divide-y divide-brand-cream-2 rounded-lg border border-brand-cream-3">
          {drafts.map((draft) => (
            <li
              key={draft.id}
              className={`flex flex-wrap items-center justify-between gap-2 px-3 py-2 ${
                draft.id === activeDraftId ? 'bg-brand-cream/60' : ''
              }`}
            >
              <div className="min-w-0">
                <span className="block truncate text-sm font-medium text-brand-ink">
                  {draft.title || t('draftUntitled')}
                </span>
                <span className="block text-xs text-brand-ink-3">
                  {formatUpdatedAt(draft.updatedAt)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {confirmDeleteId === draft.id ? (
                  <>
                    <span className="text-xs text-brand-ink-3">{t('draftConfirmDelete')}</span>
                    <button
                      type="button"
                      onClick={() => handleDelete(draft.id)}
                      className="rounded bg-rose-500 px-2 py-1 text-xs font-semibold text-white hover:bg-rose-600"
                    >
                      {t('draftDelete')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(null)}
                      className="rounded border border-brand-cream-3 px-2 py-1 text-xs font-semibold text-brand-ink-3 hover:bg-brand-cream-2"
                    >
                      {t('cancel')}
                    </button>
                  </>
                ) : (
                  <>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        applyDraft(draft);
                        onActiveDraftChange(draft.id);
                      }}
                    >
                      {t('draftLoad')}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-brand-red"
                      onClick={() => setConfirmDeleteId(draft.id)}
                    >
                      {t('draftDelete')}
                    </Button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
