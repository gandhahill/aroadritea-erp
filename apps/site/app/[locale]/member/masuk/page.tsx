/**
 * Member Login Page — SD §31.5
 *
 * Email + password login for existing members.
 */
'use client';

import { useTranslations } from 'next-intl';
import { useParams, useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { loginAction } from '../../../../actions/member';

export default function LoginPage() {
  const t = useTranslations('member.login');
  const params = useParams();
  const locale = params.locale as string;
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const result = await loginAction(formData);
      if (!result.success) {
        setError(result.error ?? t('error'));
      } else {
        router.push(`/${locale}/member/akun`);
        router.refresh();
      }
    });
  }

  return (
    <section className="mx-auto max-w-md px-4 py-16 sm:px-6">
      <div className="rounded-2xl border border-brand-red/10 bg-brand-cream-1 p-8 shadow-soft">
        <h1 className="brand-wordmark text-center text-2xl text-brand-red">{t('title')}</h1>
        <p className="mt-2 text-center text-sm text-brand-ink-3">{t('subtitle')}</p>

        {error && (
          <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <label className="block space-y-1">
            <span className="text-sm font-semibold text-brand-ink">{t('email')}</span>
            <input
              type="email"
              name="email"
              required
              placeholder={t('emailPlaceholder')}
              className="h-10 w-full rounded-lg border border-brand-cream-3 bg-brand-cream px-3 text-sm text-brand-ink focus:border-brand-red focus:outline-none"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-semibold text-brand-ink">{t('password')}</span>
            <input
              type="password"
              name="password"
              required
              placeholder={t('passwordPlaceholder')}
              className="h-10 w-full rounded-lg border border-brand-cream-3 bg-brand-cream px-3 text-sm text-brand-ink focus:border-brand-red focus:outline-none"
            />
          </label>
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-full bg-brand-red py-3 text-sm font-bold text-brand-cream shadow-soft transition-brand hover:bg-brand-red-dark disabled:opacity-50"
          >
            {pending ? t('submitting') : t('submit')}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-brand-ink-3">
          {t('noAccount')}{' '}
          <a
            href={`/${locale}/member/daftar`}
            className="font-semibold text-brand-red hover:underline"
          >
            {t('register')}
          </a>
        </p>
      </div>
    </section>
  );
}
