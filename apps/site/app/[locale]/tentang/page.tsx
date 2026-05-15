/**
 * About Page - SD §22.2
 */
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

interface Props {
  params: Promise<{ locale: string }>;
}

interface Pillar {
  title: string;
  desc: string;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'about' });
  return { title: t('title'), description: t('body') };
}

export default async function AboutPage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'about' });
  const pillars = t.raw('pillars') as Pillar[];

  return (
    <div className="px-4 py-14 sm:px-6">
      <section className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
        <div>
          <p className="inline-flex rounded-full border border-brand-red/16 bg-brand-cream-1 px-3 py-1 text-xs font-bold uppercase text-brand-red">
            {t('eyebrow')}
          </p>
          <h1 className="mt-5 text-4xl font-black leading-tight text-brand-ink md:text-6xl">
            {t('title')}
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-brand-ink-2">{t('body')}</p>
        </div>

        <div className="relative overflow-hidden rounded-[8px] border border-brand-red/10 bg-brand-cream-1 p-3 shadow-pop">
          <div className="grid aspect-[16/10] grid-cols-2 gap-2">
            {[
              '/photo/menu/bamboo-oolong-milk-tea.jpg',
              '/photo/menu/osmanthus-oolong-lemon-tea.jpg',
              '/photo/menu/snow-cap-bamboo.jpg',
              '/photo/menu/egg-tart.jpg',
            ].map((src) => (
              <img
                key={src}
                src={src}
                alt=""
                className="h-full w-full rounded-[8px] object-cover"
              />
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto mt-12 grid max-w-6xl gap-4 md:grid-cols-3">
        {pillars.map((pillar, index) => (
          <article
            key={pillar.title}
            className="rounded-[8px] border border-brand-red/10 bg-brand-cream-1 p-6 shadow-soft"
          >
            <p className="text-xs font-black uppercase text-brand-gold">0{index + 1}</p>
            <h2 className="mt-3 text-xl font-black text-brand-red">{pillar.title}</h2>
            <p className="mt-3 text-sm leading-6 text-brand-ink-2">{pillar.desc}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
