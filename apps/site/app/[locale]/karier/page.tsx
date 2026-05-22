/**
 * Public careers / lowongan page — fetches open job openings + lets
 * applicants submit a basic application form.
 */

import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { CareersClient } from './careers-client';

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'careers' });
  return {
    title: `${t('title')} — Aroadri Tea`,
  };
}

export const dynamic = 'force-dynamic';

export default async function CareersPage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'careers' });

  return (
    <div className="px-4 py-14 sm:px-6">
      <article className="mx-auto max-w-4xl">
        <h1 className="text-4xl font-black text-brand-ink md:text-5xl">
          {t('title')}
        </h1>
        <p className="mt-4 max-w-2xl text-base text-brand-ink-2">
          {t('subtitle')}
        </p>
        <div className="mt-8">
          <CareersClient />
        </div>
      </article>
    </div>
  );
}
