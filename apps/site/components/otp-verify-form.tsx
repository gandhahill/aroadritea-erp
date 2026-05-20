/**
 * OTP Verification Page — SD §31.6
 */
'use client';

import { useTranslations } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';
import { verifyAndCompleteSignupAction } from '../actions/member';

interface Props {
  locale: string;
}

export function OtpVerifyForm({ locale }: Props) {
  const router = useRouter();
  const t = useTranslations('member.otp');
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleOtpSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const code = new FormData(e.currentTarget).get('code') as string;

    startTransition(async () => {
      const result = await verifyAndCompleteSignupAction(token, code);
      if (!result.success) {
        setError(String(result.error));
        return;
      }
      router.push(`/${locale}/member/akun`);
      router.refresh();
    });
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-2xl font-bold text-brand-ink">{t('title')}</h1>
      <p className="mt-2 text-sm text-brand-ink-3">{t('subtitle')}</p>
      <form onSubmit={handleOtpSubmit} className="mt-6 space-y-4">
        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
        <div>
          <label
            htmlFor="member-otp-code"
            className="mb-1 block text-sm font-medium text-brand-ink"
          >
            {t('code')}
          </label>
          <input
            id="member-otp-code"
            name="code"
            type="text"
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            required
            className="w-full rounded-md border border-brand-cream-3 bg-brand-cream-1 px-3 py-3 text-center text-2xl tracking-widest font-mono text-brand-ink letter-spacing-widest"
            placeholder="000000"
          />
        </div>
        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-md bg-brand-red py-3 text-sm font-semibold text-white hover:bg-brand-red/90 disabled:opacity-50"
        >
          {isPending ? t('completing') : t('verify')}
        </button>
      </form>
    </div>
  );
}
