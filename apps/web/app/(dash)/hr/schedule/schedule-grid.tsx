'use client';

import { useMemo, useState, useTransition } from 'react';
import {
  type RosterAssignment,
  type RosterOptions,
  deleteAssignmentAction,
  upsertAssignmentAction,
} from './actions';
import Link from 'next/link';

interface Props {
  weekStart: string;
  options: RosterOptions;
  initialAssignments: RosterAssignment[];
  canManage: boolean;
}

const DAYS_ID = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

function daysOfWeek(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(`${weekStart}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + i);
    return d.toISOString().slice(0, 10);
  });
}

export function ScheduleGrid({ weekStart, options, initialAssignments, canManage }: Props) {
  const dates = useMemo(() => daysOfWeek(weekStart), [weekStart]);
  const [assignments, setAssignments] = useState(initialAssignments);
  const [busy, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function key(employeeId: string, date: string, shiftId: string | null) {
    return `${employeeId}|${date}|${shiftId ?? 'off'}`;
  }

  const cellMap = useMemo(() => {
    const map = new Map<string, RosterAssignment[]>();
    for (const a of assignments) {
      const k = `${a.employeeId}|${a.workDate}`;
      const arr = map.get(k) ?? [];
      arr.push(a);
      map.set(k, arr);
    }
    return map;
  }, [assignments]);

  async function toggle(
    employeeId: string,
    workDate: string,
    kind: 'shift' | 'off',
    shiftDefinitionId: string | null,
  ) {
    setErr(null);
    const existing = assignments.find(
      (a) =>
        a.employeeId === employeeId &&
        a.workDate === workDate &&
        a.shiftDefinitionId === shiftDefinitionId &&
        a.kind === kind,
    );
    startTransition(async () => {
      if (existing) {
        const res = await deleteAssignmentAction(existing.id);
        if (!res.ok) {
          setErr(res.error ?? 'Gagal menghapus.');
          return;
        }
        setAssignments((prev) => prev.filter((a) => a.id !== existing.id));
        return;
      }
      const res = await upsertAssignmentAction({
        employeeId,
        workDate,
        kind,
        shiftDefinitionId,
      });
      if (!res.ok || !res.id) {
        setErr(res.error ?? 'Gagal menyimpan.');
        return;
      }
      const shift = options.shifts.find((s) => s.id === shiftDefinitionId);
      const newAssignment: RosterAssignment = {
        id: res.id,
        employeeId,
        employeeName: options.employees.find((e) => e.id === employeeId)?.name ?? '?',
        workDate,
        kind,
        shiftDefinitionId,
        shiftCode: shift?.code ?? null,
        shiftLabel: shift?.label ?? null,
      };
      setAssignments((prev) => [...prev, newAssignment]);
    });
  }

  // Compute ±7 days in UTC so the toISOString().slice(0,10) cast doesn't
  // shift the date back across the WIB→UTC boundary (which caused the
  // "next week" button to snap back to the current Monday).
  const shiftDays = (iso: string, days: number): string => {
    const d = new Date(`${iso}T12:00:00Z`); // mid-day UTC avoids edge cases
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  };
  const prevWeek = shiftDays(weekStart, -7);
  const nextWeek = shiftDays(weekStart, 7);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 rounded-xl border border-brand-cream-3 bg-card p-3">
        <Link
          href={`/hr/schedule?week=${prevWeek}`}
          className="rounded-md border border-brand-cream-3 px-3 py-1.5 text-xs font-semibold text-brand-ink-2 hover:bg-brand-cream-1"
        >
          ← Minggu sebelumnya
        </Link>
        <p className="text-sm font-semibold text-brand-ink">
          Minggu {weekStart} — {dates[6]}
        </p>
        <Link
          href={`/hr/schedule?week=${nextWeek}`}
          className="rounded-md border border-brand-cream-3 px-3 py-1.5 text-xs font-semibold text-brand-ink-2 hover:bg-brand-cream-1"
        >
          Minggu berikutnya →
        </Link>
      </div>

      {err ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">
          {err}
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-brand-cream-3 bg-card">
        <table className="w-full text-sm">
          <thead className="bg-brand-cream-1 text-left text-xs uppercase tracking-widest text-brand-ink-3">
            <tr>
              <th className="sticky left-0 z-10 bg-brand-cream-1 px-3 py-2">Karyawan</th>
              {dates.map((date, i) => (
                <th key={date} className="px-3 py-2 text-center">
                  <div>{DAYS_ID[i]}</div>
                  <div className="text-[10px] font-normal text-brand-ink-3">{date.slice(5)}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-cream-3">
            {options.employees.map((emp) => (
              <tr key={emp.id}>
                <td className="sticky left-0 z-10 bg-card px-3 py-2 font-medium text-brand-ink">
                  {emp.name}
                </td>
                {dates.map((date) => {
                  const cell = cellMap.get(`${emp.id}|${date}`) ?? [];
                  return (
                    <td key={date} className="px-2 py-2 align-top">
                      <div className="flex flex-col gap-1">
                        {options.shifts.map((s) => {
                          const on = cell.some(
                            (c) => c.shiftDefinitionId === s.id && c.kind === 'shift',
                          );
                          return (
                            <button
                              key={s.id}
                              type="button"
                              disabled={!canManage || busy}
                              onClick={() => toggle(emp.id, date, 'shift', s.id)}
                              title={`${s.label} ${s.time}`}
                              className={`rounded-md px-2 py-1 text-[11px] font-semibold transition-colors ${
                                on
                                  ? 'bg-brand-red text-white shadow-sm'
                                  : 'border border-brand-cream-3 text-brand-ink-3 hover:border-brand-red/40'
                              } disabled:cursor-not-allowed disabled:opacity-50`}
                            >
                              {s.code}
                            </button>
                          );
                        })}
                        {(() => {
                          const offRow = cell.find((c) => c.kind === 'off');
                          return (
                            <button
                              type="button"
                              disabled={!canManage || busy}
                              onClick={() => toggle(emp.id, date, 'off', null)}
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
                <td colSpan={8} className="px-3 py-6 text-center text-brand-ink-3">
                  Belum ada karyawan aktif.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
