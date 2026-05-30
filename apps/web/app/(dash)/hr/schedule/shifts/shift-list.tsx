'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import type { ShiftDefinitionData } from './actions';
import { ShiftDialog } from './shift-dialog';
import { useRouter } from 'next/navigation';

interface Props {
  shifts: ShiftDefinitionData[];
  locationId: string;
}

export function ShiftList({ shifts, locationId }: Props) {
  const router = useRouter();
  const t = useTranslations('hr.schedule.shifts');
  const tc = useTranslations('common');
  const [editing, setEditing] = useState<ShiftDefinitionData | 'new' | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-brand-ink">{t('title')}</h2>
        <button
          onClick={() => setEditing('new')}
          className="rounded-lg bg-brand-red px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-brand-red-dark"
        >
          {t('add')}
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-brand-cream-3 bg-card">
        <table className="w-full text-sm">
          <thead className="bg-brand-cream-1 text-left text-xs uppercase tracking-widest text-brand-ink-3">
            <tr>
              <th className="px-4 py-3">{t('table.name')}</th>
              <th className="px-4 py-3">{t('table.code')}</th>
              <th className="px-4 py-3">{t('table.startTime')}</th>
              <th className="px-4 py-3">{t('table.endTime')}</th>
              <th className="px-4 py-3">{t('table.breakStart')}</th>
              <th className="px-4 py-3">{t('table.breakEnd')}</th>
              <th className="px-4 py-3 text-right">{tc('labels.actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-cream-3">
            {shifts.map((shift) => (
              <tr key={shift.id}>
                <td className="whitespace-nowrap px-4 py-3 font-medium text-brand-ink">
                  {shift.name}
                  {!shift.isActive && (
                    <span className="ml-2 rounded bg-brand-cream-2 px-1.5 py-0.5 text-[10px] text-brand-ink-3">
                      {tc('status.inactive')}
                    </span>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-brand-ink-2">
                  <span className="rounded bg-brand-cream-1 px-2 py-1 font-mono text-xs">
                    {shift.code}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-brand-ink-2">{shift.startTime}</td>
                <td className="whitespace-nowrap px-4 py-3 text-brand-ink-2">{shift.endTime}</td>
                <td className="whitespace-nowrap px-4 py-3 text-brand-ink-2">
                  {shift.breakStart || '-'}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-brand-ink-2">
                  {shift.breakEnd || '-'}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right">
                  <button
                    onClick={() => setEditing(shift)}
                    className="text-brand-red hover:text-brand-red-dark text-xs font-semibold"
                  >
                    {t('edit')}
                  </button>
                </td>
              </tr>
            ))}
            {shifts.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-brand-ink-3">
                  {t('empty')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <ShiftDialog
          initialData={editing === 'new' ? undefined : editing}
          locationId={locationId}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
