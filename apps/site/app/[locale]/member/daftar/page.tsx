/**
 * Member Registration Page — SD §31.6
 */
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { SignupForm } from '../../../../components/signup-form';

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'member.signup' });
  return { title: t('title') };
}

export default async function DaftarPage({ params }: Props) {
  const { locale } = await params;
  return <SignupForm locale={locale} />;
}
