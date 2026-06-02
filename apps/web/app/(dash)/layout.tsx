/**
 * Dashboard layout — session-protected shell with sidebar.
 * All routes under /(dash)/* require authentication.
 * Middleware handles the redirect, this layout provides the session context.
 */

import { ErrorBoundary, GlobalErrorListener } from '@/components/error-reporter';
import { getSession } from '@/lib/auth';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { LocaleSwitcher } from './locale-switcher';
import { LogoImage } from './logo-image';
import { LogoutButton } from './logout-button';
import { MobileMenuButton } from './mobile-menu-button';
import { MobileMenuProvider } from './mobile-menu-context';
import { NotificationBell } from './notification-bell';
import { getUserPermissions } from '@erp/services/iam';
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

  if ((session.user as any)?.requirePasswordChange) {
    redirect('/change-password');
  }

  const permissions = await getUserPermissions(session.user.id);

  return (
    <MobileMenuProvider>
      <div className="flex h-dvh min-h-0 overflow-hidden print:h-auto print:block">
        {/* Sidebar navigation — hidden on mobile, visible on lg+ */}
        <div className="print:hidden h-full hidden lg:flex shrink-0">
          <Sidebar permissions={permissions} />
        </div>

        {/* Mobile sidebar overlay */}
        <Sidebar permissions={permissions} mobile />

        {/* Main content */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden print:overflow-visible print:block">
          {/* Top bar */}
          <header className="print:hidden flex h-14 items-center justify-between border-b border-brand-cream-3 bg-card px-3 sm:px-6 shrink-0">
            <div className="flex items-center gap-2">
              <MobileMenuButton />
              <LogoImage />
            </div>
            <div className="flex items-center gap-1.5 sm:gap-3">
              <NotificationBell />
              <LocaleSwitcher />
              <Link
                href="/account"
                className="flex items-center gap-2 rounded-lg px-2 py-1 transition hover:bg-brand-cream-1"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-red/10 shrink-0">
                  <span className="text-sm font-semibold text-brand-red">
                    {String(session.user?.name || session.user?.email || t('accountFallback'))
                      .charAt(0)
                      .toUpperCase()}
                  </span>
                </div>
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-medium text-brand-ink">
                    {String(session.user?.name || t('accountFallback'))}
                  </p>
                  <p className="text-[11px] text-brand-ink-3 truncate max-w-[120px]">
                    {String(session.user?.email || '')}
                  </p>
                </div>
              </Link>
              <LogoutButton label={t('logout')} loadingLabel={t('loggingOut')} />
            </div>
          </header>

          {/* Page content */}
          <main className="min-h-0 flex-1 overflow-y-auto bg-brand-cream p-3 sm:p-6 print:p-0 print:bg-white print:overflow-visible print:h-auto print:block">
            <ErrorBoundary>{children}</ErrorBoundary>
          </main>
        </div>
      </div>
      <GlobalErrorListener />
    </MobileMenuProvider>
  );
}
