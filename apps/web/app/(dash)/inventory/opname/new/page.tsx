/**
 * New Stock Opname Session Page - SD §25.9
 *
 * Uses live ERP locations instead of static location IDs.
 */

import { getSession } from '@/lib/auth';
import { getActiveLocationOptions, resolveDefaultLocationId } from '@/lib/location-options';
import { db } from '@erp/db';
import { and, eq, inArray } from '@erp/db';
import { accountingPeriods } from '@erp/db/schema/accounting';
import { getLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { NewOpnameForm } from './new-opname-form';

export default async function NewOpnamePage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const user = session.user as Record<string, unknown>;
  const tenantId = (user.tenantId as string) ?? 'default';
  const sessionLocationId = user.locationId as string | undefined;
  const rawLocale = await getLocale().catch(() => 'id');
  const locale: 'id' | 'en' | 'zh' = rawLocale === 'en' || rawLocale === 'zh' ? rawLocale : 'id';
  const locationOptions = await getActiveLocationOptions({ tenantId, locale, type: ['store', 'warehouse', 'office'] });
  const defaultLocationId = resolveDefaultLocationId(locationOptions, undefined, sessionLocationId);

  // Fetch open and closing accounting periods
  const periods = await db
    .select({ code: accountingPeriods.code })
    .from(accountingPeriods)
    .where(
      and(
        eq(accountingPeriods.tenantId, tenantId),
        inArray(accountingPeriods.status, ['open', 'closing']),
      ),
    );

  const periodCodes = periods
    .map((p) => p.code)
    .sort()
    .reverse(); // Show latest first

  return (
    <NewOpnameForm
      locationOptions={locationOptions}
      defaultLocationId={defaultLocationId}
      activePeriodCodes={periodCodes}
    />
  );
}
