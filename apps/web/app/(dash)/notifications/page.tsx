/**
 * Notifikasi — riwayat in-app notification untuk user yang sedang login.
 */

import { PageHeader } from '@/components/page-header';
import { getSession } from '@/lib/auth';
import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { fetchMyNotifications, markAllReadAction, markReadAction } from './actions';

export const metadata: Metadata = { title: 'Notifications' };

export default async function NotificationsPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const { items, unread } = await fetchMyNotifications();
  const t = await getTranslations('inbox');
  const locale = await getLocale();

  function relativeTime(d: Date): string {
    const diff = Date.now() - d.getTime();
    const min = Math.floor(diff / 60_000);
    if (min < 1) return t('time.justNow');
    if (min < 60) return t('time.minutesAgo', { min });
    const hr = Math.floor(min / 60);
    if (hr < 24) return t('time.hoursAgo', { hr });
    const day = Math.floor(hr / 24);
    if (day < 7) return t('time.daysAgo', { day });
    return d.toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function getKindLabel(kind: string): string {
    const validKinds = [
      'leave',
      'po',
      'opname',
      'attendance',
      'shift',
      'payroll',
      'recruitment',
    ] as const;
    if (validKinds.includes(kind as any)) {
      return t(`kinds.${kind}` as Parameters<typeof t>[0]);
    }
    return kind;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={<>{t('title')}</>}
        description={
          <>
            {t('unreadCount', { count: unread })}· {t('latestCount', { count: items.length })}
          </>
        }
        actions={
          <>
            {unread > 0 ? (
              <form action={markAllReadAction}>
                <button
                  type="submit"
                  className="rounded-md border border-brand-cream-3 px-3 py-1.5 text-xs font-semibold text-brand-ink-2 hover:border-brand-red/40 hover:text-brand-red"
                >
                  {t('markAllRead')}
                </button>
              </form>
            ) : null}
          </>
        }
      />

      <div className="rounded-xl border border-brand-cream-3 bg-card">
        {items.length === 0 ? (
          <div className="py-12 text-center text-sm text-brand-ink-3">{t('empty')}</div>
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
                    {getKindLabel(n.kind)} · {relativeTime(new Date(n.createdAt))}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {n.link ? (
                    <Link
                      href={n.link}
                      className="text-xs font-semibold text-brand-red hover:underline"
                    >
                      {t('open')}
                    </Link>
                  ) : null}
                  {!n.readAt ? (
                    <form action={markReadAction.bind(null, n.id)}>
                      <button
                        type="submit"
                        className="text-[11px] text-brand-ink-3 hover:text-brand-red"
                      >
                        {t('markRead')}
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
