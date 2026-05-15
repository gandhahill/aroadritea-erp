/**
 * OTP Verification Page — SD §31.6
 */
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { OtpVerifyForm } from '../../../../components/otp-verify-form';

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'member.otp' });
  return { title: t('title') };
}

export default async function VerifikasiOtpPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'member.otp' });
  const query = await searchParams;
  if (!query.token) {
    return (
      <div className="mx-auto max-w-md px-4 py-12 text-center">
        <p className="text-brand-ink-3">{t('invalidToken')}</p>
      </div>
    );
  }
  return <OtpVerifyForm locale={locale} />;
}
