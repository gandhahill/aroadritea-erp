'use client';

import { FilterBar, FilterField } from '@/components/filter-bar';
import { Input, Select, TableCell, TableHead } from '@erp/ui';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';

interface SummaryRow {
  employeeId: string;
  employeeName: string;
  scheduledDays: number;
  presentDays: number;
  absentDays: number;
  lateCount: number;
  totalLateMinutes: number;
}

interface Props {
  items: SummaryRow[];
  locations: Array<{ id: string; name: string }>;
  initialPeriod: string;
  initialLocationId: string;
}

export function AttendanceSummaryClient({
  items,
  locations,
  initialPeriod,
  initialLocationId,
}: Props) {
  const t = useTranslations('hr.attendance');
  const router = useRouter();

  const applyFilter = (opts: { period?: string; locationId?: string }) => {
    const params = new URLSearchParams();
    params.set('tab', 'ringkasan');
    if (opts.period) params.set('period', opts.period);
    if (opts.locationId) params.set('locationId', opts.locationId);
    router.push(`/hr/attendance?${params.toString()}`);
  };

  const totals = items.reduce(
    (acc, row) => ({
      scheduled: acc.scheduled + row.scheduledDays,
      present: acc.present + row.presentDays,
      absent: acc.absent + row.absentDays,
      late: acc.late + row.lateCount,
      lateMinutes: acc.lateMinutes + row.totalLateMinutes,
    }),
    { scheduled: 0, present: 0, absent: 0, late: 0, lateMinutes: 0 },
  );

  return (
    <div className="space-y-4">
      {/* Tab switcher */}
      <div className="flex gap-1 rounded-lg bg-brand-cream-2 p-1 w-fit">
        <button
          type="button"
          onClick={() => router.push('/hr/attendance')}
          className="rounded-md px-4 py-1.5 text-sm font-medium text-brand-ink-3 hover:text-brand-ink"
        >
          {t('tabList')}
        </button>
        <span className="rounded-md bg-card px-4 py-1.5 text-sm font-semibold text-brand-ink shadow-sm">
          {t('tabSummary')}
        </span>
      </div>

      {/* Filters */}
      <FilterBar>
        <FilterField label={t('summaryPeriod')}>
          <Input
            type="month"
            value={initialPeriod}
            onChange={(e) =>
              applyFilter({ period: e.target.value, locationId: initialLocationId })
            }
            className="w-full sm:w-44"
          />
        </FilterField>
        <FilterField label={t('summaryLocation')}>
          <Select
            value={initialLocationId}
            onChange={(e) =>
              applyFilter({ period: initialPeriod, locationId: e.target.value })
            }
            className="w-full sm:w-56"
          >
            <option value="">{t('summaryAllLocations')}</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name}
              </option>
            ))}
          </Select>
        </FilterField>
      </FilterBar>

      {/* Summary table */}
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-brand-cream-3 bg-card py-16 text-center">
          <svg
            className="h-12 w-12 text-brand-cream-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z"
            />
          </svg>
          <h3 className="mt-3 text-base font-semibold text-brand-ink">{t('summaryEmpty')}</h3>
          <p className="mt-1 text-sm text-brand-ink-3">{t('summaryEmptyDesc')}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-brand-cream-3 bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-brand-cream-3 bg-brand-cream-1">
                <TableHead className="px-4 py-3 text-left font-medium text-brand-ink-2">
                  {t('columns.employee')}
                </TableHead>
                <TableHead className="px-4 py-3 text-right font-medium text-brand-ink-2">
                  {t('summaryScheduled')}
                </TableHead>
                <TableHead className="px-4 py-3 text-right font-medium text-brand-ink-2">
                  {t('summaryPresent')}
                </TableHead>
                <TableHead className="px-4 py-3 text-right font-medium text-brand-ink-2">
                  {t('summaryAbsent')}
                </TableHead>
                <TableHead className="px-4 py-3 text-right font-medium text-brand-ink-2">
                  {t('summaryLateCount')}
                </TableHead>
                <TableHead className="px-4 py-3 text-right font-medium text-brand-ink-2">
                  {t('summaryLateMinutes')}
                </TableHead>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-cream-2">
              {items.map((row) => (
                <tr key={row.employeeId} className="hover:bg-brand-cream-1/50">
                  <TableCell className="px-4 py-3 font-medium text-brand-ink">
                    {row.employeeName}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-right text-brand-ink-2">
                    {row.scheduledDays}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-right text-brand-jade font-medium">
                    {row.presentDays}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-right">
                    {row.absentDays > 0 ? (
                      <span className="font-semibold text-rose-600">{row.absentDays}</span>
                    ) : (
                      <span className="text-brand-ink-3">0</span>
                    )}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-right">
                    {row.lateCount > 0 ? (
                      <span className="text-amber-600">{row.lateCount}</span>
                    ) : (
                      <span className="text-brand-ink-3">0</span>
                    )}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-right text-brand-ink-2">
                    {row.totalLateMinutes > 0 ? `${row.totalLateMinutes}m` : '—'}
                  </TableCell>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-brand-cream-3 bg-brand-cream-1 font-semibold">
                <TableCell className="px-4 py-3 text-brand-ink">
                  {t('summaryTotal')}
                </TableCell>
                <TableCell className="px-4 py-3 text-right text-brand-ink">
                  {totals.scheduled}
                </TableCell>
                <TableCell className="px-4 py-3 text-right text-brand-jade">
                  {totals.present}
                </TableCell>
                <TableCell className="px-4 py-3 text-right text-rose-600">
                  {totals.absent}
                </TableCell>
                <TableCell className="px-4 py-3 text-right text-amber-600">
                  {totals.late}
                </TableCell>
                <TableCell className="px-4 py-3 text-right text-brand-ink">
                  {totals.lateMinutes > 0 ? `${totals.lateMinutes}m` : '—'}
                </TableCell>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
