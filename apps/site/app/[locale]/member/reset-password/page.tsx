/**
 * Member reset password page.
 */
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { PasswordResetForm } from '../../../../components/password-reset-form';

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'member.passwordReset.complete' });
  return { title: t('title') };
}

export default async function ResetPasswordPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'member.passwordReset.complete' });
  const query = await searchParams;

  if (!query.token) {
    return (
      <section className="mx-auto max-w-md px-4 py-16 text-center sm:px-6">
        <p className="text-sm text-brand-ink-3">{t('invalidToken')}</p>
      </section>
    );
  }

  return <PasswordResetForm locale={locale} token={query.token} />;
}
