'use client';

import type { EditableDocsContent } from '@/app/(dash)/docs/editable-docs';
import { PageHeader } from '@/components/page-header';
import { Input } from '@erp/ui';
import { useTranslations } from 'next-intl';
import { useActionState, useState } from 'react';
import { saveDocsEditorContent } from './actions';

const LOCALES = [
  { code: 'id', label: 'Bahasa Indonesia' },
  { code: 'en', label: 'English' },
  { code: 'zh', label: '中文' },
] as const;

type ActionState = {
  ok: boolean;
  message?: string;
};

export function DocsEditorForm({ initialContent }: { initialContent: EditableDocsContent }) {
  const t = useTranslations('docs.editor');
  const [activeLocale, setActiveLocale] = useState<'id' | 'en' | 'zh'>('id');
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    saveDocsEditorContent,
    { ok: false },
  );

  return (
    <form action={formAction} className="space-y-6">
      <PageHeader
        title={t('title')}
        description={t('subtitle')}
        eyebrow={t('eyebrow')}
        actions={
          <button
            type="submit"
            name="_intent"
            value="save"
            disabled={pending}
            className="inline-flex h-10 items-center justify-center rounded-md bg-brand-red px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-red-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? t('saving') : t('save')}
          </button>
        }
      />

      {state.message && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            state.ok
              ? 'border-brand-jade/30 bg-brand-jade/10 text-brand-jade'
              : 'border-brand-red/30 bg-brand-red/10 text-brand-red'
          }`}
        >
          {t(state.message.replace('docs.editor.', '') as never)}
        </div>
      )}

      <section className="rounded-lg border border-brand-gold/30 bg-brand-gold/5 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-brand-ink">{t('refreshTitle')}</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-brand-ink-2">
              {t('refreshDescription')}
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              {LOCALES.map((locale) => (
                <label
                  key={locale.code}
                  className="inline-flex items-center gap-2 rounded-md border border-brand-cream-3 bg-card px-3 py-2 text-sm font-medium text-brand-ink-2"
                >
                  <input
                    type="checkbox"
                    name="refresh_locale"
                    value={locale.code}
                    className="h-4 w-4 rounded border-brand-ink/20 text-brand-red"
                  />
                  {t('refreshLocale', { locale: locale.label })}
                </label>
              ))}
            </div>
          </div>
          <button
            type="submit"
            name="_intent"
            value="refresh_defaults"
            disabled={pending}
            className="inline-flex h-10 shrink-0 items-center justify-center rounded-md border border-brand-red/30 bg-card px-4 text-sm font-semibold text-brand-red transition-colors hover:border-brand-red hover:bg-brand-red/5 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? t('saving') : t('refreshDefaults')}
          </button>
        </div>
      </section>

      <div className="rounded-lg border border-brand-cream-3 bg-card shadow-sm">
        <div className="flex flex-wrap gap-2 border-b border-brand-cream-3 p-4">
          {LOCALES.map((locale) => (
            <button
              key={locale.code}
              type="button"
              onClick={() => setActiveLocale(locale.code)}
              className={`rounded-md px-3 py-2 text-sm font-semibold transition-colors ${
                activeLocale === locale.code
                  ? 'bg-brand-red text-white'
                  : 'bg-brand-cream-1 text-brand-ink-2 hover:text-brand-ink'
              }`}
            >
              {locale.label}
            </button>
          ))}
        </div>

        {LOCALES.map((locale) => (
          <section
            key={locale.code}
            className={activeLocale === locale.code ? 'space-y-5 p-5' : 'hidden'}
          >
            <div className="grid gap-4 lg:grid-cols-2">
              <label className="block" htmlFor={`docs-title-${locale.code}`}>
                <span className="text-sm font-semibold text-brand-ink">{t('docTitle')}</span>
                <Input
                  id={`docs-title-${locale.code}`}
                  name={`title_${locale.code}`}
                  defaultValue={initialContent[locale.code].title}
                  className="mt-2 h-11 w-full rounded-md border border-brand-cream-3 bg-brand-cream px-3 text-sm text-brand-ink focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_var(--color-brand-cream),0_0_0_4px_var(--color-brand-red)]"
                />
              </label>
              <label className="block" htmlFor={`docs-subtitle-${locale.code}`}>
                <span className="text-sm font-semibold text-brand-ink">{t('docSubtitle')}</span>
                <Input
                  id={`docs-subtitle-${locale.code}`}
                  name={`subtitle_${locale.code}`}
                  defaultValue={initialContent[locale.code].subtitle}
                  className="mt-2 h-11 w-full rounded-md border border-brand-cream-3 bg-brand-cream px-3 text-sm text-brand-ink focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_var(--color-brand-cream),0_0_0_4px_var(--color-brand-red)]"
                />
              </label>
            </div>

            <label className="block" htmlFor={`docs-body-${locale.code}`}>
              <span className="text-sm font-semibold text-brand-ink">{t('body')}</span>
              <textarea
                id={`docs-body-${locale.code}`}
                name={`body_${locale.code}`}
                defaultValue={initialContent[locale.code].body}
                rows={26}
                className="mt-2 w-full rounded-md border border-brand-cream-3 bg-brand-cream px-3 py-3 font-mono text-sm leading-6 text-brand-ink focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_var(--color-brand-cream),0_0_0_4px_var(--color-brand-red)]"
              />
            </label>

            <div className="rounded-lg border border-brand-gold/30 bg-brand-gold/5 p-4 text-sm leading-6 text-brand-ink-2">
              {t('markdownHelp')}
            </div>
          </section>
        ))}
      </div>
    </form>
  );
}
