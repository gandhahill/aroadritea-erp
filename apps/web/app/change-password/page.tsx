'use client';

import { Input } from '@erp/ui';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import { changePasswordAction } from './actions';

export default function ChangePasswordPage() {
  const t = useTranslations('auth.changePassword');
  const app = useTranslations('app');
  const router = useRouter();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError(t('errorMismatch'));
      return;
    }

    if (newPassword.length < 8) {
      setError(t('errorLength'));
      return;
    }

    setLoading(true);

    try {
      const result = await changePasswordAction({
        currentPassword,
        newPassword,
        confirmPassword,
      });

      if (!result.ok) {
        const key = result.error?.replace('auth.changePassword.', '') as
          | 'errorMismatch'
          | 'errorLength'
          | 'errorServer'
          | undefined;
        setError(key ? t(key) : t('errorServer'));
      } else {
        router.push('/');
        router.refresh();
      }
    } catch {
      setError(t('errorServer'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-brand-cream">
      <div className="relative z-10 w-full max-w-sm px-6">
        <div className="mb-10 flex flex-col items-center gap-3">
          <img
            src="/logo-primary.png"
            alt="Aroadri Tea"
            width={96}
            height={96}
            className="h-24 w-24 drop-shadow-lg"
          />
          <div className="text-center">
            <h1 className="font-display text-2xl font-bold tracking-tight text-brand-ink">
              {t('title')}
            </h1>
            <p className="mt-1 text-sm text-brand-ink-3">{t('subtitle')}</p>
          </div>
        </div>

        <div className="surface-card p-6">
          {error && (
            <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700" role="alert">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="current-password" className="text-sm font-medium text-brand-ink-2">
                {t('currentPassword')}
              </label>
              <Input
                id="current-password"
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                disabled={loading}
                className="h-10 w-full rounded-md border border-brand-cream-3 bg-card px-3 text-sm text-brand-ink focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_var(--color-brand-cream),0_0_0_4px_var(--color-brand-red)] disabled:opacity-50"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="new-password" className="text-sm font-medium text-brand-ink-2">
                {t('newPassword')}
              </label>
              <Input
                id="new-password"
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={loading}
                className="h-10 w-full rounded-md border border-brand-cream-3 bg-card px-3 text-sm text-brand-ink focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_var(--color-brand-cream),0_0_0_4px_var(--color-brand-red)] disabled:opacity-50"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="confirm-password" className="text-sm font-medium text-brand-ink-2">
                {t('confirmPassword')}
              </label>
              <Input
                id="confirm-password"
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading}
                className="h-10 w-full rounded-md border border-brand-cream-3 bg-card px-3 text-sm text-brand-ink focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_var(--color-brand-cream),0_0_0_4px_var(--color-brand-red)] disabled:opacity-50"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="interactive h-10 w-full rounded-md bg-brand-red font-medium text-white hover:bg-brand-red-dark active:scale-[0.98] disabled:opacity-50"
              style={{ transition: 'all 220ms cubic-bezier(0.16, 1, 0.3, 1)' }}
            >
              {loading ? t('submitting') : t('submit')}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
