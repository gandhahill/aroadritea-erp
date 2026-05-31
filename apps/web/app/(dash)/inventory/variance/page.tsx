/**
 * Inventory Variance Report Page — SD §25.9.4
 *
 * Server component that fetches locations for the filter dropdown.
 */

import { getSession } from '@/lib/auth';
import { db, locations } from '@erp/db';
import { and, asc, eq, isNull } from '@erp/db';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { VarianceClient } from './variance-client';

export const metadata: Metadata = { title: 'Inventory Variance' };

export default async function VariancePage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const tenantId = ((session.user as Record<string, unknown>)?.tenantId as string) ?? 'default';

  // Fetch locations for filter dropdown — only active, non-deleted
  const locationRows = await db
    .select({
      id: locations.id,
      name: locations.name,
    })
    .from(locations)
    .where(
      and(
        eq(locations.tenantId, tenantId),
        eq(locations.status, 'active'),
        isNull(locations.deletedAt),
      ),
    )
    .orderBy(asc(locations.name));

  const parsedLocations = locationRows.map((loc) => ({
    id: loc.id,
    // name is jsonb { id, en, zh }
    name: String((loc.name as { id: string } | null)?.id ?? loc.id),
  }));

  // Default: today's month
  const now = new Date();
  const defaultStartDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const defaultEndDate = now.toISOString().split('T')[0]!;

  // Current user's location as default filter
  const userLocationId = ((session.user as Record<string, unknown>)?.locationId as string) ?? '';

  return (
    <VarianceClient
      locations={parsedLocations}
      defaultLocationId={userLocationId}
      defaultStartDate={defaultStartDate}
      defaultEndDate={defaultEndDate}
    />
  );
}
