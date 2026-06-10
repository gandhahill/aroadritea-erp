'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { ShiftDefinitionData } from './actions';
import { deleteShiftDefinition } from './actions';
import { ShiftDialog } from './shift-dialog';

interface Props {
  shifts: ShiftDefinitionData[];
  locationId: string;
}

export function ShiftList({ shifts, locationId }: Props) {
  const router = useRouter();
  const t = useTranslations('hr.schedule.shifts');
  const tc = useTranslations('common');
  const [editing, setEditing] = useState<ShiftDefinitionData | 'new' | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ShiftDefinitionData | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    const res = await deleteShiftDefinition(deleteTarget.id);
    setDeleting(false);
    if (res.ok) {
      setDeleteTarget(null);
      router.refresh();
    } else {
      if (res.error === 'SHIFT_HAS_ASSIGNMENTS') {
        setDeleteError(t('deleteHasAssignments', { count: (res as any).count ?? 0 }));
      } else {
        setDeleteError(res.error ?? t('deleteFailed'));
      }
    }
  };

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
                  <div className="flex justify-end gap-3">
                    <button
                      onClick={() => setEditing(shift)}
                      className="text-brand-red hover:text-brand-red-dark text-xs font-semibold"
                    >
                      {t('edit')}
                    </button>
                    <button
                      onClick={() => {
                        setDeleteTarget(shift);
                        setDeleteError(null);
                      }}
                      className="text-rose-500 hover:text-rose-700 text-xs font-semibold"
                    >
                      {t('delete')}
                    </button>
                  </div>
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

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="close"
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => !deleting && setDeleteTarget(null)}
          />
          <div className="relative z-10 w-full max-w-sm rounded-2xl bg-card shadow-2xl overflow-hidden">
            <div className="border-b border-brand-cream-3 px-6 py-4 bg-brand-cream">
              <h3 className="text-lg font-semibold text-brand-ink">{t('deleteConfirmTitle')}</h3>
            </div>
            <div className="p-6 space-y-3">
              <p className="text-sm text-brand-ink-2">
                {t('deleteConfirmBody', { name: deleteTarget.name, code: deleteTarget.code })}
              </p>
              {deleteError && (
                <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-600">
                  {deleteError}
                </p>
              )}
            </div>
            <div className="border-t border-brand-cream-3 p-4 bg-brand-cream flex justify-end gap-3">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setDeleteTarget(null)}
                className="rounded-lg border border-brand-cream-3 px-4 py-2 text-sm font-medium text-brand-ink hover:bg-brand-cream-2 disabled:opacity-50"
              >
                {tc('actions.cancel')}
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleDelete}
                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
              >
                {deleting ? tc('actions.deleting') : t('delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
