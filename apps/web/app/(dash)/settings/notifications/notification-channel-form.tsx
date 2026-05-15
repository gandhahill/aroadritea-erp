'use client';

import { useActionState } from 'react';
import { createNotificationChannelAction } from './actions';

const INPUT =
  'w-full rounded-lg border border-brand-cream-3 bg-card px-3 py-2 text-sm text-brand-ink shadow-sm transition-colors focus:border-brand-ember-5 focus:outline-none focus:ring-1 focus:ring-brand-ember-5';

export function NotificationChannelForm() {
  const [state, action, pending] = useActionState(createNotificationChannelAction, {
    success: false,
  });

  return (
    <form
      action={action}
      className="space-y-4 rounded-xl border border-brand-cream-3 bg-card p-5 shadow-sm"
    >
      <div>
        <h2 className="text-base font-semibold text-brand-ink">Tambah kanal</h2>
        <p className="mt-1 text-sm text-brand-ink-3">
          Target notifikasi operasional seperti outage monitor dan stock alert.
        </p>
      </div>

      {state.error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {state.error}
        </div>
      ) : null}
      {state.success ? (
        <div className="rounded-lg border border-brand-jade/30 bg-brand-jade/10 px-3 py-2 text-sm text-brand-jade">
          Kanal notifikasi tersimpan.
        </div>
      ) : null}

      <label className="space-y-1.5">
        <span className="text-sm font-medium text-brand-ink">Label</span>
        <input name="label" required className={INPUT} />
      </label>
      <label className="space-y-1.5">
        <span className="text-sm font-medium text-brand-ink">Tipe</span>
        <select name="channelType" required defaultValue="email" className={INPUT}>
          <option value="email">Email</option>
        </select>
      </label>
      <label className="space-y-1.5">
        <span className="text-sm font-medium text-brand-ink">Target</span>
        <input
          name="target"
          required
          placeholder="ops@aroadritea.com"
          className={INPUT}
        />
      </label>
      <label className="space-y-1.5">
        <span className="text-sm font-medium text-brand-ink">Purpose</span>
        <select name="purpose" required defaultValue="all" className={INPUT}>
          <option value="all">Semua notifikasi</option>
          <option value="outage">Outage</option>
          <option value="stock_alert">Stock alert</option>
        </select>
      </label>
      <label className="flex items-center gap-2 text-sm font-medium text-brand-ink">
        <input
          name="isActive"
          type="checkbox"
          defaultChecked
          className="h-4 w-4 rounded border-brand-cream-3 text-brand-red focus:ring-brand-red"
        />
        Aktif
      </label>

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-brand-red px-5 py-2 text-sm font-semibold text-white shadow-soft transition-colors hover:bg-brand-red-dark disabled:opacity-50"
      >
        {pending ? 'Menyimpan...' : 'Simpan kanal'}
      </button>
    </form>
  );
}
