/**
 * OTP Verification Page — SD §31.6
 */
'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';
import { completeSignupAction, verifyOtpAction } from '../actions/member';

interface Props {
  locale: string;
}

export function OtpVerifyForm({ locale }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [step, setStep] = useState<'otp' | 'complete'>('otp');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Form fields for complete step
  const [name, setName] = useState('');
  const [city, setCity] = useState('');

  function handleOtpSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const code = new FormData(e.currentTarget).get('code') as string;

    startTransition(async () => {
      const result = await verifyOtpAction(token, code);
      if (!result.success) {
        setError(String(result.error));
        return;
      }
      setStep('complete');
    });
  }

  function handleCompleteSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const result = await completeSignupAction(formData, token);
      if (!result.success) {
        setError(String(result.error));
        return;
      }
      router.push(`/${locale}/member/akun`);
      router.refresh();
    });
  }

  if (step === 'complete') {
    return (
      <div className="mx-auto max-w-md px-4 py-12">
        <h1 className="text-2xl font-bold text-brand-ink">Lengkapi Data</h1>
        <form onSubmit={handleCompleteSubmit} className="mt-6 space-y-4">
          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
          <div>
            <label
              htmlFor="member-complete-name"
              className="mb-1 block text-sm font-medium text-brand-ink"
            >
              Nama Lengkap
            </label>
            <input
              id="member-complete-name"
              name="name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-brand-cream-3 bg-brand-cream-1 px-3 py-2 text-brand-ink"
            />
          </div>
          <div>
            <label
              htmlFor="member-complete-city"
              className="mb-1 block text-sm font-medium text-brand-ink"
            >
              Kota
            </label>
            <input
              id="member-complete-city"
              name="city"
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full rounded-md border border-brand-cream-3 bg-brand-cream-1 px-3 py-2 text-brand-ink"
            />
          </div>
          <input name="consentGiven" type="checkbox" defaultChecked className="hidden" />
          <button
            type="submit"
            disabled={isPending}
            className="w-full rounded-md bg-brand-red py-3 text-sm font-semibold text-white hover:bg-brand-red/90 disabled:opacity-50"
          >
            {isPending ? 'Mendaftarkan...' : 'Daftar'}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-2xl font-bold text-brand-ink">Verifikasi Email</h1>
      <p className="mt-2 text-sm text-brand-ink-3">
        Masukkan kode 6 digit yang kami kirim ke email Anda.
      </p>
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
            Kode OTP
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
          {isPending ? 'Memverifikasi...' : 'Verifikasi'}
        </button>
      </form>
    </div>
  );
}
