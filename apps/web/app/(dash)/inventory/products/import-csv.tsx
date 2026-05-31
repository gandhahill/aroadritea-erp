'use client';

import { Button, Input, Select } from '@erp/ui';
import { useTranslations } from 'next-intl';
import { useActionState, useState } from 'react';
import { type ImportCsvState, importCsvAction } from './actions';

interface Props {
  locations: Array<{ id: string; code: string; label: string }>;
  defaultLocationId: string;
}

export function ImportCsvPanel({ locations, defaultLocationId }: Props) {
  const t = useTranslations('inventory.products');
  const tc = useTranslations('common');
  const [open, setOpen] = useState(false);
  const [state, submitAction, isPending] = useActionState(importCsvAction, null);

  if (!open) {
    return (
      <div className="flex gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => setOpen(true)}
        >
          {t('importCsv', { defaultValue: 'Import CSV' })}
        </Button>
        <a
          href="/api/inventory/csv-template"
          download
          className="inline-flex items-center rounded-lg border border-brand-cream-3 bg-card px-3 py-1.5 text-xs font-semibold text-brand-ink transition-colors hover:bg-brand-cream-1"
        >
          {t('downloadTemplate', { defaultValue: 'Download Template' })}
        </a>
      </div>
    );
  }

  return (
    <section className="rounded-xl border border-brand-cream-3 bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-brand-ink">
            {t('importCsvTitle', { defaultValue: 'Import Produk dari CSV' })}
          </h2>
          <p className="text-sm text-brand-ink-3">
            {t('importCsvDesc', { defaultValue: 'Upload file CSV sesuai template. Produk yang sudah ada (berdasarkan KODE) akan diupdate.' })}
          </p>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          {tc('actions.cancel')}
        </Button>
      </div>

      <form action={submitAction} className="grid gap-4 md:grid-cols-3">
        <label className="space-y-1.5">
          <span className="text-sm font-medium text-brand-ink">{tc('labels.location')}</span>
          <Select name="locationId" defaultValue={defaultLocationId} required>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.code} - {loc.label}
              </option>
            ))}
          </Select>
        </label>
        <label className="space-y-1.5">
          <span className="text-sm font-medium text-brand-ink">
            {t('csvFile', { defaultValue: 'File CSV' })}
          </span>
          <Input
            type="file"
            name="file"
            accept=".csv,text/csv"
            required
            className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-brand-red file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white hover:file:bg-brand-red-dark"
          />
        </label>
        <div className="flex items-end gap-2">
          <Button
            type="submit"
            disabled={isPending || locations.length === 0}
            variant="primary"
            size="md"
            className="w-full"
          >
            {isPending
              ? t('importing', { defaultValue: 'Mengimpor...' })
              : t('importBtn', { defaultValue: 'Import' })}
          </Button>
        </div>
      </form>

      <div className="mt-3 flex gap-3">
        <a
          href="/api/inventory/csv-template"
          download
          className="text-xs font-medium text-brand-ember-5 hover:text-brand-ember-6"
        >
          ↓ {t('downloadTemplate', { defaultValue: 'Download Template' })}
        </a>
      </div>

      {state?.ok && (
        <div className="mt-4 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {t('importSuccess', {
            created: state.created ?? 0,
            updated: state.updated ?? 0,
            skipped: state.skipped ?? 0,
            defaultValue: `Import berhasil! ${state.created} dibuat, ${state.updated} diupdate, ${state.skipped} dilewati.`,
          })}
        </div>
      )}

      {state?.error && (
        <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {state.error}
        </div>
      )}

      {state?.errors && state.errors.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-sm font-medium text-brand-ink-2">
            {t('importWarnings', {
              count: state.errors.length,
              defaultValue: `${state.errors.length} peringatan`,
            })}
          </summary>
          <ul className="mt-2 max-h-48 overflow-y-auto space-y-1 text-xs text-rose-600">
            {state.errors.map((e, i) => (
              <li key={i}>
                Row {e.row}: [{e.field}] {e.message}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
