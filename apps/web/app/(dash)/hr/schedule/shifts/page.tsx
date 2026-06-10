import { PageHeader } from '@/components/page-header';
import { getSession } from '@/lib/auth';
import { db, eq } from '@erp/db';
import { locations } from '@erp/db/schema/auth';
import { can } from '@erp/services/iam';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { fetchShiftDefinitions } from './actions';
import { ShiftList } from './shift-list';
import { ShiftLocationSelector } from './shift-location-selector';

export const metadata: Metadata = { title: 'Shift Master Data' };

export default async function ShiftsPage({
  searchParams,
}: {
  searchParams: Promise<{ locationId?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');
  const userId = String((session.user as Record<string, unknown>)?.id ?? '');

  const allowed = await can(userId, 'hr.manage_attendance');
  if (!allowed) redirect('/hr/schedule');

  const params = await searchParams;
  const tenantId = String((session.user as Record<string, unknown>)?.tenantId ?? 'default');

  const locationRows = await db
    .select({ id: locations.id, name: locations.name })
    .from(locations)
    .where(eq(locations.tenantId, tenantId))
    .orderBy(locations.name);

  const parsedLocations = locationRows.map((row) => {
    const n = row.name as Record<string, string>;
    return { id: row.id, name: n['id'] || n['en'] || '' };
  });

  const currentLocationId = params.locationId || parsedLocations[0]?.id || '';

  const shifts = currentLocationId ? await fetchShiftDefinitions(currentLocationId) : [];
  const t = await getTranslations('hr.schedule.shifts');
  const tc = await getTranslations('common');

  return (
    <div className="space-y-6">
      <PageHeader title={<>{t('title')}</>} description={<>{t('subtitle')}</>} />

      {parsedLocations.length > 0 ? (
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-brand-ink-3">{tc('labels.location')}:</label>
            <ShiftLocationSelector
              locations={parsedLocations}
              currentLocationId={currentLocationId}
            />
          </div>

          <ShiftList shifts={shifts} locationId={currentLocationId} />
        </div>
      ) : (
        <div className="rounded-lg border border-brand-cream-3 bg-card p-6 text-center text-sm text-brand-ink-3">
          No locations found.
        </div>
      )}
    </div>
  );
}
