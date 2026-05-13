/**
 * Member Registration Page — SD §31.6
 */
'use client';

import { useRouter } from 'next/navigation';
import Script from 'next/script';
import { useState, useTransition } from 'react';
import { signupAction } from '../actions/member';

interface Props {
  locale: string;
}

export function SignupForm({ locale }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const allowDevCaptcha = process.env.NODE_ENV !== 'production';

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const result = await signupAction(formData);
      if (!result.success) {
        setError(String(result.error));
        return;
      }
      const token = encodeURIComponent(result.token ?? '');
      router.push(`/${locale}/member/verifikasi-otp?token=${token}`);
    });
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-2xl font-bold text-brand-ink">Daftar Member</h1>
      <p className="mt-2 text-sm text-brand-ink-3">
        Bergabung dan kumpulkan poin untuk setiap pembelian.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="member-name" className="mb-1 block text-sm font-medium text-brand-ink">
            Nama Lengkap
          </label>
          <input
            id="member-name"
            name="name"
            type="text"
            required
            className="w-full rounded-md border border-brand-cream-3 bg-brand-cream-1 px-3 py-2 text-brand-ink"
            placeholder="Nama lengkap"
          />
        </div>

        <div>
          <label htmlFor="member-email" className="mb-1 block text-sm font-medium text-brand-ink">
            Email
          </label>
          <input
            id="member-email"
            name="email"
            type="email"
            required
            className="w-full rounded-md border border-brand-cream-3 bg-brand-cream-1 px-3 py-2 text-brand-ink"
            placeholder="email@contoh.com"
          />
        </div>

        <div>
          <label htmlFor="member-phone" className="mb-1 block text-sm font-medium text-brand-ink">
            No. HP
          </label>
          <input
            id="member-phone"
            name="phone"
            type="tel"
            required
            className="w-full rounded-md border border-brand-cream-3 bg-brand-cream-1 px-3 py-2 text-brand-ink"
            placeholder="08xxxxxxxxxx"
          />
        </div>

        <div>
          <label htmlFor="member-city" className="mb-1 block text-sm font-medium text-brand-ink">
            Kota
          </label>
          <input
            id="member-city"
            name="city"
            type="text"
            className="w-full rounded-md border border-brand-cream-3 bg-brand-cream-1 px-3 py-2 text-brand-ink"
            placeholder="Yogyakarta"
          />
        </div>

        <div>
          <label
            htmlFor="member-password"
            className="mb-1 block text-sm font-medium text-brand-ink"
          >
            Kata Sandi
          </label>
          <input
            id="member-password"
            name="password"
            type="password"
            required
            minLength={8}
            className="w-full rounded-md border border-brand-cream-3 bg-brand-cream-1 px-3 py-2 text-brand-ink"
            placeholder="Min. 8 karakter"
          />
        </div>

        <label className="flex items-start gap-2">
          <input
            name="consentGiven"
            type="checkbox"
            required
            className="mt-1 h-4 w-4 rounded border-brand-cream-3 text-brand-red"
          />
          <span className="text-sm text-brand-ink-2">
            Saya menyetujui{' '}
            <a href={`/${locale}/syarat-dan-ketentuan`} className="text-brand-red underline">
              Syarat & Ketentuan
            </a>{' '}
            dan{' '}
            <a href={`/${locale}/kebijakan-privasi`} className="text-brand-red underline">
              Kebijakan Privasi
            </a>
            .
          </span>
        </label>

        {turnstileSiteKey ? (
          <>
            <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer />
            <div className="cf-turnstile" data-sitekey={turnstileSiteKey} />
          </>
        ) : allowDevCaptcha ? (
          <input name="turnstileToken" type="hidden" value="dev-token" />
        ) : null}

        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-md bg-brand-red py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-red/90 disabled:opacity-50"
        >
          {isPending ? 'Mengirim OTP...' : 'Daftar'}
        </button>
      </form>
    </div>
  );
}
