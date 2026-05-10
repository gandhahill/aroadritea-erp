/**
 * New Stock Opname Session Page — SD §25.9
 *
 * Form to create a new opname session.
 * Selects date, period, location — calls createOpnameSessionAction.
 */

'use client';

import { useActionState, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createOpnameSessionAction } from '../actions';

const EMPTY_FORM = { locationId: '', sessionDate: '', periodCode: '', notes: '' };

export default function NewOpnamePage() {
  const router = useRouter();
  const [form, setForm] = useState(EMPTY_FORM);
  const [state, submitAction, isPending] = useActionState(submitOpname, null);

  async function submitOpname(_prev: unknown, formData: FormData) {
    const params = {
      locationId: formData.get('locationId') as string,
      sessionDate: formData.get('sessionDate') as string,
      periodCode: formData.get('periodCode') as string,
      notes: formData.get('notes') as string,
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
      {/* Page header */}
      <div>
        <button
          onClick={() => router.back()}
          className="mb-3 inline-flex items-center gap-1.5 text-sm text-brand-ink-3 transition-colors hover:text-brand-ink"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
          Kembali
        </button>
        <h1 className="text-2xl font-bold text-brand-ink">Buat Sesi Opname</h1>
        <p className="mt-1 text-sm text-brand-ink-3">
          Buat sesi stock opname baru. Sistem akan mem-snapshot stok saat ini sebagai baseline.
        </p>
      </div>

      {/* Form card */}
      <div className="rounded-xl border border-brand-cream-3 bg-card p-6 shadow-sm">
        <form action={submitAction} className="space-y-5">
          {/* Location */}
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
              className="w-full rounded-lg border border-brand-cream-3 bg-white px-3 py-2 text-sm text-brand-ink shadow-sm transition-colors focus:border-brand-ember-5 focus:outline-none focus:ring-1 focus:ring-brand-ember-5"
            >
              <option value="">— Pilih Lokasi —</option>
              <option value="LOC-001">Toko Pusat Yogyakarta</option>
              <option value="LOC-002">Cabang Jakarta</option>
              <option value="LOC-003">Warehouse Utama</option>
            </select>
          </div>

          {/* Session date */}
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
              className="w-full rounded-lg border border-brand-cream-3 bg-white px-3 py-2 text-sm text-brand-ink shadow-sm transition-colors focus:border-brand-ember-5 focus:outline-none focus:ring-1 focus:ring-brand-ember-5"
            />
          </div>

          {/* Period code */}
          <div className="space-y-1.5">
            <label htmlFor="periodCode" className="block text-sm font-medium text-brand-ink">
              Kode Periode <span className="text-rose-500">*</span>
            </label>
            <input
              id="periodCode"
              name="periodCode"
              type="text"
              placeholder="e.g. 2026-05"
              value={form.periodCode}
              onChange={(e) => setForm((f) => ({ ...f, periodCode: e.target.value }))}
              required
              className="w-full rounded-lg border border-brand-cream-3 bg-white px-3 py-2 text-sm text-brand-ink shadow-sm transition-colors focus:border-brand-ember-5 focus:outline-none focus:ring-1 focus:ring-brand-ember-5"
            />
            <p className="text-xs text-brand-ink-3">
              Periode akuntansi untuk menjurnal penyesuaian opname. Contoh: 2026-05
            </p>
          </div>

          {/* Notes */}
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
              className="w-full rounded-lg border border-brand-cream-3 bg-white px-3 py-2 text-sm text-brand-ink shadow-sm transition-colors focus:border-brand-ember-5 focus:outline-none focus:ring-1 focus:ring-brand-ember-5"
            />
          </div>

          {/* Error */}
          {state?.error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              <strong>Error:</strong> {state.error}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => router.back()}
              className="rounded-lg border border-brand-cream-3 bg-white px-4 py-2 text-sm font-medium text-brand-ink transition-colors hover:bg-brand-cream-1"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-ember-5 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-ember-6 disabled:opacity-50"
            >
              {isPending ? (
                <>
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Memproses...
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  Buat Sesi
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}