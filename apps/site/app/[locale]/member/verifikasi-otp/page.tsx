/**
 * OTP Verification Page — SD §31.6
 */
import type { Metadata } from 'next';
import { OtpVerifyForm } from '../../../../components/otp-verify-form';

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string }>;
}

export async function generateMetadata(): Promise<Metadata> {
  return { title: 'Verifikasi OTP' };
}

export default async function VerifikasiOtpPage({ searchParams }: Props) {
  const params = await searchParams;
  if (!params.token) {
    return (
      <div className="mx-auto max-w-md px-4 py-12 text-center">
        <p className="text-brand-ink-3">Token tidak valid. Silakan daftar ulang.</p>
      </div>
    );
  }
  return <OtpVerifyForm />;
}