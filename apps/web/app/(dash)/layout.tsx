/**
 * Dashboard layout — session-protected shell with sidebar.
 * All routes under /(dash)/* require authentication.
 * Middleware handles the redirect, this layout provides the session context.
 */

import { getSession } from '@/lib/auth';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { LocaleSwitcher } from './locale-switcher';
import { LogoutButton } from './logout-button';
import { Sidebar } from './sidebar';

export const dynamic = 'force-dynamic';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  const t = await getTranslations('shell');

  if (!session) {
    redirect('/login');
  }

  if ((session.user as Record<string, unknown>)?.status === 'suspended') {
    redirect('/login?error=suspended');
  }

  return (
    <div className="flex min-h-screen">
      {/* Sidebar navigation */}
      <Sidebar />

      {/* Main content */}
      <div className="flex flex-1 flex-col">
        {/* Top bar */}
        <header className="flex h-14 items-center justify-end border-b border-brand-cream-3 bg-card px-6">
          <div className="flex items-center gap-3">
            <LocaleSwitcher />
            <Link
              href="/account"
              className="flex items-center gap-2 rounded-lg px-2 py-1 transition hover:bg-brand-cream-1"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-red/10">
                <span className="text-sm font-semibold text-brand-red">
                  {String(session.user?.name || session.user?.email || t('accountFallback'))
                    .charAt(0)
                    .toUpperCase()}
                </span>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-brand-ink">
                  {String(session.user?.name || t('accountFallback'))}
                </p>
                <p className="text-[11px] text-brand-ink-3">{String(session.user?.email || '')}</p>
              </div>
            </Link>
            <LogoutButton label={t('logout')} loadingLabel={t('loggingOut')} />
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 bg-brand-cream p-6">{children}</main>
      </div>
    </div>
  );
}
