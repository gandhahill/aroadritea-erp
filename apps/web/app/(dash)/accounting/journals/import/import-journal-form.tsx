'use client';

import { Button, Input } from '@erp/ui';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';
import { importJournalCsvAction } from '../actions';

export function ImportJournalForm() {
  const t = useTranslations('accounting.journal.import');
  const [state, action, pending] = useActionState(importJournalCsvAction, null);

  return (
    <form action={action} className="rounded-xl border border-brand-cream-3 bg-card p-5 shadow-sm">
      {state?.ok ? (
        <div className="mb-4 rounded-lg border border-brand-jade/20 bg-brand-jade-light px-4 py-3 text-sm text-brand-jade">
          {t('success', { count: state.importedCount ?? 0 })}
        </div>
      ) : null}
      {state?.error ? (
        <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {state.error}
        </div>
      ) : null}

      <label className="block space-y-1.5">
        <span className="text-sm font-medium text-brand-ink">{t('file')}</span>
        <Input
          name="file"
          type="file"
          accept=".csv,text/csv"
          required
          className="block w-full text-sm text-brand-ink-2 file:mr-4 file:rounded-md file:border-0 file:bg-brand-red file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-brand-red-dark"
        />
      </label>

      <p className="mt-3 text-xs leading-5 text-brand-ink-3">{t('templateHint')}</p>

      <div className="mt-5 flex justify-end">
        <Button
          type="submit"
          disabled={pending}
          className="rounded-lg "
          variant="primary"
          size="lg"
        >
          {pending ? t('submitting') : t('submit')}
        </Button>
      </div>
    </form>
  );
}
