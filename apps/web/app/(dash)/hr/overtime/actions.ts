'use server';

import { getSession } from '@/lib/auth';
import { authorizedLocationIdsForTenant } from '@/lib/authz';
import { and, db, eq, isNull } from '@erp/db';
import { employees } from '@erp/db/schema/hr';
import { approveOvertime, listOvertimes, recordOvertime, rejectOvertime } from '@erp/services/hr';
import type { AuditContext } from '@erp/shared/types';
import { getTranslations } from 'next-intl/server';
import { revalidatePath } from 'next/cache';

async function getCtx(): Promise<AuditContext | null> {
  const session = await getSession();
  if (!session?.user) return null;
  const user = session.user as Record<string, unknown>;
  return {
    tenantId: String(user.tenantId ?? 'default'),
    userId: String(user.id ?? ''),
    locationId: String(user.locationId ?? ''),
  };
}

export async function fetchOvertimePage(
  status?: string,
  employeeId?: string,
  dateFrom?: string,
  dateTo?: string,
  page = 1,
) {
  const session = await getSession();
  if (!session?.user) throw new Error('Unauthenticated');
  const user = session.user as Record<string, unknown>;
  const tenantId = String(user.tenantId ?? 'default');
  const userId = String(user.id ?? '');

  const scope = await authorizedLocationIdsForTenant(userId, 'hr.manage_attendance', tenantId);
  if (!scope.global && scope.locationIds.length === 0) return null;

  const ctx: AuditContext = { tenantId, userId, locationId: String(user.locationId ?? '') };

  const result = await listOvertimes(
    {
      status: status || undefined,
      employeeId: employeeId || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      locationIds: !scope.global ? scope.locationIds : undefined,
      page,
      pageSize: 25,
    },
    ctx,
  );

  const empConds = [eq(employees.tenantId, tenantId), isNull(employees.deletedAt)];
  if (!scope.global) {
    const { inArray } = await import('@erp/db');
    empConds.push(inArray(employees.locationId, scope.locationIds));
  }
  const allEmployees = await db
    .select({ id: employees.id, name: employees.name })
    .from(employees)
    .where(and(...empConds))
    .orderBy(employees.name);

  return {
    data: result.ok ? result.value : { items: [], total: 0 },
    employees: allEmployees.map((e) => ({ id: e.id, name: e.name })),
  };
}

export async function recordOvertimeAction(
  employeeId: string,
  workDate: string,
  hours: number,
  reason: string,
) {
  const ctx = await getCtx();
  if (!ctx) return { error: 'Unauthenticated' };
  const t = await getTranslations('hr.overtime');

  const result = await recordOvertime({ employeeId, workDate, hours, reason }, ctx);
  if (!result.ok) return { error: result.error.message };

  revalidatePath('/hr/overtime');
  return { ok: true, message: t('recordSuccess') };
}

export async function approveOvertimeAction(id: string) {
  const ctx = await getCtx();
  if (!ctx) return { error: 'Unauthenticated' };
  const t = await getTranslations('hr.overtime');

  const result = await approveOvertime(id, ctx);
  if (!result.ok) return { error: result.error.message };

  revalidatePath('/hr/overtime');
  return { ok: true, message: t('approveSuccess') };
}

export async function rejectOvertimeAction(id: string, reason: string) {
  const ctx = await getCtx();
  if (!ctx) return { error: 'Unauthenticated' };
  const t = await getTranslations('hr.overtime');

  const result = await rejectOvertime(id, reason, ctx);
  if (!result.ok) return { error: result.error.message };

  revalidatePath('/hr/overtime');
  return { ok: true, message: t('rejectSuccess') };
}
