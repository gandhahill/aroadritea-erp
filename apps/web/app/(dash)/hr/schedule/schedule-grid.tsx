'use client';

import { TableBody, TableHeader } from '@erp/ui';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import {
  type RosterAssignment,
  type RosterOptions,
  deleteAssignmentAction,
  swapShiftAssignmentAction,
  upsertAssignmentAction,
} from './actions';

interface Props {
  weekStart: string;
  locationId?: string;
  locations?: Array<{ id: string; name: string }>;
  options: RosterOptions;
  initialAssignments: RosterAssignment[];
  canManage: boolean;
}

type SwapDialogState = {
  assignment: RosterAssignment;
  substituteEmployeeId: string;
  reason: string;
} | null;

function daysOfWeek(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(`${weekStart}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + i);
    return d.toISOString().slice(0, 10);
  });
}

export function ScheduleGrid({
  weekStart,
  locationId,
  locations,
  options,
  initialAssignments,
  canManage,
}: Props) {
  const router = useRouter();
  const t = useTranslations('hr.schedule');
  const tc = useTranslations('common');
  const locale = useLocale();
  const dates = useMemo(() => daysOfWeek(weekStart), [weekStart]);
  const [assignments, setAssignments] = useState(initialAssignments);
  const [busy, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [swapDialog, setSwapDialog] = useState<SwapDialogState>(null);

  const cellMap = useMemo(() => {
    const map = new Map<string, RosterAssignment[]>();
    for (const assignment of assignments) {
      const key = `${assignment.employeeId}|${assignment.workDate}`;
      const current = map.get(key) ?? [];
      current.push(assignment);
      map.set(key, current);
    }
    return map;
  }, [assignments]);

  function getSwapCandidates(assignment: RosterAssignment) {
    return options.employees.filter((employee) => employee.id !== assignment.employeeId);
  }

  function openSwapDialog(assignment: RosterAssignment) {
    setErr(null);
    const candidates = getSwapCandidates(assignment);
    if (candidates.length === 0) {
      setErr(t('swap.noCandidates'));
      return;
    }
    setSwapDialog({
      assignment,
      substituteEmployeeId: candidates[0]?.id ?? '',
      reason: '',
    });
  }

  function confirmSwapAssignment() {
    if (!swapDialog) return;
    setErr(null);
    const substitute = getSwapCandidates(swapDialog.assignment).find(
      (candidate) => candidate.id === swapDialog.substituteEmployeeId,
    );
    if (!substitute) {
      setErr(t('swap.invalidIndex'));
      return;
    }
    const reason = swapDialog.reason.trim();
    if (reason.length < 3) {
      setErr(t('swap.reasonRequired'));
      return;
    }
    startTransition(async () => {
      const response = await swapShiftAssignmentAction({
        assignmentId: swapDialog.assignment.id,
        substituteEmployeeId: substitute.id,
        reason,
      });
      if (!response.ok) {
        setErr(response.error ?? t('errors.swapFailed'));
        return;
      }
      setAssignments((prev) =>
        prev.map((assignment) =>
          assignment.id === swapDialog.assignment.id
            ? { ...assignment, employeeId: substitute.id, employeeName: substitute.name }
            : assignment,
        ),
      );
      setSwapDialog(null);
    });
  }

  async function toggle(
    employeeId: string,
    workDate: string,
    kind: 'shift' | 'off',
    shiftDefinitionId: string | null,
  ) {
    setErr(null);
    const existing = assignments.find(
      (assignment) =>
        assignment.employeeId === employeeId &&
        assignment.workDate === workDate &&
        assignment.shiftDefinitionId === shiftDefinitionId &&
        assignment.kind === kind,
    );
    startTransition(async () => {
      if (existing) {
        const response = await deleteAssignmentAction(existing.id);
        if (!response.ok) {
          setErr(response.error ?? t('errors.deleteFailed'));
          return;
        }
        setAssignments((prev) => prev.filter((assignment) => assignment.id !== existing.id));
        return;
      }
      const response = await upsertAssignmentAction({
        employeeId,
        workDate,
        kind,
        shiftDefinitionId,
      });
      if (!response.ok || !response.id) {
        setErr(response.error ?? t('errors.saveFailed'));
        return;
      }
      const shift = options.shifts.find((item) => item.id === shiftDefinitionId);
      const newAssignment: RosterAssignment = {
        id: response.id,
        employeeId,
        employeeName: options.employees.find((item) => item.id === employeeId)?.name ?? '?',
        workDate,
        kind,
        shiftDefinitionId,
        shiftCode: shift?.code ?? null,
        shiftLabel: shift?.label ?? null,
      };
      setAssignments((prev) => [...prev, newAssignment]);
    });
  }

  const shiftDays = (iso: string, days: number): string => {
    const date = new Date(`${iso}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
  };
  const prevWeek = shiftDays(weekStart, -7);
  const nextWeek = shiftDays(weekStart, 7);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-brand-cream-3 bg-card p-3">
        <div className="flex flex-1 items-center gap-2 md:flex-none">
          <Link
            href={`/hr/schedule?week=${prevWeek}${locationId ? `&locationId=${locationId}` : ''}`}
            className="whitespace-nowrap rounded-md border border-brand-cream-3 px-3 py-1.5 text-xs font-semibold text-brand-ink-2 hover:bg-brand-cream-1"
          >
            &larr; {t('prevWeek')}
          </Link>
          <p className="whitespace-nowrap px-2 text-sm font-semibold text-brand-ink">
            {t('weekOf')} {weekStart} &mdash; {dates[6]}
          </p>
          <Link
            href={`/hr/schedule?week=${nextWeek}${locationId ? `&locationId=${locationId}` : ''}`}
            className="whitespace-nowrap rounded-md border border-brand-cream-3 px-3 py-1.5 text-xs font-semibold text-brand-ink-2 hover:bg-brand-cream-1"
          >
            {t('nextWeek')} &rarr;
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-brand-ink-3">{tc('labels.location')}:</label>
          <select
            value={locationId ?? ''}
            onChange={(event) => {
              const nextLocationId = event.target.value;
              router.push(
                `/hr/schedule?week=${weekStart}${nextLocationId ? `&locationId=${nextLocationId}` : ''}`,
              );
            }}
            className="rounded-md border border-brand-cream-3 bg-transparent px-2 py-1.5 text-sm outline-none focus:border-brand-red"
          >
            <option value="">{tc('labels.allLocations')}</option>
            {locations?.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {err ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">
          {err}
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-brand-cream-3 bg-card">
        <table className="w-full text-sm">
          <TableHeader className="bg-brand-cream-1 text-left text-xs uppercase tracking-widest text-brand-ink-3">
            <tr>
              <th className="sticky left-0 z-10 bg-brand-cream-1 px-3 py-2">{tc('employee')}</th>
              <th className="bg-brand-cream-1 px-3 py-2">{tc('labels.location')}</th>
              {dates.map((date) => (
                <th key={date} className="px-3 py-2 text-center">
                  <div className="capitalize">
                    {new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(
                      new Date(`${date}T12:00:00Z`),
                    )}
                  </div>
                  <div className="text-[10px] font-normal text-brand-ink-3">{date.slice(5)}</div>
                </th>
              ))}
            </tr>
          </TableHeader>
          <TableBody className="divide-y divide-brand-cream-3">
            {options.employees.map((employee) => (
              <tr key={employee.id}>
                <td className="sticky left-0 z-10 whitespace-nowrap bg-card px-3 py-2 font-medium text-brand-ink">
                  {employee.name}
                </td>
                <td className="whitespace-nowrap bg-card px-3 py-2 text-brand-ink-3">
                  {employee.locationName || '-'}
                </td>
                {dates.map((date) => {
                  const cell = cellMap.get(`${employee.id}|${date}`) ?? [];
                  return (
                    <td key={date} className="px-2 py-2 align-top">
                      <div className="flex flex-col gap-1">
                        {options.shifts.map((shift) => {
                          const onAssignment = cell.find(
                            (assignment) =>
                              assignment.shiftDefinitionId === shift.id &&
                              assignment.kind === 'shift',
                          );
                          const on = Boolean(onAssignment);
                          return (
                            <div key={shift.id} className="flex items-center gap-1">
                              <button
                                type="button"
                                disabled={!canManage || busy}
                                onClick={(event) => {
                                  if (on && onAssignment && (event.altKey || event.metaKey)) {
                                    openSwapDialog(onAssignment);
                                    return;
                                  }
                                  void toggle(employee.id, date, 'shift', shift.id);
                                }}
                                title={`${shift.label} ${shift.time}${on ? ` - ${t('swap.short')}` : ''}`}
                                className={`flex-1 rounded-md px-2 py-1 text-[11px] font-semibold transition-colors ${
                                  on
                                    ? 'bg-brand-red text-white shadow-sm'
                                    : 'border border-brand-cream-3 text-brand-ink-3 hover:border-brand-red/40'
                                } disabled:cursor-not-allowed disabled:opacity-50`}
                              >
                                {shift.code}
                              </button>
                              {on && onAssignment ? (
                                <button
                                  type="button"
                                  disabled={!canManage || busy}
                                  onClick={() => openSwapDialog(onAssignment)}
                                  title={t('swap.button')}
                                  aria-label={t('swap.button')}
                                  className="rounded-md border border-brand-cream-3 px-1.5 text-[11px] text-brand-ink-3 hover:border-brand-ink hover:text-brand-ink"
                                >
                                  &harr;
                                </button>
                              ) : null}
                            </div>
                          );
                        })}
                        {(() => {
                          const offRow = cell.find((assignment) => assignment.kind === 'off');
                          return (
                            <button
                              type="button"
                              disabled={!canManage || busy}
                              onClick={() => toggle(employee.id, date, 'off', null)}
                              className={`rounded-md px-2 py-1 text-[11px] font-semibold transition-colors ${
                                offRow
                                  ? 'bg-brand-ink/80 text-white'
                                  : 'border border-brand-cream-3 text-brand-ink-3 hover:border-brand-ink/40'
                              } disabled:cursor-not-allowed disabled:opacity-50`}
                            >
                              OFF
                            </button>
                          );
                        })()}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
            {options.employees.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-6 text-center text-brand-ink-3">
                  {t('emptyEmployees')}
                </td>
              </tr>
            ) : null}
          </TableBody>
        </table>
      </div>

      {swapDialog ? (
        <dialog
          open
          aria-labelledby="swap-dialog-title"
          className="fixed inset-0 z-50 flex h-full w-full max-w-none items-center justify-center border-0 bg-black/40 px-4"
          onClick={(event) => {
            if (event.target === event.currentTarget) setSwapDialog(null);
          }}
        >
          <div className="w-full max-w-md rounded-xl border border-brand-cream-3 bg-card p-5 shadow-xl">
            <h2 id="swap-dialog-title" className="text-base font-semibold text-brand-ink">
              {t('swap.button')}
            </h2>
            <p className="mt-2 text-sm text-brand-ink-2">
              {t('swap.pickPrompt', { date: swapDialog.assignment.workDate })}
            </p>
            <select
              value={swapDialog.substituteEmployeeId}
              onChange={(event) =>
                setSwapDialog((current) =>
                  current ? { ...current, substituteEmployeeId: event.target.value } : current,
                )
              }
              className="mt-3 h-10 w-full rounded-md border border-brand-cream-3 bg-brand-cream-1 px-3 text-sm text-brand-ink outline-none focus:border-brand-red"
            >
              {getSwapCandidates(swapDialog.assignment).map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.name}
                </option>
              ))}
            </select>
            <label className="mt-4 block text-xs font-semibold text-brand-ink-3">
              {t('swap.reasonPrompt')}
            </label>
            <textarea
              value={swapDialog.reason}
              onChange={(event) =>
                setSwapDialog((current) =>
                  current ? { ...current, reason: event.target.value } : current,
                )
              }
              rows={3}
              className="mt-2 w-full rounded-md border border-brand-cream-3 bg-brand-cream-1 px-3 py-2 text-sm text-brand-ink outline-none focus:border-brand-red"
            />
            <p className="mt-2 text-xs text-brand-ink-3">{t('swap.pickInstruction')}</p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSwapDialog(null)}
                className="rounded-md border border-brand-cream-3 px-3 py-2 text-xs font-semibold text-brand-ink-2 hover:bg-brand-cream-1"
              >
                {tc('actions.cancel')}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={confirmSwapAssignment}
                className="rounded-md bg-brand-red px-3 py-2 text-xs font-semibold text-white hover:bg-brand-red-dark disabled:cursor-not-allowed disabled:opacity-60"
              >
                {tc('actions.confirm')}
              </button>
            </div>
          </div>
        </dialog>
      ) : null}
    </div>
  );
}
