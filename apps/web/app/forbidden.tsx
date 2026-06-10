import { getTranslations } from 'next-intl/server';

export default async function Forbidden() {
  const t = await getTranslations('common.forbidden');

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-brand-cream px-4 py-16">
      <div className="w-full max-w-md text-center">
        <h1 className="text-9xl font-bold tracking-tight text-brand-gold/20">403</h1>
        <h2 className="mt-4 text-2xl font-semibold tracking-tight text-brand-ink">{t('title')}</h2>
        <p className="mt-2 text-sm text-brand-ink-3">{t('message')}</p>
        <div className="mt-8">
          <a
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-lg bg-brand-ember-5 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-ember-6"
          >
            {t('back')}
          </a>
        </div>
      </div>
    </div>
  );
}
