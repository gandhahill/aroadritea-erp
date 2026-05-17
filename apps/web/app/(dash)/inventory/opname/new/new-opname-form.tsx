'use client';

import { useRouter } from 'next/navigation';
import { useActionState, useState } from 'react';
import { createOpnameSessionAction } from '../actions';

const EMPTY_FORM = {
  locationId: '',
  sessionDate: '',
  periodCode: '',
  notes: '',
  kind: 'monthly' as 'daily' | 'monthly',
};

interface Props {
  locationOptions: Array<{ id: string; label: string; code: string }>;
  defaultLocationId: string;
}

export function NewOpnameForm({ locationOptions, defaultLocationId }: Props) {
  const router = useRouter();
  const [form, setForm] = useState({ ...EMPTY_FORM, locationId: defaultLocationId });
  const [state, submitAction, isPending] = useActionState(submitOpname, null);

  async function submitOpname(_prev: unknown, formData: FormData) {
    const params = {
      locationId: formData.get('locationId') as string,
      sessionDate: formData.get('sessionDate') as string,
      periodCode: formData.get('periodCode') as string,
      notes: formData.get('notes') as string,
      kind: (formData.get('kind') as 'daily' | 'monthly') ?? 'monthly',
    };

    if (!params.locationId) return { error: 'Lokasi wajib dipilih' };
    if (!params.sessionDate) return { error: 'Tanggal sesi wajib diisi' };
    if (!params.periodCode) return { error: 'Kode periode wajib diisi' };

    const result = await createOpnameSessionAction(params);
    if (result.error) return { error: result.error };
    if (!result.data) return { error: 'Gagal membuat sesi opname' };
    router.push(`/inventory/opname/${result.data.id}`);
    return null;
  }

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
          Kembali
        </button>
        <h1 className="text-2xl font-bold text-brand-ink">Buat Sesi Opname</h1>
        <p className="mt-1 text-sm text-brand-ink-3">
          Buat sesi stock opname baru. Sistem akan mem-snapshot stok saat ini sebagai baseline.
        </p>
      </div>

      <div className="rounded-xl border border-brand-cream-3 bg-card p-6 shadow-sm">
        <form action={submitAction} className="space-y-5">
          <div className="space-y-1.5">
            <label htmlFor="locationId" className="block text-sm font-medium text-brand-ink">
              Lokasi <span className="text-rose-500">*</span>
            </label>
            <select
              id="locationId"
              name="locationId"
              value={form.locationId}
              onChange={(e) => setForm((f) => ({ ...f, locationId: e.target.value }))}
              required
              disabled={locationOptions.length === 0}
              className="w-full rounded-lg border border-brand-cream-3 bg-card px-3 py-2 text-sm text-brand-ink shadow-sm transition-colors focus:border-brand-ember-5 focus:outline-none focus:ring-1 focus:ring-brand-ember-5 disabled:opacity-60"
            >
              {locationOptions.length === 0 ? (
                <option value="">Belum ada lokasi aktif</option>
              ) : (
                locationOptions.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.label}
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-brand-ink">
              Jenis Opname <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  {
                    value: 'daily',
                    title: 'Harian (closing)',
                    desc: 'Item wujud — cup, sedotan, susu, dll.',
                  },
                  {
                    value: 'monthly',
                    title: 'Bulanan (menyeluruh)',
                    desc: 'Semua produk & bahan baku.',
                  },
                ] as const
              ).map((opt) => (
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
              Tanggal Sesi <span className="text-rose-500">*</span>
            </label>
            <input
              id="sessionDate"
              name="sessionDate"
              type="date"
              value={form.sessionDate}
              onChange={(e) => setForm((f) => ({ ...f, sessionDate: e.target.value }))}
              required
              className="w-full rounded-lg border border-brand-cream-3 bg-card px-3 py-2 text-sm text-brand-ink shadow-sm transition-colors focus:border-brand-ember-5 focus:outline-none focus:ring-1 focus:ring-brand-ember-5"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="periodCode" className="block text-sm font-medium text-brand-ink">
              Kode Periode <span className="text-rose-500">*</span>
            </label>
            <input
              id="periodCode"
              name="periodCode"
              type="text"
              placeholder="contoh: 2026-05"
              value={form.periodCode}
              onChange={(e) => setForm((f) => ({ ...f, periodCode: e.target.value }))}
              required
              className="w-full rounded-lg border border-brand-cream-3 bg-card px-3 py-2 text-sm text-brand-ink shadow-sm transition-colors focus:border-brand-ember-5 focus:outline-none focus:ring-1 focus:ring-brand-ember-5"
            />
            <p className="text-xs text-brand-ink-3">
              Periode akuntansi untuk menjurnal penyesuaian opname. Contoh: 2026-05
            </p>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="notes" className="block text-sm font-medium text-brand-ink">
              Catatan
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={3}
              placeholder="Catatan opsional untuk sesi ini..."
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              className="w-full rounded-lg border border-brand-cream-3 bg-card px-3 py-2 text-sm text-brand-ink shadow-sm transition-colors focus:border-brand-ember-5 focus:outline-none focus:ring-1 focus:ring-brand-ember-5"
            />
          </div>

          {state?.error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              <strong>Error:</strong> {state.error}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => router.back()}
              className="rounded-lg border border-brand-cream-3 bg-card px-4 py-2 text-sm font-medium text-brand-ink transition-colors hover:bg-brand-cream-1"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isPending || locationOptions.length === 0}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-ember-5 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-ember-6 disabled:opacity-50"
            >
              {isPending ? 'Memproses...' : 'Buat Sesi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
