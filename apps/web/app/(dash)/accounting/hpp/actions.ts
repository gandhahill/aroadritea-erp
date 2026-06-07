'use server';

import { getSession } from '@/lib/auth';
import { getHppSummary, postHppAdjustment } from '@erp/services/accounting';
import type { AuditContext } from '@erp/shared/types';
import { revalidatePath } from 'next/cache';

async function getAuditContext(): Promise<AuditContext | null> {
  const session = await getSession();
  if (!session?.user) return null;
  const user = session.user as Record<string, unknown>;
  return {
    userId: String(user.id ?? ''),
    tenantId: String(user.tenantId ?? 'default'),
    locationId: String(user.locationId ?? ''),
  };
}

export async function fetchHppSummaryAction(locationId: string, periodEnd: string) {
  const ctx = await getAuditContext();
  if (!ctx) return { ok: false as const, error: 'Unauthenticated' };
  const result = await getHppSummary({ locationId, periodEnd }, ctx);
  if (!result.ok) return { ok: false as const, error: String(result.error.message ?? 'Failed') };
  return { ok: true as const, value: result.value };
}

export async function postHppAdjustmentAction(input: {
  locationId: string;
  periodEnd: string;
  hppAdjustmentAmount: string;
  supplyAdjustmentAmount: string;
  notes?: string;
}) {
  const ctx = await getAuditContext();
  if (!ctx) return { ok: false as const, error: 'Unauthenticated' };
  const result = await postHppAdjustment(input, ctx);
  if (!result.ok) return { ok: false as const, error: String(result.error.message ?? 'Failed') };
  revalidatePath('/accounting/hpp');
  revalidatePath('/accounting/journals');
  return { ok: true as const, value: result.value };
}
