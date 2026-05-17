'use server';

import { getSession } from '@/lib/auth';
import {
  acknowledgeDisciplinaryAction,
  createDisciplinaryAction,
  listDisciplinaryActions,
} from '@erp/services/hr';
import type { AuditContext } from '@erp/shared/types';

/**
 * Resolve the active session's audit context. Previously these actions
 * hard-coded `userId: 'system'` and `tenantId: 'default'`, meaning every
 * disciplinary record was attributed to a fake actor and would punch
 * through multi-tenant isolation. The service still enforces
 * `requirePermission(...)` internally — passing the real user makes that
 * gate functional instead of cosmetic.
 */
async function resolveCtx(): Promise<AuditContext> {
  const session = await getSession();
  const user = (session?.user ?? {}) as Record<string, unknown>;
  return {
    userId: String(user.id ?? ''),
    tenantId: String(user.tenantId ?? 'default'),
    locationId: String(user.locationId ?? ''),
  };
}

export async function listDisciplinaryActionsAction(input: {
  employeeId?: string;
  level?: 'SP1' | 'SP2' | 'SP3';
  status?: 'issued' | 'acknowledged' | 'escalated';
}) {
  const ctx = await resolveCtx();
  return listDisciplinaryActions({ limit: 50, ...input }, ctx);
}

export async function createDisciplinaryActionAction(
  input: Parameters<typeof createDisciplinaryAction>[0],
) {
  const ctx = await resolveCtx();
  return createDisciplinaryAction(input, ctx);
}

export async function acknowledgeDisciplinaryActionAction(
  input: Parameters<typeof acknowledgeDisciplinaryAction>[0],
) {
  const ctx = await resolveCtx();
  return acknowledgeDisciplinaryAction(input, ctx);
}
