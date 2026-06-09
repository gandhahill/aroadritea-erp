/**
 * Jadwal Shift Mingguan (HR > Jadwal) — supervisors atur roster per
 * minggu, menggantikan pengumuman WhatsApp manual.
 */

import { PageHeader } from '@/components/page-header';
import { getSession } from '@/lib/auth';
import { db, eq } from '@erp/db';
import { locations } from '@erp/db/schema/auth';
import { can } from '@erp/services/iam';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { fetchRoster } from './actions';
import { ScheduleGrid } from './schedule-grid';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Shift Schedule' };

/** Anchor: previous (or same) Monday for the given ISO date. UTC-based to
 *  avoid the WIB↔UTC date-shift bug that froze the next-week navigation. */
function mondayOf(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  const day = d.getUTCDay(); // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string; locationId?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');
  const userId = String((session.user as Record<string, unknown>)?.id ?? '');
  const allowed = await can(userId, 'hr.view');
  if (!allowed) redirect('/dashboard');

  const params = await searchParams;
  const today = new Date().toISOString().slice(0, 10);
  const weekStart = mondayOf(params.week ?? today);

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

  const { options, assignments } = await fetchRoster(weekStart, params.locationId);
  const canManage = await can(userId, 'hr.manage_attendance');

  const t = await getTranslations('hr.schedule');

  return (
    <div className="space-y-6">
      <PageHeader
        title={<>{t('title')}</>}
        description={<>{t('subtitle')}</>}
        actions={
          canManage ? (
            <Link
              href="/hr/schedule/shifts"
              className="rounded-lg border border-brand-cream-3 bg-card px-4 py-2 text-sm font-semibold text-brand-ink transition-colors hover:bg-brand-cream-1"
            >
              {t('shifts.manage')}
            </Link>
          ) : undefined
        }
      />

      <ScheduleGrid
        key={`${weekStart}-${params.locationId ?? 'all'}`}
        weekStart={weekStart}
        locationId={params.locationId}
        locations={parsedLocations}
        options={options}
        initialAssignments={assignments}
        canManage={canManage}
      />
    </div>
  );
}
