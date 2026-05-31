/**
 * HR Check-In Server Action — calls attendance.checkIn service.
 *
 * Audit context is resolved server-side from the active session. The
 * previous signature accepted `ctx: AuditContext` from the client which
 * allowed a malicious browser to forge the actor id or tenant.
 */

'use server';

import { getSession } from '@/lib/auth';
import { checkIn } from '@erp/services/hr';
import type { CheckInInput } from '@erp/services/hr';
import type { AuditContext } from '@erp/shared/types';

async function resolveCtx(): Promise<AuditContext | null> {
  const session = await getSession();
  if (!session?.user?.id) return null;
  const user = session.user as Record<string, unknown>;
  return {
    userId: String(user.id),
    tenantId: String(user.tenantId ?? 'default'),
    locationId: String(user.locationId ?? ''),
  };
}

export async function serverCheckIn(input: CheckInInput) {
  const ctx = await resolveCtx();
  if (!ctx) {
    return { ok: false as const, error: { code: 'UNAUTHENTICATED', message: 'Session expired' } };
  }
  return checkIn(input, ctx);
}
