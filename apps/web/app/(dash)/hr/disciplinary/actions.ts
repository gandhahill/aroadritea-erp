'use server';

import { getSession } from '@/lib/auth';
import { db, eq } from '@erp/db';
import { users } from '@erp/db/schema/auth';
import { employees } from '@erp/db/schema/hr';
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
  const result = await listDisciplinaryActions({ limit: 50, ...input }, ctx);
  if (!result.ok) return result;

  // Enrich with employee + issuer names so the UI never has to render UUIDs.
  // Tenant-scoped lookups — without these we'd leak names across tenants.
  const [empRows, userRows] = await Promise.all([
    db
      .select({ id: employees.id, name: employees.name })
      .from(employees)
      .where(eq(employees.tenantId, ctx.tenantId)),
    db
      .select({ id: users.id, displayName: users.displayName })
      .from(users)
      .where(eq(users.tenantId, ctx.tenantId)),
  ]);
  const empMap = new Map(empRows.map((e) => [e.id, String(e.name ?? e.id)]));
  const userMap = new Map(userRows.map((u) => [u.id, u.displayName ?? '']));

  const enriched = result.value.map((r) => ({
    id: r.id,
    employeeId: r.employeeId,
    employeeName: empMap.get(r.employeeId) ?? null,
    level: r.level,
    reason: r.reason,
    incidentDate:
      r.incidentDate instanceof Date ? r.incidentDate.toISOString() : String(r.incidentDate ?? ''),
    status: r.status,
    issuedBy: r.issuedBy,
    issuedByName: userMap.get(r.issuedBy) || null,
    attachmentUrl: r.attachmentUrl,
  }));
  return { ok: true as const, value: enriched };
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
