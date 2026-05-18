/**
 * Omzet Harian Page — SD §25.5b, SoT §21.3b
 * PB1-exclusive daily revenue with manual fiscal adjustment + XLSX export.
 */

import { getSession } from '@/lib/auth';
import { getActiveLocationOptions, resolveDefaultLocationId } from '@/lib/location-options';
import type { Metadata } from 'next';
import { getLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { serverGetOmzetHarian } from './actions';
import { OmzetHarianClient } from './omzet-harian-client';

export const metadata: Metadata = {
  title: 'Omzet Harian — Reporting',
};

export default async function OmzetHarianPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; location?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');

  const params = await searchParams;
  const today = new Date().toISOString().slice(0, 10);
  const user = session.user as Record<string, unknown>;
  const tenantId = (user.tenantId as string) ?? 'default';
  const sessionLocationId = user.locationId as string | undefined;
  // Respect the user's UI locale instead of hard-coding 'id', so a director
  // browsing in EN/ZH still sees a localized outlet label in the dropdown.
  const rawLocale = await getLocale().catch(() => 'id');
  const locale: 'id' | 'en' | 'zh' =
    rawLocale === 'en' || rawLocale === 'zh' ? rawLocale : 'id';
  const locationOptions = await getActiveLocationOptions({ tenantId, locale, type: 'store' });
  const date = params.date ?? today;
  const locationId = resolveDefaultLocationId(locationOptions, params.location, sessionLocationId);

  const result = locationId ? await serverGetOmzetHarian({ locationId, date }) : null;

  return (
    <OmzetHarianClient
      initialData={result?.ok ? result.value : null}
      initialDate={date}
      initialLocationId={locationId}
      locationOptions={locationOptions}
    />
  );
}
