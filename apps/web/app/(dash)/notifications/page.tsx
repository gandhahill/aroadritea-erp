/**
 * Notifikasi — riwayat in-app notification untuk user yang sedang login.
 */

import { getSession } from '@/lib/auth';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { fetchMyNotifications, markAllReadAction, markReadAction } from './actions';

export const metadata: Metadata = { title: 'Notifikasi' };

const KIND_LABEL: Record<string, string> = {
  leave: 'Cuti',
  po: 'Pembelian',
  opname: 'Opname',
  attendance: 'Presensi',
  shift: 'Shift',
  payroll: 'Payroll',
  recruitment: 'Rekrutmen',
};

function relativeTime(d: Date): string {
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'baru saja';
  if (min < 60) return `${min} menit lalu`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} jam lalu`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day} hari lalu`;
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default async function NotificationsPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const { items, unread } = await fetchMyNotifications();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-brand-ink">Notifikasi</h1>
          <p className="mt-1 text-sm text-brand-ink-3">
            {unread} belum dibaca · {items.length} terbaru
          </p>
        </div>
        {unread > 0 ? (
          <form action={markAllReadAction}>
            <button
              type="submit"
              className="rounded-md border border-brand-cream-3 px-3 py-1.5 text-xs font-semibold text-brand-ink-2 hover:border-brand-red/40 hover:text-brand-red"
            >
              Tandai semua dibaca
            </button>
          </form>
        ) : null}
      </div>

      <div className="rounded-xl border border-brand-cream-3 bg-card">
        {items.length === 0 ? (
          <div className="py-12 text-center text-sm text-brand-ink-3">Belum ada notifikasi.</div>
        ) : (
          <ul className="divide-y divide-brand-cream-3">
            {items.map((n) => (
              <li
                key={n.id}
                className={`flex items-start gap-3 px-4 py-3 ${
                  n.readAt ? 'opacity-70' : 'bg-brand-cream-1/40'
                }`}
              >
                <span className="mt-1 inline-flex h-2 w-2 shrink-0 rounded-full bg-brand-red">
                  {n.readAt ? (
                    <span className="block h-full w-full rounded-full bg-brand-ink-3/30" />
                  ) : null}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-brand-ink">{n.title}</p>
                  {n.body ? <p className="mt-0.5 text-xs text-brand-ink-3">{n.body}</p> : null}
                  <p className="mt-1 text-[11px] text-brand-ink-3">
                    {KIND_LABEL[n.kind] ?? n.kind} · {relativeTime(new Date(n.createdAt))}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {n.link ? (
                    <Link
                      href={n.link}
                      className="text-xs font-semibold text-brand-red hover:underline"
                    >
                      Buka
                    </Link>
                  ) : null}
                  {!n.readAt ? (
                    <form action={markReadAction.bind(null, n.id)}>
                      <button
                        type="submit"
                        className="text-[11px] text-brand-ink-3 hover:text-brand-red"
                      >
                        Tandai dibaca
                      </button>
                    </form>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
