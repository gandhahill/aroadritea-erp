'use server';

import { getSession } from '@/lib/auth';
import { db, eq, and } from '@erp/db';
import { cmsSettings } from '@erp/db/schema/cms';
import { revalidatePath } from 'next/cache';
import type { AuditContext } from '@erp/shared/types';
import { auditRecord } from '@erp/services/audit';

export async function saveAccountingSettingsAction(apAccountId: string) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');
  
  const user = session.user as Record<string, unknown>;
  const tenantId = String(user.tenantId ?? 'default');
  
  const ctx: AuditContext = {
    userId: String(user.id),
    tenantId,
    locationId: String(user.locationId ?? ''),
    userAgent: 'ERP Web',
    ipAddress: '127.0.0.1',
  };

  const key = 'accounting.payables.accountIds';
  const newValue = [apAccountId]; // Always save as array for compatibility

  const [existing] = await db
    .select()
    .from(cmsSettings)
    .where(and(eq(cmsSettings.tenantId, tenantId), eq(cmsSettings.key, key)))
    .limit(1);

  if (existing) {
    await db
      .update(cmsSettings)
      .set({ value: newValue })
      .where(eq(cmsSettings.id, existing.id));

    await auditRecord({
      action: 'update',
      entityType: 'cms_settings',
      entityId: existing.id,
      before: { value: existing.value },
      after: { value: newValue },
      ctx,
    });
  } else {
    const id = `SET-${Date.now()}`;
    await db.insert(cmsSettings).values({
      id,
      tenantId,
      key,
      value: newValue,
    });

    await auditRecord({
      action: 'create',
      entityType: 'cms_settings',
      entityId: id,
      before: null,
      after: { key, value: newValue },
      ctx,
    });
  }

  revalidatePath('/settings/accounting');
  return { success: true };
}
