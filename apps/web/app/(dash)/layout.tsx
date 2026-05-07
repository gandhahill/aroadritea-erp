/**
 * Dashboard layout — session-protected shell.
 * All routes under /(dash)/* require authentication.
 * Middleware handles the redirect, this layout provides the session context.
 */

import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  if ((session.user as Record<string, unknown>)?.status === 'suspended') {
    redirect('/login?error=suspended');
  }

  return (
    <div className="flex min-h-screen flex-col">
      {/* Top bar — minimal for now, will be expanded with sidebar in future tasks */}
      <header className="flex h-14 items-center justify-between border-b border-brand-cream-3 bg-white px-4">
        <div className="flex items-center gap-3">
          <img src="/logo-primary.png" alt="Aroadri Tea" width={32} height={32} className="h-8 w-8" />
          <span className="font-display text-lg font-semibold text-brand-ink">ERP</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-brand-ink-2">
            {session.user?.name ?? session.user?.email}
          </span>
        </div>
      </header>

      {/* Main content area */}
      <main className="flex-1 bg-brand-cream p-6">
        {children}
      </main>
    </div>
  );
}
