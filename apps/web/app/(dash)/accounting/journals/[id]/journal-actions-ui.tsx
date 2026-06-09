'use client';

import { useActionState, useState } from 'react';
import { useTranslations } from 'next-intl';
import { deleteJournalAction, postJournalAction, reverseJournalAction } from '../actions';

export function JournalActionsUI({
  journalId,
  status,
  defaultDate,
}: {
  journalId: string;
  status: string;
  defaultDate: string;
}) {
  const t = useTranslations('accounting.journals');
  const [postState, postAction, isPosting] = useActionState(postJournalAction, null);
  const [deleteState, deleteAction, isDeleting] = useActionState(deleteJournalAction, null);
  const [reverseState, reverseAction, isReversing] = useActionState(reverseJournalAction, null);

  const [showReverse, setShowReverse] = useState(false);

  return (
    <div className="flex items-center gap-2 mt-4 md:mt-0">
      {status === 'draft' && (
        <>
          <form action={postAction}>
            <input type="hidden" name="journalId" value={journalId} />
            <button
              type="submit"
              disabled={isPosting}
              className="inline-flex items-center gap-2 rounded-md bg-brand-jade px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-jade-dark disabled:opacity-50"
            >
              {isPosting ? t('posting') : t('postJournal')}
            </button>
          </form>
          <form action={deleteAction} onSubmit={(e) => {
            if (!confirm(t('confirmDelete'))) e.preventDefault();
          }}>
            <input type="hidden" name="journalId" value={journalId} />
            <button
              type="submit"
              disabled={isDeleting}
              className="inline-flex items-center gap-2 rounded-md border border-brand-red text-brand-red px-4 py-2 text-sm font-medium transition-colors hover:bg-brand-red/10 disabled:opacity-50"
            >
              {isDeleting ? t('deleting') : t('deleteDraft')}
            </button>
          </form>
        </>
      )}

      {status === 'posted' && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowReverse(!showReverse)}
            className="inline-flex items-center gap-2 rounded-md border border-brand-clay text-brand-clay px-4 py-2 text-sm font-medium transition-colors hover:bg-brand-clay/10"
          >
            {t('reverseJournal')}
          </button>
          
          {showReverse && (
            <div className="absolute right-0 top-full z-10 mt-2 w-64 rounded-md border border-brand-cream-2 bg-card p-4 shadow-pop">
              <form action={reverseAction}>
                <input type="hidden" name="journalId" value={journalId} />
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-brand-ink-2">{t('reversalDate')}</label>
                    <input 
                      type="date" 
                      name="postingDate" 
                      defaultValue={defaultDate}
                      required
                      className="mt-1 block w-full rounded-md border border-brand-cream-3 px-3 py-1.5 text-sm"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowReverse(false)}
                      className="px-3 py-1.5 text-sm text-brand-ink-3 hover:text-brand-ink"
                    >
                      {t('cancel')}
                    </button>
                    <button
                      type="submit"
                      disabled={isReversing}
                      className="rounded-md bg-brand-clay px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                    >
                      {isReversing ? t('reversing') : t('confirmReverse')}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {(postState?.error || deleteState?.error || reverseState?.error) && (
        <div className="absolute top-0 right-0 mt-16 mr-6 p-4 rounded-md bg-red-50 text-red-700 shadow-sm z-50">
          {postState?.error || deleteState?.error || reverseState?.error}
        </div>
      )}
    </div>
  );
}
