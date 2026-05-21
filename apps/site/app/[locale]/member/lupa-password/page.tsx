/**
 * Member forgot password page.
 */
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { PasswordResetRequestForm } from '../../../../components/password-reset-request-form';

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'member.passwordReset.request' });
  return { title: t('title') };
}

export default async function LupaPasswordPage({ params }: Props) {
  const { locale } = await params;
  return <PasswordResetRequestForm locale={locale} />;
}
