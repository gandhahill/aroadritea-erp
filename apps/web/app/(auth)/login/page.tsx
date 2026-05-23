'use client';

/**
 * Login page — wired to better-auth via authClient.
 * SD §11.1: Email + password authentication.
 * Uses i18n keys from auth.login.* namespace.
 */

import { recordAuthEvent } from '@/lib/audit-auth';
import { authClient } from '@/lib/auth-client';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import { type FormEvent, Suspense, useState } from 'react';
import { Input, Select } from "@erp/ui";

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginShell />}>
      <LoginContent />
    </Suspense>
  );
}

function LoginContent() {
  const t = useTranslations('auth.login');
  const app = useTranslations('app');
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [selectedLocale, setSelectedLocale] = useState(locale);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showTwoFactor, setShowTwoFactor] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const callbackUrl = searchParams.get('callbackUrl') ?? '/dashboard';
  const suspendedError = searchParams.get('error') === 'suspended';

  function handleLocaleChange(nextLocale: string) {
    setSelectedLocale(nextLocale);
    document.cookie = `aroadri.locale=${nextLocale};path=/;max-age=${60 * 60 * 24 * 365};samesite=lax`;
    router.refresh();
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (showTwoFactor) {
        const result = await authClient.twoFactor.verifyTotp({
          code: twoFactorCode,
        });

        if (result.error) {
          setError(t('errorInvalidTotp') || 'Invalid 2FA code');
          void recordAuthEvent({ action: 'login_failed', email, reason: 'invalid_totp' });
        } else {
          document.cookie = `aroadri.locale=${selectedLocale};path=/;max-age=${60 * 60 * 24 * 365};samesite=lax`;
          void recordAuthEvent({ action: 'login', email });
          router.push(callbackUrl);
          router.refresh();
        }
        return;
      }

      const result = await authClient.signIn.email({
        email,
        password,
      });

      if (result.error) {
        setError(t('errorInvalid'));
        void recordAuthEvent({ action: 'login_failed', email, reason: 'invalid_credentials' });
      } else if ((result.data as any)?.twoFactorRedirect) {
        setShowTwoFactor(true);
      } else {
        document.cookie = `aroadri.locale=${selectedLocale};path=/;max-age=${60 * 60 * 24 * 365};samesite=lax`;
        void recordAuthEvent({ action: 'login', email });
        router.push(callbackUrl);
        router.refresh();
      }
    } catch {
      setError(t('errorServer'));
      void recordAuthEvent({ action: 'login_failed', email, reason: 'server_error' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-brand-cream">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 60% 50% at 50% 40%, rgba(214,38,46,0.06) 0%, transparent 70%)',
        }}
        aria-hidden="true"
      />
      <div className="relative z-10 w-full max-w-sm px-6">
        {/* Brand header */}
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
              {app('name')}
            </h1>
            <p className="mt-1 text-sm text-brand-ink-3">{app('tagline')}</p>
          </div>
        </div>

        {/* Login card */}
        <div className="surface-card p-6">
          {/* Suspended account warning */}
          {suspendedError && (
            <div
              className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700"
              role="alert"
              id="suspended-alert"
            >
              {t('errorSuspended')}
            </div>
          )}

          {/* Error message */}
          {error && (
            <div
              className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700"
              role="alert"
              id="login-error"
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {!showTwoFactor ? (
              <>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="login-locale" className="text-sm font-medium text-brand-ink-2">
                    {t('language')}
                  </label>
                  <Select
                    id="login-locale"
                    value={selectedLocale}
                    onChange={(e) => handleLocaleChange(e.target.value)}
                    disabled={loading}
                    className="h-10 w-full rounded-md border border-brand-cream-3 bg-card px-3 text-sm text-brand-ink focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_var(--color-brand-cream),0_0_0_4px_var(--color-brand-red)] disabled:opacity-50"
                  >
                    <option value="id">{t('languageId')}</option>
                    <option value="en">{t('languageEn')}</option>
                    <option value="zh">{t('languageZh')}</option>
                  </Select>
                </div>

                {/* Email field */}
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="login-email" className="text-sm font-medium text-brand-ink-2">
                    {t('email')}
                  </label>
                  <Input
                    id="login-email"
                    type="email"
                    autoComplete="email"
                    required
                    placeholder="nama@aroadritea.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                    className="h-10 w-full rounded-md border border-brand-cream-3 bg-card px-3 text-sm text-brand-ink placeholder:text-brand-ink-3/50 focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_var(--color-brand-cream),0_0_0_4px_var(--color-brand-red)] disabled:opacity-50"
                  />
                </div>
                {/* Password field with toggle */}
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="login-password" className="text-sm font-medium text-brand-ink-2">
                    {t('password')}
                  </label>
                  <div className="relative">
                    <Input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      required
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={loading}
                      className="h-10 w-full rounded-md border border-brand-cream-3 bg-card px-3 pr-10 text-sm text-brand-ink placeholder:text-brand-ink-3/50 focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_var(--color-brand-cream),0_0_0_4px_var(--color-brand-red)] disabled:opacity-50"
                    />
                    <button
                      type="button"
                      id="toggle-password"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-brand-ink-3 hover:text-brand-ink"
                      aria-label={showPassword ? t('hidePassword') : t('showPassword')}
                    >
                      {showPassword ? (
                        <svg
                          aria-hidden="true"
                          xmlns="http://www.w3.org/2000/svg"
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                          <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                          <line x1="1" y1="1" x2="23" y2="23" />
                        </svg>
                      ) : (
                        <svg
                          aria-hidden="true"
                          xmlns="http://www.w3.org/2000/svg"
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-col gap-1.5">
                <label htmlFor="login-totp" className="text-sm font-medium text-brand-ink-2">
                  {t('totpCode') || 'OTP Code'}
                </label>
                <Input
                  id="login-totp"
                  type="text"
                  required
                  placeholder="123456"
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(e.target.value)}
                  disabled={loading}
                  className="h-10 w-full rounded-md border border-brand-cream-3 bg-card px-3 text-sm text-brand-ink placeholder:text-brand-ink-3/50 focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_var(--color-brand-cream),0_0_0_4px_var(--color-brand-red)] disabled:opacity-50"
                />
              </div>
            )}

            {/* Submit button */}
            <button
              type="submit"
              id="login-submit"
              disabled={loading}
              className="interactive h-10 w-full rounded-md bg-brand-red font-medium text-white hover:bg-brand-red-dark active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ transition: 'all 220ms cubic-bezier(0.16, 1, 0.3, 1)' }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg
                    aria-hidden="true"
                    className="h-4 w-4 animate-spin"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  {t('submitting')}
                </span>
              ) : (
                t('submit')
              )}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-brand-ink-3">{app('company')}</p>
      </div>
    </main>
  );
}

function LoginShell() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-brand-cream">
      <div className="relative z-10 w-full max-w-sm px-6">
        <div className="surface-card h-72 animate-pulse p-6" />
      </div>
    </main>
  );
}
