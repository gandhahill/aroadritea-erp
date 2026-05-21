/**
 * Password reset completion form for member portal.
 */
'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { resetPasswordAction } from '../actions/member';

interface Props {
  locale: string;
  token: string;
}

export function PasswordResetForm({ locale, token }: Props) {
  const t = useTranslations('member.passwordReset.complete');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const result = await resetPasswordAction(formData, token);
      if (!result.success) {
        setError(result.error ?? t('error'));
        return;
      }
      setDone(true);
    });
  }

  return (
    <section className="mx-auto max-w-md px-4 py-16 sm:px-6">
      <div className="rounded-2xl border border-brand-red/10 bg-brand-cream-1 p-8 shadow-soft">
        <h1 className="brand-wordmark text-center text-2xl text-brand-red">{t('title')}</h1>
        <p className="mt-2 text-center text-sm text-brand-ink-3">{t('subtitle')}</p>

        {done ? (
          <div className="mt-6 space-y-4">
            <div className="rounded-lg border border-brand-jade/20 bg-brand-jade/10 px-4 py-4 text-sm text-brand-ink-2">
              {t('success')}
            </div>
            <button
              type="button"
              onClick={() => router.push(`/${locale}/member/masuk`)}
              className="w-full rounded-full bg-brand-red py-3 text-sm font-bold text-brand-cream shadow-soft transition-brand hover:bg-brand-red-dark"
            >
              {t('login')}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {error && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </div>
            )}
            <label className="block space-y-1">
              <span className="text-sm font-semibold text-brand-ink">{t('password')}</span>
              <input
                type="password"
                name="password"
                required
                minLength={8}
                placeholder={t('passwordPlaceholder')}
                className="h-10 w-full rounded-lg border border-brand-cream-3 bg-brand-cream px-3 text-sm text-brand-ink focus:border-brand-red focus:outline-none"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-sm font-semibold text-brand-ink">{t('passwordConfirm')}</span>
              <input
                type="password"
                name="passwordConfirm"
                required
                minLength={8}
                placeholder={t('passwordConfirmPlaceholder')}
                className="h-10 w-full rounded-lg border border-brand-cream-3 bg-brand-cream px-3 text-sm text-brand-ink focus:border-brand-red focus:outline-none"
              />
            </label>
            <button
              type="submit"
              disabled={isPending}
              className="w-full rounded-full bg-brand-red py-3 text-sm font-bold text-brand-cream shadow-soft transition-brand hover:bg-brand-red-dark disabled:opacity-50"
            >
              {isPending ? t('submitting') : t('submit')}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
