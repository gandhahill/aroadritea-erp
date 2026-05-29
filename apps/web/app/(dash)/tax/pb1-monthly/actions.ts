'use server';

import { getSession } from '@/lib/auth';
import { getOmzetBulanan, exportOmzetBulananXlsx } from '@erp/services/reporting';
import type { AuditContext } from '@erp/shared/types';
import { getLocale } from 'next-intl/server';

async function getAuditContext(): Promise<AuditContext | null> {
  const session = await getSession();
  if (!session?.user) return null;
  const user = session.user as Record<string, unknown>;
  return {
    userId: String(user.id ?? ''),
    tenantId: String(user.tenantId ?? 'default'),
    locationId: '',
  };
}

export async function fetchOmzetBulananAction(period: string, locationId: string) {
  const ctx = await getAuditContext();
  if (!ctx) return { error: 'Unauthorized' };

  const locale = (await getLocale()) as 'id' | 'en' | 'zh';
  const res = await getOmzetBulanan({ period, locationId, locale }, ctx);
  if (!res.ok) return { error: res.error.message };

  return { data: res.value };
}

export async function exportOmzetBulananXlsxAction(period: string, locationId: string) {
  const ctx = await getAuditContext();
  if (!ctx) return { error: 'Unauthorized' };

  const locale = (await getLocale()) as 'id' | 'en' | 'zh';
  const res = await exportOmzetBulananXlsx({ period, locationId, locale }, ctx);
  if (!res.ok) return { error: res.error.message };

  // Note: For binary XLSX data, passing Buffer directly via Server Action can be tricky.
  // We'll return it as base64 and decode it on the client.
  const base64 = Buffer.from(res.value.buffer).toString('base64');
  return { base64, filename: res.value.filename };
}
