/**
 * Jadwal Shift Mingguan (HR > Jadwal) — supervisors atur roster per
 * minggu, menggantikan pengumuman WhatsApp manual.
 */

import { getSession } from '@/lib/auth';
import { can } from '@erp/services/iam';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { fetchRoster } from './actions';
import { ScheduleGrid } from './schedule-grid';

export const metadata: Metadata = { title: 'Jadwal Shift' };

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
  searchParams: Promise<{ week?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');
  const userId = String((session.user as Record<string, unknown>)?.id ?? '');
  const allowed = await can(userId, 'hr.view');
  if (!allowed) redirect('/dashboard');

  const params = await searchParams;
  const today = new Date().toISOString().slice(0, 10);
  const weekStart = mondayOf(params.week ?? today);

  const { options, assignments } = await fetchRoster(weekStart);
  const canManage = await can(userId, 'hr.manage_attendance');

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-brand-ink">Jadwal Shift Mingguan</h1>
          <p className="mt-1 text-sm text-brand-ink-3">
            Atur shift dan hari libur per karyawan. Klik sel untuk menambah /
            menghapus penugasan.
          </p>
        </div>
      </div>

      <ScheduleGrid
        weekStart={weekStart}
        options={options}
        initialAssignments={assignments}
        canManage={canManage}
      />
    </div>
  );
}
