'use client';

import { ConfirmDialog, InlineAlert } from '@/components/confirm-dialog';
import { FilterBar, FilterField } from '@/components/filter-bar';
import { Button, Input, Select, TableCell, TableHead } from '@erp/ui';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { dispensasiAbsenAction, revokeDispensationAction, revokeFaceDataAction } from './actions';

interface SummaryRow {
  employeeId: string;
  employeeName: string;
  scheduledDays: number;
  presentDays: number;
  absentDays: number;
  dispensedDays: number;
  lateCount: number;
  totalLateMinutes: number;
}

interface DispensationDetail {
  workDate: string;
  reason: string;
  givenBy?: string | null;
}

interface Props {
  items: SummaryRow[];
  locations: Array<{ id: string; name: string }>;
  initialPeriod: string;
  initialLocationId: string;
  /** Map of employeeId → sorted list of absent dates (YYYY-MM-DD) that haven't been dispensed yet */
  absentDates: Record<string, string[]>;
  /** Map of employeeId → dispensation details (date + reason) already saved */
  dispensationDetails: Record<string, DispensationDetail[]>;
  /** List of employeeIds that have active face templates */
  employeesWithFace: string[];
}

export function AttendanceSummaryClient({
  items,
  locations,
  initialPeriod,
  initialLocationId,
  absentDates,
  dispensationDetails,
  employeesWithFace,
}: Props) {
  const t = useTranslations('hr.attendance');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Dispensation modal state
  const [dispEmployee, setDispEmployee] = useState<{ id: string; name: string } | null>(null);
  const [dispDates, setDispDates] = useState<string[]>([]);
  const [dispReason, setDispReason] = useState('');

  // Revoke face confirmation dialog state
  const [revokeTarget, setRevokeTarget] = useState<{ id: string; name: string } | null>(null);

  // Revoke dispensation modal state
  const [revokeDispTarget, setRevokeDispTarget] = useState<{
    id: string;
    name: string;
    dates: string[];
    reason: string;
  } | null>(null);
  const [selectedRevokeDates, setSelectedRevokeDates] = useState<string[]>([]);

  // Track locally revoked employees so the button hides immediately after revoke
  const [locallyRevoked, setLocallyRevoked] = useState<Set<string>>(new Set());

  const applyFilter = (opts: { period?: string; locationId?: string }) => {
    const params = new URLSearchParams();
    params.set('tab', 'ringkasan');
    if (opts.period) params.set('period', opts.period);
    if (opts.locationId) params.set('locationId', opts.locationId);
    router.push(`/hr/attendance?${params.toString()}`);
  };

  const handleRevokeFace = (employeeId: string, name: string) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    startTransition(async () => {
      const res = await revokeFaceDataAction(employeeId);
      if (res.ok) {
        setSuccessMsg(t('revokeFaceSuccess', { name }));
        setLocallyRevoked((prev) => new Set(prev).add(employeeId));
      } else {
        setErrorMsg(res.error || t('revokeFaceFailed'));
      }
    });
  };

  const handleRevokeDispensation = (employeeId: string, dates: string[]) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    startTransition(async () => {
      const res = await revokeDispensationAction(employeeId, dates);
      if (res.ok) {
        setSuccessMsg(t('revokeDispSuccess'));
      } else {
        setErrorMsg(res.error || t('revokeDispFailed'));
      }
    });
  };

  const totals = items.reduce(
    (acc, row) => ({
      scheduled: acc.scheduled + row.scheduledDays,
      present: acc.present + row.presentDays,
      absent: acc.absent + row.absentDays,
      dispensed: acc.dispensed + row.dispensedDays,
      late: acc.late + row.lateCount,
      lateMinutes: acc.lateMinutes + row.totalLateMinutes,
    }),
    { scheduled: 0, present: 0, absent: 0, dispensed: 0, late: 0, lateMinutes: 0 },
  );

  const openDispensation = (emp: { id: string; name: string }) => {
    setDispEmployee(emp);
    setDispDates([]);
    setDispReason('');
  };

  const toggleDate = (date: string) => {
    setDispDates((prev) =>
      prev.includes(date) ? prev.filter((d) => d !== date) : [...prev, date].sort(),
    );
  };

  const toggleAllDates = (dates: string[]) => {
    const allSelected = dates.every((d) => dispDates.includes(d));
    setDispDates(allSelected ? [] : [...dates].sort());
  };

  const submitDispensation = () => {
    if (!dispEmployee || dispDates.length === 0 || dispReason.trim().length < 3) return;
    setErrorMsg(null);
    startTransition(async () => {
      const res = await dispensasiAbsenAction(dispEmployee.id, dispDates, dispReason.trim());
      if (!res.ok) {
        setErrorMsg(res.error ?? 'Error');
        return;
      }
      setSuccessMsg(t('dispensationSuccess'));
      setDispEmployee(null);
      router.refresh();
    });
  };

  const openRevokeDispensation = (target: {
    id: string;
    name: string;
    dates: string[];
    reason: string;
  }) => {
    setRevokeDispTarget(target);
    setSelectedRevokeDates(target.dates); // default select all
  };

  const toggleRevokeDate = (date: string) => {
    setSelectedRevokeDates((prev) =>
      prev.includes(date) ? prev.filter((d) => d !== date) : [...prev, date].sort(),
    );
  };

  const toggleAllRevokeDates = (dates: string[]) => {
    const allSelected = dates.every((d) => selectedRevokeDates.includes(d));
    setSelectedRevokeDates(allSelected ? [] : [...dates].sort());
  };

  return (
    <div className="space-y-4">
      {errorMsg && (
        <InlineAlert message={errorMsg} tone="error" onDismiss={() => setErrorMsg(null)} />
      )}
      {successMsg && (
        <InlineAlert message={successMsg} tone="success" onDismiss={() => setSuccessMsg(null)} />
      )}

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
            onChange={(e) => applyFilter({ period: e.target.value, locationId: initialLocationId })}
            className="w-full sm:w-44"
          />
        </FilterField>
        <FilterField label={t('summaryLocation')}>
          <Select
            value={initialLocationId}
            onChange={(e) => applyFilter({ period: initialPeriod, locationId: e.target.value })}
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
          <h3 className="mt-3 text-base font-semibold text-brand-ink">{t('summaryEmpty')}</h3>
          <p className="mt-1 text-sm text-brand-ink-3">{t('summaryEmptyDesc')}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-brand-cream-3 bg-card shadow-sm">
          <table className="w-full min-w-full text-sm">
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
                  {t('summaryDispensed')}
                </TableHead>
                <TableHead className="px-4 py-3 text-right font-medium text-brand-ink-2">
                  {t('summaryLateCount')}
                </TableHead>
                <TableHead className="px-4 py-3 text-right font-medium text-brand-ink-2">
                  {t('summaryLateMinutes')}
                </TableHead>
                <TableHead className="px-4 py-3 font-medium text-brand-ink-2">
                  {t('summaryActions')}
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
                  <TableCell className="px-4 py-3">
                    {row.dispensedDays > 0 ? (
                      <div>
                        <span className="font-medium text-brand-jade">{row.dispensedDays}</span>
                        {(dispensationDetails[row.employeeId] ?? []).length > 0 && (
                          <div className="mt-0.5 space-y-0.5">
                            {(() => {
                              const details = dispensationDetails[row.employeeId] ?? [];
                              const groups = details.reduce(
                                (acc, d) => {
                                  const key = `${d.reason}|${d.givenBy ?? ''}`;
                                  if (!acc[key])
                                    acc[key] = { reason: d.reason, givenBy: d.givenBy, dates: [] };
                                  acc[key].dates.push(d.workDate);
                                  return acc;
                                },
                                {} as Record<
                                  string,
                                  { reason: string; givenBy?: string | null; dates: string[] }
                                >,
                              );

                              return Object.values(groups).map((g) => (
                                <div
                                  key={`${g.reason}-${g.givenBy}`}
                                  className="flex items-center gap-1 group"
                                >
                                  <p className="text-[11px] text-brand-ink-3">
                                    {g.dates.join(', ')} — {g.reason}{' '}
                                    {g.givenBy ? t('dispensationGivenBy', { name: g.givenBy }) : ''}
                                  </p>
                                  <button
                                    type="button"
                                    title={t('revokeDispBtn')}
                                    onClick={() =>
                                      openRevokeDispensation({
                                        id: row.employeeId,
                                        name: row.employeeName,
                                        dates: g.dates,
                                        reason: g.reason,
                                      })
                                    }
                                    disabled={isPending}
                                    className="text-rose-400 hover:text-rose-600 p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                  >
                                    <svg
                                      className="w-3.5 h-3.5"
                                      fill="none"
                                      viewBox="0 0 24 24"
                                      stroke="currentColor"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M6 18L18 6M6 6l12 12"
                                      />
                                    </svg>
                                  </button>
                                </div>
                              ));
                            })()}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-right text-brand-ink-3">0</span>
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
                  <TableCell className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      {(absentDates[row.employeeId] ?? []).length > 0 && (
                        <button
                          type="button"
                          onClick={() =>
                            openDispensation({ id: row.employeeId, name: row.employeeName })
                          }
                          disabled={isPending}
                          className="rounded-md border border-brand-jade/30 px-2.5 py-1 text-xs font-semibold text-brand-jade hover:bg-brand-jade/10"
                        >
                          {t('dispensationBtn')}
                        </button>
                      )}
                      {employeesWithFace.includes(row.employeeId) &&
                        !locallyRevoked.has(row.employeeId) && (
                          <button
                            type="button"
                            onClick={() =>
                              setRevokeTarget({ id: row.employeeId, name: row.employeeName })
                            }
                            disabled={isPending}
                            className="rounded-md border border-rose-200 px-2.5 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                          >
                            {t('revokeFaceBtn')}
                          </button>
                        )}
                    </div>
                  </TableCell>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-brand-cream-3 bg-brand-cream-1 font-semibold">
                <TableCell className="px-4 py-3 text-brand-ink">{t('summaryTotal')}</TableCell>
                <TableCell className="px-4 py-3 text-right text-brand-ink">
                  {totals.scheduled}
                </TableCell>
                <TableCell className="px-4 py-3 text-right text-brand-jade">
                  {totals.present}
                </TableCell>
                <TableCell className="px-4 py-3 text-right text-rose-600">
                  {totals.absent}
                </TableCell>
                <TableCell className="px-4 py-3 text-right text-brand-jade">
                  {totals.dispensed}
                </TableCell>
                <TableCell className="px-4 py-3 text-right text-amber-600">{totals.late}</TableCell>
                <TableCell className="px-4 py-3 text-right text-brand-ink">
                  {totals.lateMinutes > 0 ? `${totals.lateMinutes}m` : '—'}
                </TableCell>
                <TableCell className="px-4 py-3" />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Dispensation modal */}
      {dispEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-xl bg-card p-5 shadow-xl">
            <h3 className="text-base font-semibold text-brand-ink">
              {t('dispensationTitle')} — {dispEmployee.name}
            </h3>
            <p className="mt-1 text-sm text-brand-ink-3">{t('dispensationDesc')}</p>

            <div className="mt-3 space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-brand-ink-3">
                  {t('dispensationDates')}
                </label>
                {(() => {
                  const availableDates = dispEmployee ? (absentDates[dispEmployee.id] ?? []) : [];
                  if (availableDates.length === 0) {
                    return (
                      <p className="rounded-md border border-brand-cream-3 bg-brand-cream-1 px-3 py-2 text-sm text-brand-ink-3">
                        {t('dispensationNoAbsentDates')}
                      </p>
                    );
                  }
                  return (
                    <div className="max-h-48 overflow-y-auto rounded-md border border-brand-cream-3 bg-card">
                      <label className="flex cursor-pointer items-center gap-2 border-b border-brand-cream-3 bg-brand-cream-1 px-3 py-2">
                        <input
                          type="checkbox"
                          checked={availableDates.every((d) => dispDates.includes(d))}
                          onChange={() => toggleAllDates(availableDates)}
                          className="h-4 w-4 rounded border-brand-cream-3 text-brand-red focus:ring-brand-red"
                        />
                        <span className="text-xs font-semibold text-brand-ink">
                          {t('dispensationSelectAll', { count: availableDates.length })}
                        </span>
                      </label>
                      {availableDates.map((date) => {
                        const dayName = new Date(`${date}T00:00:00+07:00`).toLocaleDateString(
                          locale === 'zh' ? 'zh-CN' : locale === 'en' ? 'en-US' : 'id-ID',
                          { weekday: 'short' },
                        );
                        return (
                          <label
                            key={date}
                            className="flex cursor-pointer items-center gap-2 px-3 py-1.5 hover:bg-brand-cream-1/50"
                          >
                            <input
                              type="checkbox"
                              checked={dispDates.includes(date)}
                              onChange={() => toggleDate(date)}
                              className="h-4 w-4 rounded border-brand-cream-3 text-brand-red focus:ring-brand-red"
                            />
                            <span className="text-sm text-brand-ink">
                              {date}
                              <span className="ml-1.5 text-brand-ink-3">({dayName})</span>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-brand-ink-3">
                  {t('dispensationReason')}
                </label>
                <textarea
                  value={dispReason}
                  onChange={(e) => setDispReason(e.target.value)}
                  placeholder={t('dispensationPlaceholder')}
                  className="h-20 w-full rounded-md border border-brand-cream-3 bg-card px-3 py-2 text-sm text-brand-ink focus:border-brand-red focus:outline-none"
                />
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setDispEmployee(null)}>
                {tCommon('actions.cancel')}
              </Button>
              <Button
                onClick={submitDispensation}
                disabled={isPending || dispDates.length === 0 || dispReason.trim().length < 3}
              >
                {isPending ? tCommon('actions.saving') : t('dispensationSubmit')}
              </Button>
            </div>
          </div>
        </div>
      )}
      {/* Revoke Face Dialog */}
      {revokeTarget && (
        <ConfirmDialog
          title={t('revokeFaceTitle')}
          message={t('revokeFaceConfirm', { name: revokeTarget.name })}
          confirmLabel={t('revokeFaceBtn')}
          cancelLabel={tCommon('actions.cancel')}
          onConfirm={() => {
            handleRevokeFace(revokeTarget.id, revokeTarget.name);
            setRevokeTarget(null);
          }}
          onCancel={() => setRevokeTarget(null)}
          tone="danger"
        />
      )}

      {/* Revoke Dispensation Modal */}
      {revokeDispTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-xl bg-card p-5 shadow-xl">
            <h3 className="text-base font-semibold text-brand-ink">
              {t('revokeDispTitle')} — {revokeDispTarget.name}
            </h3>
            <p className="mt-1 text-sm text-brand-ink-3">{t('revokeDispDesc')}</p>

            <div className="mt-3 space-y-3">
              <div className="max-h-48 overflow-y-auto rounded-md border border-brand-cream-3 bg-card">
                <label className="flex cursor-pointer items-center gap-2 border-b border-brand-cream-3 bg-brand-cream-1 px-3 py-2">
                  <input
                    type="checkbox"
                    checked={revokeDispTarget.dates.every((d) => selectedRevokeDates.includes(d))}
                    onChange={() => toggleAllRevokeDates(revokeDispTarget.dates)}
                    className="h-4 w-4 rounded border-brand-cream-3 text-brand-red focus:ring-brand-red"
                  />
                  <span className="text-xs font-semibold text-brand-ink">
                    {t('revokeDispSelectAll', { count: revokeDispTarget.dates.length })}
                  </span>
                </label>
                {revokeDispTarget.dates.map((date) => {
                  const dayName = new Date(`${date}T00:00:00+07:00`).toLocaleDateString(
                    locale === 'zh' ? 'zh-CN' : locale === 'en' ? 'en-US' : 'id-ID',
                    { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' },
                  );
                  return (
                    <label
                      key={date}
                      className="flex cursor-pointer items-center gap-2 px-3 py-1.5 hover:bg-brand-cream-1/50"
                    >
                      <input
                        type="checkbox"
                        checked={selectedRevokeDates.includes(date)}
                        onChange={() => toggleRevokeDate(date)}
                        className="h-4 w-4 rounded border-brand-cream-3 text-brand-red focus:ring-brand-red"
                      />
                      <span className="text-sm font-medium text-brand-ink-2">{dayName}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setRevokeDispTarget(null)}
                disabled={isPending}
              >
                {tCommon('actions.cancel')}
              </Button>
              <Button
                type="button"
                variant="primary"
                className="bg-rose-600 hover:bg-rose-700 text-white"
                onClick={() => {
                  handleRevokeDispensation(revokeDispTarget.id, selectedRevokeDates);
                  setRevokeDispTarget(null);
                }}
                disabled={isPending || selectedRevokeDates.length === 0}
              >
                {t('revokeDispBtn')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
