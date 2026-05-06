import type { Metadata } from 'next';
import { useTranslations } from 'next-intl';

export const metadata: Metadata = { title: 'Masuk' };

export default function LoginPage() {
  const t = useTranslations('auth.login');
  const app = useTranslations('app');

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-brand-cream">
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(ellipse 60% 50% at 50% 40%, rgba(214,38,46,0.06) 0%, transparent 70%)' }}
        aria-hidden="true"
      />
      <div className="relative z-10 w-full max-w-sm px-6">
        <div className="mb-10 flex flex-col items-center gap-3">
          <img src="/logo-primary.png" alt="Aroadri Tea" width={96} height={96} className="h-24 w-24 drop-shadow-lg" />
          <div className="text-center">
            <h1 className="font-display text-2xl font-bold tracking-tight text-brand-ink">{app('name')}</h1>
            <p className="mt-1 text-sm text-brand-ink-3">{app('tagline')}</p>
          </div>
        </div>
        <div className="surface-card p-6">
          <form className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="login-email" className="text-sm font-medium text-brand-ink-2">{t('email')}</label>
              <input id="login-email" type="email" autoComplete="email" required placeholder="nama@aroadritea.com"
                className="h-10 w-full rounded-md border border-brand-cream-3 bg-white px-3 text-sm text-brand-ink placeholder:text-brand-ink-3/50 focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_var(--color-brand-cream),0_0_0_4px_var(--color-brand-red)]" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="login-password" className="text-sm font-medium text-brand-ink-2">{t('password')}</label>
              <input id="login-password" type="password" autoComplete="current-password" required placeholder="••••••••"
                className="h-10 w-full rounded-md border border-brand-cream-3 bg-white px-3 text-sm text-brand-ink placeholder:text-brand-ink-3/50 focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_var(--color-brand-cream),0_0_0_4px_var(--color-brand-red)]" />
            </div>
            <button type="submit"
              className="interactive h-10 w-full rounded-md bg-brand-red font-medium text-white hover:bg-brand-red-dark active:scale-[0.98]"
              style={{ transition: 'all 220ms cubic-bezier(0.16, 1, 0.3, 1)' }}>
              {t('submit')}
            </button>
          </form>
        </div>
        <p className="mt-6 text-center text-xs text-brand-ink-3">{app('company')}</p>
      </div>
    </main>
  );
}
