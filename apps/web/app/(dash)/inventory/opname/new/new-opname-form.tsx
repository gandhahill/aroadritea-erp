'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useActionState, useState } from 'react';
import { createOpnameSessionAction } from '../actions';
import { Button, Input, Select } from "@erp/ui";

type OpnameKind = 'daily' | 'weekly' | 'monthly';

const EMPTY_FORM = {
  locationId: '',
  sessionDate: '',
  periodCode: '',
  notes: '',
  kind: 'monthly' as OpnameKind,
};

interface Props {
  locationOptions: Array<{ id: string; label: string; code: string }>;
  defaultLocationId: string;
}

export function NewOpnameForm({ locationOptions, defaultLocationId }: Props) {
  const router = useRouter();
  const t = useTranslations('inventory.opname.newSession');
  const actions = useTranslations('common.actions');
  const [form, setForm] = useState({ ...EMPTY_FORM, locationId: defaultLocationId });
  const [state, submitAction, isPending] = useActionState(submitOpname, null);

  async function submitOpname(_prev: unknown, formData: FormData) {
    const params = {
      locationId: formData.get('locationId') as string,
      sessionDate: formData.get('sessionDate') as string,
      periodCode: formData.get('periodCode') as string,
      notes: formData.get('notes') as string,
      kind: (formData.get('kind') as OpnameKind) ?? 'monthly',
    };

    if (!params.locationId) return { error: t('locationRequired') };
    if (!params.sessionDate) return { error: t('sessionDateRequired') };
    if (!params.periodCode) return { error: t('periodCodeRequired') };

    const result = await createOpnameSessionAction(params);
    if (result.error) return { error: result.error };
    if (!result.data) return { error: t('createFailed') };
    router.push(`/inventory/opname/${result.data.id}`);
    return null;
  }

  const kindOptions = [
    { value: 'daily', title: t('dailyTitle'), desc: t('dailyDesc') },
    { value: 'weekly', title: t('weeklyTitle'), desc: t('weeklyDesc') },
    { value: 'monthly', title: t('monthlyTitle'), desc: t('monthlyDesc') },
  ] as const;

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <button
          type="button"
          onClick={() => router.back()}
          className="mb-3 inline-flex items-center gap-1.5 text-sm text-brand-ink-3 transition-colors hover:text-brand-ink"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
          {t('back')}
        </button>
        <h1 className="text-2xl font-bold text-brand-ink">{t('title')}</h1>
        <p className="mt-1 text-sm text-brand-ink-3">{t('subtitle')}</p>
      </div>

      <div className="rounded-xl border border-brand-cream-3 bg-card p-6 shadow-sm">
        <form action={submitAction} className="space-y-5">
          <div className="space-y-1.5">
            <label htmlFor="locationId" className="block text-sm font-medium text-brand-ink">
              {t('location')} <span className="text-rose-500">*</span>
            </label>
            <Select
              id="locationId"
              name="locationId"
              value={form.locationId}
              onChange={(e) => setForm((f) => ({ ...f, locationId: e.target.value }))}
              required
              disabled={locationOptions.length === 0}
             
            >
              {locationOptions.length === 0 ? (
                <option value="">{t('noLocations')}</option>
              ) : (
                locationOptions.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.label}
                  </option>
                ))
              )}
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-brand-ink">
              {t('kind')} <span className="text-rose-500">*</span>
            </label>
            <div className="grid gap-2 sm:grid-cols-3">
              {kindOptions.map((opt) => (
                <label
                  key={opt.value}
                  className={`cursor-pointer rounded-lg border p-3 text-sm transition-colors ${
                    form.kind === opt.value
                      ? 'border-brand-red bg-brand-red/5 text-brand-ink'
                      : 'border-brand-cream-3 bg-card text-brand-ink-2 hover:border-brand-red/30'
                  }`}
                >
                  <input
                    type="radio"
                    name="kind"
                    value={opt.value}
                    checked={form.kind === opt.value}
                    onChange={() => setForm((f) => ({ ...f, kind: opt.value }))}
                    className="sr-only"
                  />
                  <div className="font-semibold">{opt.title}</div>
                  <div className="mt-0.5 text-xs text-brand-ink-3">{opt.desc}</div>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="sessionDate" className="block text-sm font-medium text-brand-ink">
              {t('sessionDate')} <span className="text-rose-500">*</span>
            </label>
            <Input
              id="sessionDate"
              name="sessionDate"
              type="date"
              value={form.sessionDate}
              onChange={(e) => setForm((f) => ({ ...f, sessionDate: e.target.value }))}
              required
             
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="periodCode" className="block text-sm font-medium text-brand-ink">
              {t('periodCode')} <span className="text-rose-500">*</span>
            </label>
            <Input
              id="periodCode"
              name="periodCode"
              type="text"
              placeholder={t('periodPlaceholder')}
              value={form.periodCode}
              onChange={(e) => setForm((f) => ({ ...f, periodCode: e.target.value }))}
              required
             
            />
            <p className="text-xs text-brand-ink-3">{t('periodHint')}</p>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="notes" className="block text-sm font-medium text-brand-ink">
              {t('notesLabel')}
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={3}
              placeholder={t('notesPlaceholder')}
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
             
            />
          </div>

          {state?.error ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              <strong>{t('errorPrefix')}:</strong> {state.error}
            </div>
          ) : null}

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              type="button"
              onClick={() => router.back()}
              className="rounded-lg border border-brand-cream-3 bg-card px-4 py-2 text-sm font-medium text-brand-ink transition-colors hover:bg-brand-cream-1" variant="secondary" size="md"
            >
              {actions('cancel')}
            </Button>
            <button
              type="submit"
              disabled={isPending || locationOptions.length === 0}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-ember-5 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-ember-6 disabled:opacity-50"
            >
              {isPending ? t('creating') : t('createBtn')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
