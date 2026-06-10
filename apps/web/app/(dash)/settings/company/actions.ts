'use server';

import { getSession } from '@/lib/auth';
import { and, db, eq } from '@erp/db';
import { cmsSettings } from '@erp/db/schema/cms';
import { auditRecord } from '@erp/services/audit';
import { generateId } from '@erp/shared/id';
import type { AuditContext } from '@erp/shared/types';
import { revalidatePath } from 'next/cache';

export interface CompanyInfo {
  name: string;
  address: string;
  npwp: string;
  phone: string;
}

const COMPANY_KEYS = ['company.name', 'company.address', 'company.npwp', 'company.phone'] as const;

export async function fetchCompanySettings(): Promise<CompanyInfo> {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');
  const user = session.user as Record<string, unknown>;
  const tenantId = String(user.tenantId ?? 'default');

  const rows = await db
    .select({ key: cmsSettings.key, value: cmsSettings.value })
    .from(cmsSettings)
    .where(and(eq(cmsSettings.tenantId, tenantId)));

  const map = new Map<string, unknown>();
  for (const row of rows) {
    map.set(row.key, row.value);
  }

  return {
    name: (map.get('company.name') as string) ?? 'PT. Gandha Hill Catering Management Indonesia',
    address: (map.get('company.address') as string) ?? '',
    npwp: (map.get('company.npwp') as string) ?? '',
    phone: (map.get('company.phone') as string) ?? '',
  };
}

export async function saveCompanySettingsAction(info: CompanyInfo) {
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

  const entries: Array<{ key: string; value: string }> = [
    { key: 'company.name', value: info.name },
    { key: 'company.address', value: info.address },
    { key: 'company.npwp', value: info.npwp },
    { key: 'company.phone', value: info.phone },
  ];

  for (const entry of entries) {
    const [existing] = await db
      .select()
      .from(cmsSettings)
      .where(and(eq(cmsSettings.tenantId, tenantId), eq(cmsSettings.key, entry.key)))
      .limit(1);

    if (existing) {
      await db
        .update(cmsSettings)
        .set({ value: entry.value })
        .where(eq(cmsSettings.id, existing.id));

      await auditRecord({
        action: 'update',
        entityType: 'cms_settings',
        entityId: existing.id,
        before: { value: existing.value },
        after: { value: entry.value },
        ctx,
      });
    } else {
      const id = generateId();
      await db.insert(cmsSettings).values({
        id,
        tenantId,
        key: entry.key,
        value: entry.value,
      });

      await auditRecord({
        action: 'create',
        entityType: 'cms_settings',
        entityId: id,
        before: null,
        after: { key: entry.key, value: entry.value },
        ctx,
      });
    }
  }

  revalidatePath('/settings/company');
  return { success: true };
}
