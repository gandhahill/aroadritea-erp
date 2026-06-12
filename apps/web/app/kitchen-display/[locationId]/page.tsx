/**
 * Kitchen customer display — SD §21.7
 *
 * Public kiosk screen (no auth, see middleware.ts) showing the live
 * queued/making/ready order queue for one location via SSE.
 */

import { db, eq } from '@erp/db';
import { locations } from '@erp/db/schema/auth';
import { notFound } from 'next/navigation';
import { KitchenDisplayClient } from './display-client';

type LocaleString = { id?: string; en?: string; zh?: string };

export const metadata = {
  title: 'Kitchen Display',
};

export default async function KitchenDisplayPage({
  params,
}: {
  params: Promise<{ locationId: string }>;
}) {
  const { locationId } = await params;

  const [location] = await db
    .select({ code: locations.code, name: locations.name })
    .from(locations)
    .where(eq(locations.id, locationId))
    .limit(1);

  if (!location) notFound();

  const name = (location.name as LocaleString)?.id ?? location.code;

  return (
    <KitchenDisplayClient
      locationId={locationId}
      locationLabel={`${location.code} · ${name}`}
    />
  );
}
