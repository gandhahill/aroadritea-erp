'use client';

import { useTranslations, useLocale } from 'next-intl';
import { useState, useTransition } from 'react';
import { upsertShiftDefinition, type ShiftDefinitionData } from './actions';

interface Props {
  initialData?: ShiftDefinitionData;
  locationId: string;
  onClose: () => void;
  onSaved: () => void;
}

export function ShiftDialog({ initialData, locationId, onClose, onSaved }: Props) {
  const t = useTranslations('hr.schedule.shifts');
  const tc = useTranslations('common');
  const [busy, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: initialData?.name ?? '',
    code: initialData?.code ?? '',
    startTime: initialData?.startTime ?? '',
    endTime: initialData?.endTime ?? '',
    breakStart: initialData?.breakStart ?? '',
    breakEnd: initialData?.breakEnd ?? '',
  });

  const [dayOverrides, setDayOverrides] = useState<{ day: number; startTime: string; endTime: string }[]>(
    Object.entries(initialData?.overrides?.dayOfWeek ?? {}).map(([day, val]) => ({
      day: Number(day),
      startTime: val.startTime,
      endTime: val.endTime,
    }))
  );

  const [dateOverrides, setDateOverrides] = useState<{ date: string; startTime: string; endTime: string }[]>(
    Object.entries(initialData?.overrides?.date ?? {}).map(([date, val]) => ({
      date,
      startTime: val.startTime,
      endTime: val.endTime,
    }))
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    const data = {
      id: initialData?.id,
      locationId,
      name: form.name.trim(),
      code: form.code.trim().toUpperCase(),
      startTime: form.startTime,
      endTime: form.endTime,
      breakStart: form.breakStart || null,
      breakEnd: form.breakEnd || null,
      isActive: initialData?.isActive ?? true,
      overrides: {
        dayOfWeek: dayOverrides.reduce((acc, curr) => {
          acc[curr.day] = { startTime: curr.startTime, endTime: curr.endTime };
          return acc;
        }, {} as Record<number, { startTime: string; endTime: string }>),
        date: dateOverrides.reduce((acc, curr) => {
          acc[curr.date] = { startTime: curr.startTime, endTime: curr.endTime };
          return acc;
        }, {} as Record<string, { startTime: string; endTime: string }>),
      },
    };

    if (!data.name || !data.code || !data.startTime || !data.endTime) {
      setErr(tc('errors.validationFailed'));
      return;
    }

    startTransition(async () => {
      const res = await upsertShiftDefinition(data);
      if (!res.ok) {
        setErr(res.error ?? t('errors.saveFailed'));
        return;
      }
      onSaved();
    });
  }

  return (
    <dialog
      open
      className="fixed inset-0 z-50 flex h-full w-full max-w-none items-center justify-center border-0 bg-black/40 px-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-xl border border-brand-cream-3 bg-card p-5 shadow-xl">
        <h2 className="text-base font-semibold text-brand-ink">
          {initialData ? t('dialog.editTitle') : t('dialog.addTitle')}
        </h2>
        
        {err && (
          <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {err}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 md:col-span-1">
              <label className="mb-1 block text-xs font-semibold text-brand-ink-3">
                {t('form.name')}
              </label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-md border border-brand-cream-3 bg-transparent px-3 py-2 text-sm text-brand-ink outline-none focus:border-brand-red"
              />
            </div>
            <div className="col-span-2 md:col-span-1">
              <label className="mb-1 block text-xs font-semibold text-brand-ink-3">
                {t('form.code')}
              </label>
              <input
                type="text"
                required
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                className="w-full rounded-md border border-brand-cream-3 bg-transparent px-3 py-2 text-sm text-brand-ink outline-none focus:border-brand-red uppercase"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-1">
              <label className="mb-1 block text-xs font-semibold text-brand-ink-3">
                {t('form.startTime')}
              </label>
              <input
                type="time"
                required
                value={form.startTime}
                onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                className="w-full rounded-md border border-brand-cream-3 bg-transparent px-3 py-2 text-sm text-brand-ink outline-none focus:border-brand-red"
              />
            </div>
            <div className="col-span-1">
              <label className="mb-1 block text-xs font-semibold text-brand-ink-3">
                {t('form.endTime')}
              </label>
              <input
                type="time"
                required
                value={form.endTime}
                onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                className="w-full rounded-md border border-brand-cream-3 bg-transparent px-3 py-2 text-sm text-brand-ink outline-none focus:border-brand-red"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-1">
              <label className="mb-1 block text-xs font-semibold text-brand-ink-3">
                {t('form.breakStart')}
              </label>
              <input
                type="time"
                value={form.breakStart}
                onChange={(e) => setForm({ ...form, breakStart: e.target.value })}
                className="w-full rounded-md border border-brand-cream-3 bg-transparent px-3 py-2 text-sm text-brand-ink outline-none focus:border-brand-red"
              />
            </div>
            <div className="col-span-1">
              <label className="mb-1 block text-xs font-semibold text-brand-ink-3">
                {t('form.breakEnd')}
              </label>
              <input
                type="time"
                value={form.breakEnd}
                onChange={(e) => setForm({ ...form, breakEnd: e.target.value })}
                className="w-full rounded-md border border-brand-cream-3 bg-transparent px-3 py-2 text-sm text-brand-ink outline-none focus:border-brand-red"
              />
            </div>
          </div>

          <div className="mt-6 border-t border-brand-cream-3 pt-4">
            <h3 className="mb-2 text-xs font-semibold text-brand-ink">Pengecualian Berdasarkan Hari (Day of Week)</h3>
            {dayOverrides.map((ov, i) => (
              <div key={i} className="mb-2 flex items-center gap-2">
                <select
                  value={ov.day}
                  onChange={(e) => {
                    setDayOverrides(dayOverrides.map((o, idx) => idx === i ? { ...o, day: Number(e.target.value) } : o));
                  }}
                  className="rounded-md border border-brand-cream-3 bg-transparent px-2 py-1 text-xs text-brand-ink outline-none focus:border-brand-red"
                >
                  <option value={0}>Minggu</option>
                  <option value={1}>Senin</option>
                  <option value={2}>Selasa</option>
                  <option value={3}>Rabu</option>
                  <option value={4}>Kamis</option>
                  <option value={5}>Jumat</option>
                  <option value={6}>Sabtu</option>
                </select>
                <input
                  type="time"
                  required
                  value={ov.startTime}
                  onChange={(e) => {
                    setDayOverrides(dayOverrides.map((o, idx) => idx === i ? { ...o, startTime: e.target.value } : o));
                  }}
                  className="rounded-md border border-brand-cream-3 bg-transparent px-2 py-1 text-xs text-brand-ink outline-none focus:border-brand-red"
                />
                <span className="text-xs text-brand-ink-3">-</span>
                <input
                  type="time"
                  required
                  value={ov.endTime}
                  onChange={(e) => {
                    setDayOverrides(dayOverrides.map((o, idx) => idx === i ? { ...o, endTime: e.target.value } : o));
                  }}
                  className="rounded-md border border-brand-cream-3 bg-transparent px-2 py-1 text-xs text-brand-ink outline-none focus:border-brand-red"
                />
                <button
                  type="button"
                  onClick={() => setDayOverrides(dayOverrides.filter((_, idx) => idx !== i))}
                  className="text-brand-red hover:text-brand-red-dark"
                >
                  &times;
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setDayOverrides([...dayOverrides, { day: 1, startTime: '09:00', endTime: '17:00' }])}
              className="mt-1 text-xs font-semibold text-brand-red hover:underline"
            >
              + Tambah Override Hari
            </button>
          </div>

          <div className="mt-4 border-t border-brand-cream-3 pt-4">
            <h3 className="mb-2 text-xs font-semibold text-brand-ink">Pengecualian Berdasarkan Tanggal (Specific Date)</h3>
            {dateOverrides.map((ov, i) => (
              <div key={i} className="mb-2 flex items-center gap-2">
                <input
                  type="date"
                  required
                  value={ov.date}
                  onChange={(e) => {
                    setDateOverrides(dateOverrides.map((o, idx) => idx === i ? { ...o, date: e.target.value } : o));
                  }}
                  className="rounded-md border border-brand-cream-3 bg-transparent px-2 py-1 text-xs text-brand-ink outline-none focus:border-brand-red"
                />
                <input
                  type="time"
                  required
                  value={ov.startTime}
                  onChange={(e) => {
                    setDateOverrides(dateOverrides.map((o, idx) => idx === i ? { ...o, startTime: e.target.value } : o));
                  }}
                  className="rounded-md border border-brand-cream-3 bg-transparent px-2 py-1 text-xs text-brand-ink outline-none focus:border-brand-red"
                />
                <span className="text-xs text-brand-ink-3">-</span>
                <input
                  type="time"
                  required
                  value={ov.endTime}
                  onChange={(e) => {
                    setDateOverrides(dateOverrides.map((o, idx) => idx === i ? { ...o, endTime: e.target.value } : o));
                  }}
                  className="rounded-md border border-brand-cream-3 bg-transparent px-2 py-1 text-xs text-brand-ink outline-none focus:border-brand-red"
                />
                <button
                  type="button"
                  onClick={() => setDateOverrides(dateOverrides.filter((_, idx) => idx !== i))}
                  className="text-brand-red hover:text-brand-red-dark"
                >
                  &times;
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setDateOverrides([...dateOverrides, { date: new Date().toISOString().slice(0,10), startTime: '09:00', endTime: '17:00' }])}
              className="mt-1 text-xs font-semibold text-brand-red hover:underline"
            >
              + Tambah Override Tanggal
            </button>
          </div>

          <div className="mt-5 flex justify-end gap-2 pt-2 border-t border-brand-cream-3">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="rounded-md border border-brand-cream-3 px-3 py-2 text-xs font-semibold text-brand-ink-2 hover:bg-brand-cream-1"
            >
              {tc('actions.cancel')}
            </button>
            <button
              type="submit"
              disabled={busy}
              className="rounded-md bg-brand-red px-3 py-2 text-xs font-semibold text-white hover:bg-brand-red-dark disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? tc('actions.saving') : t('save')}
            </button>
          </div>
        </form>
      </div>
    </dialog>
  );
}
