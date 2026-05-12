/**
 * Home Page — public site [locale]
 * SD §31.1, SoT §22.2
 */
import { getTranslations } from 'next-intl/server';

interface Props {
  params: Promise<{ locale: string }>;
}

export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'home' });
  const tBrand = await getTranslations({ locale, namespace: 'common' });

  return (
    <div>
      {/* Hero */}
      <section className="bg-brand-red px-4 py-20 text-center text-white">
        <div className="mx-auto max-w-2xl">
          <h1 className="text-4xl font-bold leading-tight md:text-5xl">{t('heroTitle')}</h1>
          <p className="mt-4 text-lg text-red-100 opacity-90">{t('heroSubtitle')}</p>
          <div className="mt-8 flex justify-center gap-4">
            <a
              href={`/${locale}/menu`}
              className="rounded-full bg-white px-8 py-3 font-semibold text-brand-red transition-colors hover:bg-red-50"
            >
              {t('ctaMenu')}
            </a>
          </div>
        </div>
      </section>

      {/* Popular — placeholder */}
      <section className="mx-auto max-w-5xl px-4 py-16 text-center">
        <h2 className="text-2xl font-bold text-brand-ink">{t('popularTitle')}</h2>
        <p className="mt-2 text-brand-ink-3">{t('popularSubtitle')}</p>
        <div className="mt-8 grid grid-cols-3 gap-4">
          {['Brown Sugar', 'Taro Milk', 'Matcha Latte'].map((name) => (
            <div key={name} className="rounded-xl bg-white p-4 text-center shadow-sm">
              <div className="mx-auto mb-2 flex h-24 w-24 items-center justify-center rounded-full bg-brand-cream-3 text-2xl">🧋</div>
              <p className="font-medium text-brand-ink">{name}</p>
            </div>
          ))}
        </div>
        <a href={`/${locale}/menu`} className="mt-8 inline-block text-brand-red hover:underline">
          {t('ctaMenu')} →
        </a>
      </section>
    </div>
  );
}
