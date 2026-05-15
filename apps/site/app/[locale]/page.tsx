/**
 * Home Page - public site [locale]
 * SD §31.1, SoT §22.2
 */
import { getTranslations } from 'next-intl/server';

interface Props {
  params: Promise<{ locale: string }>;
}

interface HomeMenuGroup {
  name: string;
  description: string;
  price: string;
  items: string;
}

export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'home' });
  const common = await getTranslations({ locale, namespace: 'common' });
  const groups = t.raw('groups') as HomeMenuGroup[];
  const customItems = t.raw('customItems') as string[];
  const heroImages = [
    { src: '/photo/menu/bamboo-oolong-milk-tea.jpg', name: 'Bamboo Oolong Milk Tea' },
    { src: '/photo/menu/osmanthus-oolong-milk-tea.jpg', name: 'Osmanthus Oolong Milk Tea' },
    { src: '/photo/menu/glutinous-fragrant-lemon-tea.jpg', name: 'Glutinous Fragrant Lemon Tea' },
  ];

  return (
    <div className="overflow-hidden">
      <section className="relative min-h-[calc(100svh-76px)] px-4 py-10 sm:px-6 lg:py-14">
        <span
          className="brand-chinese-mark pointer-events-none absolute right-[-1rem] top-8 hidden select-none text-[8rem] leading-none text-brand-red/[0.055] md:block lg:right-[3vw] lg:text-[11rem]"
          aria-hidden="true"
        >
          {common('chineseTea')}
        </span>
        <div className="absolute inset-x-0 bottom-0 h-24 site-wave" aria-hidden="true" />
        <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="relative z-10">
            <p className="inline-flex rounded-full border border-brand-red/16 bg-brand-cream-1 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-brand-red">
              {t('eyebrow')}
            </p>
            <h1 className="brand-wordmark mt-6 max-w-3xl text-[clamp(3.2rem,9vw,7.2rem)] leading-[0.88] text-brand-red">
              {t('heroTitle')}
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-brand-ink-2 md:text-xl">
              {t('heroSubtitle')}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                href={`/${locale}/member/daftar`}
                className="inline-flex justify-center rounded-full bg-brand-red px-7 py-3 text-sm font-bold text-brand-cream shadow-pop transition-brand hover:-translate-y-0.5 hover:bg-brand-red-dark focus-visible:outline-none focus-visible:shadow-focus"
              >
                {t('ctaMember')}
              </a>
              <a
                href={`/${locale}/menu`}
                className="inline-flex justify-center rounded-full border border-brand-red/20 bg-brand-cream-1 px-7 py-3 text-sm font-bold text-brand-red shadow-soft transition-brand hover:-translate-y-0.5 hover:bg-brand-cream-2 focus-visible:outline-none focus-visible:shadow-focus"
              >
                {t('ctaMenu')}
              </a>
            </div>
          </div>

          <div className="relative z-10">
            <div className="relative mx-auto max-w-[560px] rounded-[8px] border border-brand-red/12 bg-brand-cream-1 p-3 shadow-pop">
              <div className="absolute -right-10 -top-10 hidden h-28 w-28 rounded-full border border-brand-gold/40 md:block" />
              <div className="relative overflow-hidden rounded-[8px] bg-brand-red text-brand-cream">
                <div className="grid aspect-[16/10] grid-cols-3 bg-brand-cream">
                  {heroImages.map((image) => (
                    <img
                      key={image.src}
                      src={image.src}
                      alt={image.name}
                      className="h-full w-full object-cover"
                    />
                  ))}
                </div>
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-brand-ink/80 to-transparent p-5">
                  <p className="text-xs font-bold uppercase tracking-[0.22em] text-brand-cream/70">
                    {t('heroFeatureLabel')}
                  </p>
                  <p className="mt-1 font-display text-2xl font-black">{t('heroFeatureItems')}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-3 text-xs font-bold text-brand-ink-3 sm:grid-cols-4">
                {customItems.slice(0, 4).map((item) => (
                  <span
                    key={item}
                    className="rounded-full border border-brand-red/10 bg-brand-cream px-3 py-2 text-center"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-brand-ink px-4 py-16 text-brand-cream sm:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-black md:text-5xl">{t('menuTitle')}</h2>
            <p className="mt-4 text-base leading-7 text-brand-cream/70">{t('menuSubtitle')}</p>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {groups.map((group) => (
              <article
                key={group.name}
                className="rounded-[8px] border border-brand-cream/12 bg-brand-cream/6 p-5 shadow-soft"
              >
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-gold">
                  {group.price}
                </p>
                <h3 className="mt-3 text-xl font-black text-brand-cream">{group.name}</h3>
                <p className="mt-3 text-sm leading-6 text-brand-cream/68">{group.description}</p>
                <p className="mt-5 text-sm leading-6 text-brand-cream/86">{group.items}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6">
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <h2 className="text-3xl font-black text-brand-ink md:text-5xl">{t('customTitle')}</h2>
            <p className="mt-4 max-w-xl text-base leading-7 text-brand-ink-2">
              {t('customSubtitle')}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {customItems.map((item) => (
              <div
                key={item}
                className="rounded-[8px] border border-brand-red/10 bg-brand-cream-1 p-4 text-center text-sm font-bold text-brand-ink shadow-soft"
              >
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-brand-red/10 px-4 py-14 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <h2 className="text-3xl font-black text-brand-red md:text-4xl">{t('locationTitle')}</h2>
            <p className="mt-3 max-w-2xl text-base leading-7 text-brand-ink-2">
              {t('locationSubtitle')}
            </p>
          </div>
          <a
            href={`/${locale}/lokasi`}
            className="inline-flex rounded-full border border-brand-red/20 bg-brand-cream-1 px-6 py-3 text-sm font-bold text-brand-red shadow-soft transition-brand hover:-translate-y-0.5 hover:bg-brand-cream-2 focus-visible:outline-none focus-visible:shadow-focus"
          >
            {t('ctaLocations')}
          </a>
        </div>
      </section>
    </div>
  );
}
