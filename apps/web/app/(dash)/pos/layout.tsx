/**
 * POS Layout - SD §21.4, §14, §35.1.1
 *
 * POS shell with shift status bar at the top.
 * Uses a separate client-side POS context for cart state.
 * Wrapped in OfflineSyncProvider for PWA offline support.
 */

import { getSession } from '@/lib/auth';
import { getActiveLocationOptions, resolveDefaultLocationId } from '@/lib/location-options';
import { getLocale, getTranslations } from 'next-intl/server';
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
  const tenantId = String(user.tenantId ?? 'default');
  const locale = (await getLocale()) as 'id' | 'en' | 'zh';
  const t = await getTranslations('pos');
  const locationOptions = await getActiveLocationOptions({ tenantId, locale, type: 'store' });
  const locationId = resolveDefaultLocationId(
    locationOptions,
    undefined,
    String(user.locationId ?? ''),
  );

  if (!locationId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-brand-cream">
        <p className="max-w-md text-center text-brand-ink-3">{t('noActiveStore')}</p>
      </div>
    );
  }

  return (
    <OfflineSyncProvider>
      {/* Yellow banner shows only when offline or pending orders exist */}
      <OfflineBanner />

      <PosCartProvider locationId={locationId} tenantId={tenantId}>
        <div className="flex h-full flex-col bg-brand-cream">
          <ShiftStatusBar locationId={locationId} tenantId={tenantId} />

          <div className="flex flex-1 overflow-hidden">{children}</div>
        </div>
      </PosCartProvider>
    </OfflineSyncProvider>
  );
}
