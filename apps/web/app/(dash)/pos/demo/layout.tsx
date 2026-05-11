/**
 * Demo POS Layout — SD §34, ADR-0008
 *
 * Wraps demo POS with:
 * - DemoModeProvider (shared demo state)
 * - DemoCartProvider (cart state)
 * - Activation screen if not yet in demo mode
 * - Error screen if master data snapshot failed
 */

import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { DemoModeProvider } from './demo-mode-context';
import { DemoCartProvider } from './demo-cart-context';

export const metadata = { title: '[DEMO] Point of Sale' };

export default async function DemoPosLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login');

  return (
    <DemoModeProvider>
      <DemoCartProvider>
        {/* Demo banner + main layout injected via children */}
        <div className="flex min-h-screen flex-col bg-brand-cream">
          {children}
        </div>
      </DemoCartProvider>
    </DemoModeProvider>
  );
}