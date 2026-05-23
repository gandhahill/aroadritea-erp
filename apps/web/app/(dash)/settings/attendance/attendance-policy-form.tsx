'use client';

import { useTranslations } from 'next-intl';
import { useActionState, useState } from 'react';
import { saveAttendancePolicy } from './actions';
import { Button, Input } from "@erp/ui";

interface Props {
  initial: { latePenalty: number; freeLatesPerMonth: number; absentPenalty: number };
}

export function AttendancePolicyForm({ initial }: Props) {
  const t = useTranslations('settings.attendance');
  const [state, action, pending] = useActionState(saveAttendancePolicy, { ok: false });
  const [latePenalty, setLatePenalty] = useState(initial.latePenalty);
  const [freeLatesPerMonth, setFreeLatesPerMonth] = useState(initial.freeLatesPerMonth);
  const [absentPenalty, setAbsentPenalty] = useState(initial.absentPenalty);

  return (
    <form action={action} className="space-y-6">
      {state.message ? (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            state.ok
              ? 'border-brand-jade/30 bg-brand-jade/10 text-brand-jade'
              : 'border-rose-200 bg-rose-50 text-rose-700'
          }`}
        >
          {t(state.message.replace('settings.attendance.', '') as never)}
        </div>
      ) : null}

      <section className="rounded-xl border border-brand-cream-3 bg-card p-5 shadow-sm">
        <h2 className="text-base font-semibold text-brand-ink">{t('penaltyTitle')}</h2>
        <p className="mt-1 text-sm text-brand-ink-3">{t('penaltyHint')}</p>

        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <label className="space-y-1.5">
            <span className="text-sm font-medium text-brand-ink">{t('latePenalty')}</span>
            <div className="flex items-center gap-2">
              <span className="text-sm text-brand-ink-3">Rp</span>
              <Input
                name="latePenalty"
                type="number"
                min={0}
                step={1000}
                value={latePenalty}
                onChange={(event) => setLatePenalty(Number(event.target.value))}
               
                required
              />
            </div>
          </label>
          <label className="space-y-1.5">
            <span className="text-sm font-medium text-brand-ink">{t('freeLatesPerMonth')}</span>
            <Input
              name="freeLatesPerMonth"
              type="number"
              min={0}
              max={31}
              value={freeLatesPerMonth}
              onChange={(event) => setFreeLatesPerMonth(Number(event.target.value))}
             
              required
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-sm font-medium text-brand-ink">{t('absentPenalty')}</span>
            <div className="flex items-center gap-2">
              <span className="text-sm text-brand-ink-3">Rp</span>
              <Input
                name="absentPenalty"
                type="number"
                min={0}
                step={1000}
                value={absentPenalty}
                onChange={(event) => setAbsentPenalty(Number(event.target.value))}
               
                required
              />
            </div>
          </label>
        </div>
      </section>

      <div className="flex items-center justify-end gap-3">
        <Button
          type="submit"
          disabled={pending}
          className="rounded-lg " variant="primary" size="lg"
        >
          {pending ? t('saving') : t('save')}
        </Button>
      </div>
    </form>
  );
}
