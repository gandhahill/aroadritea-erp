/**
 * Omzet Harian Page — SD §25.5b, SoT §21.3b
 * PB1-exclusive daily revenue with manual fiscal adjustment + XLSX export.
 */

import { getSession } from '@/lib/auth';
import type { Metadata } from 'next';
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
  const date = params.date ?? today;
  const locationId = params.location ?? '';

  const ctx = {
    userId: ((session.user as Record<string, unknown>)?.id as string) ?? '',
    tenantId: ((session.user as Record<string, unknown>)?.tenantId as string) ?? 'default',
    locationId: locationId,
  };

  const result = locationId ? await serverGetOmzetHarian({ locationId, date }, ctx) : null;

  return (
    <OmzetHarianClient
      initialData={result?.ok ? result.value : null}
      initialDate={date}
      initialLocationId={locationId}
      ctx={ctx}
    />
  );
}
