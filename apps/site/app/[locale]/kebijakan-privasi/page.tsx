import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

interface Props {
  params: Promise<{ locale: string }>;
}

interface LegalSection {
  title: string;
  body: string;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'legal.privacy' });
  return { title: t('title') };
}

export default async function PrivacyPage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'legal.privacy' });
  const sections = t.raw('sections') as LegalSection[];

  return (
    <LegalArticle
      title={t('title')}
      updated={t('updated')}
      intro={t('intro')}
      sections={sections}
    />
  );
}

function LegalArticle({
  title,
  updated,
  intro,
  sections,
}: {
  title: string;
  updated: string;
  intro: string;
  sections: LegalSection[];
}) {
  return (
    <div className="px-4 py-14 sm:px-6">
      <article className="mx-auto max-w-4xl">
        <p className="brand-tagline text-xs text-brand-red">{updated}</p>
        <h1 className="mt-4 text-4xl font-black text-brand-ink md:text-5xl">{title}</h1>
        <p className="mt-5 max-w-3xl text-base leading-7 text-brand-ink-2">{intro}</p>
        <div className="mt-10 divide-y divide-brand-red/10 border-y border-brand-red/10">
          {sections.map((section, index) => {
            const sectionTitle = section.title.replace(/^\d+\.\s*/, '');
            return (
              <section key={section.title} className="grid gap-4 py-7 md:grid-cols-[72px_1fr]">
                <p className="font-display text-2xl font-black text-brand-red">
                  {String(index + 1).padStart(2, '0')}
                </p>
                <div>
                  <h2 className="text-xl font-black text-brand-ink">{sectionTitle}</h2>
                  <p className="mt-3 text-sm leading-7 text-brand-ink-2">{section.body}</p>
                </div>
              </section>
            );
          })}
        </div>
      </article>
    </div>
  );
}
