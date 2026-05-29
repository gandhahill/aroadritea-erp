'use server';

import { getSession } from '@/lib/auth';
import { registerNsfpBlock, exportEFakturCsv } from '@erp/services/tax';
import type { AuditContext } from '@erp/shared/types';
import { revalidatePath } from 'next/cache';

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

export async function registerNsfpBlockAction(formData: FormData) {
  const ctx = await getAuditContext();
  if (!ctx) return { error: 'Unauthorized' };

  const startNsfp = formData.get('startNsfp') as string;
  const endNsfp = formData.get('endNsfp') as string;
  const issueDate = formData.get('issueDate') as string;

  const res = await registerNsfpBlock({ startNsfp, endNsfp, issueDate }, ctx);
  
  if (!res.ok) {
    return { error: res.error.messageKey || 'Failed to register NSFP Block' };
  }

  revalidatePath('/tax/efaktur');
  return { success: true };
}

export async function exportEFakturCsvAction(period: string) {
  const ctx = await getAuditContext();
  if (!ctx) return { error: 'Unauthorized' };

  const res = await exportEFakturCsv(period, ctx);
  if (!res.ok) {
    return { error: res.error.messageKey || 'Failed to export' };
  }

  return { success: true, csv: res.value };
}
