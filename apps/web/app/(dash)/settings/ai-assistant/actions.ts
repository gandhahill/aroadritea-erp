'use server';

import { getSession } from '@/lib/auth';
import { updateAiRuntimeConfig } from '@erp/services/ai';
import type { AuditContext } from '@erp/shared/types';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

async function resolveCtx(): Promise<AuditContext | null> {
  const session = await getSession();
  if (!session?.user) return null;
  const user = session.user as Record<string, unknown>;
  const userId = String(user.id ?? '');
  const tenantId = String(user.tenantId ?? 'default');
  if (!userId || !tenantId) return null;
  return { userId, tenantId, locationId: String(user.locationId ?? '') };
}

export async function saveAiRuntimeSettingsAction(formData: FormData) {
  const ctx = await resolveCtx();
  if (!ctx) redirect('/login');

  const result = await updateAiRuntimeConfig(
    {
      enabled: formData.get('enabled') === 'on',
      baseUrl: String(formData.get('baseUrl') ?? '').trim(),
      model: String(formData.get('model') ?? '').trim(),
      reasoningModel: String(formData.get('reasoningModel') ?? '').trim(),
      temperature: Number(formData.get('temperature') ?? 0.4),
      maxTokens: Number(formData.get('maxTokens') ?? 2048),
      hourlyCap: Number(formData.get('hourlyCap') ?? 30),
      supportsVision: formData.get('supportsVision') === 'on',
    },
    ctx,
  );

  if (!result.ok) {
    redirect(`/settings/ai-assistant?error=${encodeURIComponent(result.error.messageKey)}`);
  }

  revalidatePath('/settings/ai-assistant');
  revalidatePath('/ai-assistant');
  redirect('/settings/ai-assistant?saved=1');
}
