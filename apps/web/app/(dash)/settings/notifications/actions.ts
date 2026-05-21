'use server';

import { getSession } from '@/lib/auth';
import {
  createNotificationChannel,
  listNotificationChannels,
  updateNotificationChannel,
} from '@erp/services/notification';
import { revalidatePath } from 'next/cache';

interface ActionState {
  success: boolean;
  error?: string;
}

async function getContext() {
  const session = await getSession();
  if (!session?.user) return null;
  const user = session.user as Record<string, unknown>;
  return {
    tenantId: (user.tenantId as string | undefined) ?? 'default',
    userId: user.id as string,
    locationId: (user.locationId as string | undefined) ?? 'global',
  };
}

export async function fetchNotificationChannels() {
  const ctx = await getContext();
  if (!ctx) return [];
  const result = await listNotificationChannels(ctx);
  return result.ok ? result.value : [];
}

export async function createNotificationChannelAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await getContext();
  if (!ctx) return { success: false, error: 'Sesi login tidak valid.' };

  const result = await createNotificationChannel(
    {
      label: String(formData.get('label') ?? '').trim(),
      channelType: String(formData.get('channelType') ?? 'email') as
        | 'email'
        | 'whatsapp'
        | 'telegram',
      target: String(formData.get('target') ?? '').trim(),
      purpose: String(formData.get('purpose') ?? 'all') as
        | 'all'
        | 'outage'
        | 'stock_alert'
        | 'party_ledger',
      isActive: formData.get('isActive') === 'on',
    },
    ctx,
  );

  if (!result.ok) return { success: false, error: result.error.message };
  revalidatePath('/settings/notifications');
  return { success: true };
}

export async function toggleNotificationChannelAction(id: string, isActive: boolean) {
  const ctx = await getContext();
  if (!ctx) return { success: false, error: 'Sesi login tidak valid.' };

  const result = await updateNotificationChannel(id, { isActive }, ctx);
  if (!result.ok) return { success: false, error: result.error.message };

  revalidatePath('/settings/notifications');
  return { success: true };
}
