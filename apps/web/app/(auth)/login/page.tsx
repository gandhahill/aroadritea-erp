import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Masuk',
};

/**
 * Login page — branded Aroadri Tea login screen.
 * BRAND.md: "logo besar di tengah + tagline, latar brand.cream dengan radial spotlight halus."
 * SD §36.4: warm cream background + spot light radial halus.
 *
 * Note: actual auth logic will be implemented in T-0006.
 * This is the visual shell only.
 */
export default function LoginPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-brand-cream">
      {/* Radial spotlight — subtle warm glow (SD §36.4) */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse 60% 50% at 50% 40%, rgba(214,38,46,0.06) 0%, transparent 70%)',
        }}
        aria-hidden="true"
      />

      {/* Login card */}
      <div className="relative z-10 w-full max-w-sm px-6">
        {/* Logo area */}
        <div className="mb-10 flex flex-col items-center gap-3">
          {/* Logo placeholder — will use actual logo-primary.png */}
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-brand-red shadow-pop">
            <span className="font-display text-3xl font-bold text-white">A</span>
          </div>
          <div className="text-center">
            <h1 className="font-display text-2xl font-bold tracking-tight text-brand-ink">
              Aroadri Tea
            </h1>
            <p className="mt-1 text-sm text-brand-ink-3">
              Enterprise Resource Planning
            </p>
          </div>
        </div>

        {/* Form card */}
        <div className="surface-card p-6">
          <form className="flex flex-col gap-5">
            {/* Email */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="login-email" className="text-sm font-medium text-brand-ink-2">
                Email
              </label>
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                required
                placeholder="nama@aroadritea.com"
                className="h-10 w-full rounded-md border border-brand-cream-3 bg-white px-3 text-sm text-brand-ink placeholder:text-brand-ink-3/50 focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_var(--color-brand-cream),0_0_0_4px_var(--color-brand-red)]"
              />
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="login-password" className="text-sm font-medium text-brand-ink-2">
                Kata Sandi
              </label>
              <input
                id="login-password"
                type="password"
                autoComplete="current-password"
                required
                placeholder="••••••••"
                className="h-10 w-full rounded-md border border-brand-cream-3 bg-white px-3 text-sm text-brand-ink placeholder:text-brand-ink-3/50 focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_var(--color-brand-cream),0_0_0_4px_var(--color-brand-red)]"
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              className="interactive h-10 w-full rounded-md bg-brand-red font-medium text-white hover:bg-brand-red-dark active:scale-[0.98]"
              style={{ transition: 'all 220ms cubic-bezier(0.16, 1, 0.3, 1)' }}
            >
              Masuk
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-brand-ink-3">
          PT Gandha Hill Catering Management Indonesia
        </p>
      </div>
    </main>
  );
}
