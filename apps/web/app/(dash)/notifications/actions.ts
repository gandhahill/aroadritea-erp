'use server';

import { getSession } from '@/lib/auth';
import {
  countUnreadNotifications,
  listUserNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@erp/services/notification';
import { revalidatePath } from 'next/cache';

async function ctx(): Promise<{ tenantId: string; userId: string } | null> {
  const session = await getSession();
  if (!session?.user) return null;
  const user = session.user as Record<string, unknown>;
  return {
    tenantId: String(user.tenantId ?? 'default'),
    userId: String(user.id ?? ''),
  };
}

export async function fetchMyNotifications() {
  const c = await ctx();
  if (!c) return { items: [], unread: 0 };
  const [items, unread] = await Promise.all([
    listUserNotifications(c.tenantId, c.userId, 50),
    countUnreadNotifications(c.tenantId, c.userId),
  ]);
  return { items, unread };
}

export async function fetchUnreadCount(): Promise<number> {
  const c = await ctx();
  if (!c) return 0;
  return countUnreadNotifications(c.tenantId, c.userId);
}

export async function markReadAction(id: string): Promise<void> {
  const c = await ctx();
  if (!c) return;
  await markNotificationRead(c.tenantId, c.userId, id);
  revalidatePath('/notifications');
}

export async function markAllReadAction(): Promise<void> {
  const c = await ctx();
  if (!c) return;
  await markAllNotificationsRead(c.tenantId, c.userId);
  revalidatePath('/notifications');
}
