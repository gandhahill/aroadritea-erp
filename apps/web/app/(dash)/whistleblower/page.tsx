'use client';

import { FileUploadField } from '@/components/file-upload-field';
import { PageHeader } from '@/components/page-header';
import { Input, Select } from '@erp/ui';
import { useTranslations } from 'next-intl';
import { useActionState, useEffect, useState } from 'react';
import { submitWhistleblowerAction } from './actions';

export default function WhistleblowerPage() {
  const t = useTranslations('whistleblower');
  const [state, submitAction, isPending] = useActionState(submitWhistleblowerAction, null);
  const [success, setSuccess] = useState(false);
  const [attachmentUrl, setAttachmentUrl] = useState('');

  useEffect(() => {
    if (state?.ok) {
      setSuccess(true);
    }
  }, [state]);

  if (success) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-brand-jade/10 text-brand-jade">
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-brand-ink">{t('successTitle')}</h2>
          <p className="mt-2 text-sm text-brand-ink-3">{t('successMessage')}</p>
          <button
            onClick={() => {
              setSuccess(false);
              setAttachmentUrl('');
              // In a real app we might redirect or reset form
            }}
            className="mt-6 rounded-lg bg-brand-red px-6 py-2 text-sm font-semibold text-white hover:bg-brand-red-dark"
          >
            {t('submitAnother')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="mx-auto max-w-2xl">
        <PageHeader title={<>{t('title')}</>} description={<>{t('subtitle')}</>} />

        <form
          action={submitAction}
          className="space-y-6 rounded-xl border border-brand-cream-3 bg-card p-6 shadow-sm"
        >
          {state?.error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{state.error}</div>
          )}

          <div className="space-y-4">
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-brand-ink">{t('reportTitle')} *</span>
              <Input
                name="title"
                required
                className="w-full rounded-lg border border-brand-cream-3 bg-brand-cream px-3 py-2 text-sm text-brand-ink focus:border-brand-red focus:ring-1 focus:ring-brand-red outline-none"
                placeholder={t('titlePlaceholder')}
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-brand-ink">{t('category')} *</span>
              <Select
                name="category"
                required
                className="w-full rounded-lg border border-brand-cream-3 bg-brand-cream px-3 py-2 text-sm text-brand-ink focus:border-brand-red focus:ring-1 focus:ring-brand-red outline-none"
              >
                <option value="fraud">{t('catFraud')}</option>
                <option value="harassment">{t('catHarassment')}</option>
                <option value="safety">{t('catSafety')}</option>
                <option value="other">{t('catOther')}</option>
              </Select>
            </label>

            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-brand-ink">{t('content')} *</span>
              <textarea
                name="content"
                required
                rows={6}
                className="w-full rounded-lg border border-brand-cream-3 bg-brand-cream px-3 py-2 text-sm text-brand-ink focus:border-brand-red focus:ring-1 focus:ring-brand-red outline-none"
                placeholder={t('contentPlaceholder')}
              />
            </label>

            <div>
              <FileUploadField
                label={t('uploadEvidence')}
                hiddenName="attachmentUrl"
                value={attachmentUrl}
                area="whistleblower"
                visibility="private"
                onChange={(url) => setAttachmentUrl(url)}
              />
            </div>

            <p className="text-xs text-brand-ink-3">{t('anonymityNote')}</p>
          </div>

          <div className="flex justify-end pt-4">
            <button
              type="submit"
              disabled={isPending}
              className="rounded-lg bg-brand-red px-6 py-2 text-sm font-semibold text-white shadow-soft transition hover:bg-brand-red-dark disabled:opacity-50"
            >
              {isPending ? t('submitting') : t('submit')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
