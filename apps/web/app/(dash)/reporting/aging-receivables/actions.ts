/**
 * AR aging — Server Action wrapper. ctx derived server-side.
 */

'use server';

import { getSession } from '@/lib/auth';
import { type AgingResult, aging } from '@erp/services/reporting';
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

export async function fetchAgingReceivables(input: {
  asOf: string;
  locationId?: string;
}): Promise<{ ok: boolean; data?: AgingResult; error?: string }> {
  const ctx = await resolveCtx();
  if (!ctx) return { ok: false, error: 'unauthenticated' };
  const result = await aging({ kind: 'AR', asOf: input.asOf, locationId: input.locationId }, ctx);
  if (!result.ok) return { ok: false, error: result.error.messageKey };
  return { ok: true, data: result.value };
}

export async function fetchAgingPayables(input: {
  asOf: string;
  locationId?: string;
}): Promise<{ ok: boolean; data?: AgingResult; error?: string }> {
  const ctx = await resolveCtx();
  if (!ctx) return { ok: false, error: 'unauthenticated' };
  const result = await aging({ kind: 'AP', asOf: input.asOf, locationId: input.locationId }, ctx);
  if (!result.ok) return { ok: false, error: result.error.messageKey };
  return { ok: true, data: result.value };
}
