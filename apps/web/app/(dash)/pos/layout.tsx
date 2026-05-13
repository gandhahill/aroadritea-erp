/**
 * POS Layout — SD §21.4, §14, §35.1.1
 *
 * POS shell with shift status bar at the top.
 * Uses a separate client-side POS context for cart state.
 * Wrapped in OfflineSyncProvider for PWA offline support.
 */

import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { OfflineBanner } from './components/offline-banner';
import { OfflineSyncProvider } from './lib/offline-sync-context';
import { PosCartProvider } from './pos-cart-context';
import { ShiftStatusBar } from './shift-status-bar';

export const metadata = { title: 'Point of Sale' };

export default async function PosLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login');

  const user = session.user as Record<string, unknown>;
  const locationId = String(user.locationId ?? '');
  const tenantId = String(user.tenantId ?? 'default');

  if (!locationId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-brand-cream">
        <p className="text-brand-ink-3">No location assigned. Contact administrator.</p>
      </div>
    );
  }

  return (
    <OfflineSyncProvider>
      {/* Yellow banner shows only when offline or pending orders exist */}
      <OfflineBanner />

      <div className="flex min-h-screen flex-col bg-brand-cream">
        {/* Shift status bar — always visible at top */}
        <ShiftStatusBar locationId={locationId} tenantId={tenantId} />

        {/* Order entry area */}
        <PosCartProvider locationId={locationId} tenantId={tenantId}>
          <div className="flex flex-1">{children}</div>
        </PosCartProvider>
      </div>
    </OfflineSyncProvider>
  );
}
