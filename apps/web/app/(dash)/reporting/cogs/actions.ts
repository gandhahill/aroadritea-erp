'use server';

import { getSession } from '@/lib/auth';
import { type CogsResult, cogsReport } from '@erp/services/reporting';
import type { AuditContext } from '@erp/shared/types';

async function resolveCtx(): Promise<AuditContext | null> {
  const session = await getSession();
  if (!session?.user) return null;
  const user = session.user as Record<string, unknown>;
  return {
    userId: String(user.id ?? ''),
    tenantId: String(user.tenantId ?? 'default'),
    locationId: String(user.locationId ?? ''),
  };
}

export async function fetchCogs(input: {
  productId?: string;
  includeInactive?: boolean;
}): Promise<{ ok: boolean; data?: CogsResult; error?: string }> {
  const ctx = await resolveCtx();
  if (!ctx) return { ok: false, error: 'unauthenticated' };
  const result = await cogsReport(input, ctx);
  if (!result.ok) return { ok: false, error: result.error.messageKey };
  return { ok: true, data: result.value };
}
