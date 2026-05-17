/**
 * Notification bell — surfaces unread in-app notification count in the
 * dashboard header. Server component; refreshes on every render (the
 * layout is `force-dynamic`).
 */

import Link from 'next/link';
import { fetchUnreadCount } from './notifications/actions';

export async function NotificationBell() {
  const count = await fetchUnreadCount();
  return (
    <Link
      href="/notifications"
      aria-label={count > 0 ? `${count} notifikasi belum dibaca` : 'Notifikasi'}
      className="relative flex h-9 w-9 items-center justify-center rounded-full text-brand-ink-2 transition hover:bg-brand-cream-1"
    >
      <svg
        className="h-5 w-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.6}
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0"
        />
      </svg>
      {count > 0 ? (
        <span className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-red px-1 text-[10px] font-bold text-white">
          {count > 99 ? '99+' : count}
        </span>
      ) : null}
    </Link>
  );
}
