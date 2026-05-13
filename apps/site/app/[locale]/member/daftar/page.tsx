/**
 * Member Registration Page — SD §31.6
 */
import type { Metadata } from 'next';
import { SignupForm } from '../../../../components/signup-form';

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: locale === 'id' ? 'Daftar Member' : locale === 'zh' ? '注册会员' : 'Join Member',
  };
}

export default async function DaftarPage({ params }: Props) {
  const { locale } = await params;
  return <SignupForm locale={locale} />;
}
