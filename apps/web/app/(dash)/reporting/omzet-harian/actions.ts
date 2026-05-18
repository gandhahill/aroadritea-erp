/**
 * Omzet Harian Server Actions — SD §25.5b, SoT §21.3b
 */

'use server';

import { getSession } from '@/lib/auth';
import {
  exportOmzetHarianXlsx,
  getOmzetHarian,
  saveOmzetAdjustment,
} from '@erp/services/reporting';
import type { AuditContext } from '@erp/shared/types';
import { getLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';

async function currentLocale(): Promise<'id' | 'en' | 'zh'> {
  const raw = await getLocale().catch(() => 'id');
  return raw === 'en' || raw === 'zh' ? raw : 'id';
}

async function buildCtx(locationId: string): Promise<AuditContext> {
  const session = await getSession();
  if (!session?.user) redirect('/login');
  const user = session.user as Record<string, unknown>;
  return {
    userId: String(user.id ?? ''),
    tenantId: String(user.tenantId ?? 'default'),
    locationId,
  };
}

export async function serverGetOmzetHarian(params: { locationId: string; date: string }) {
  const ctx = await buildCtx(params.locationId);
  const locale = await currentLocale();
  return getOmzetHarian({ ...params, locale }, ctx);
}

export async function serverSaveOmzetAdjustment(params: {
  locationId: string;
  date: string;
  adjustmentAmount: string;
  adjustmentNote?: string;
}) {
  const ctx = await buildCtx(params.locationId);
  return saveOmzetAdjustment(params, ctx);
}

export async function serverExportOmzetHarian(params: {
  locationId: string;
  date: string;
  locale?: 'id' | 'en' | 'zh';
}) {
  const ctx = await buildCtx(params.locationId);
  return exportOmzetHarianXlsx(params, ctx);
}
