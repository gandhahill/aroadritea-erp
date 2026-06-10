'use server';

import { getSession } from '@/lib/auth';
import { authorizedLocationIdsForTenant } from '@/lib/authz';
import { and, db, eq, isNull } from '@erp/db';
import { cmsSettings } from '@erp/db/schema/cms';
import { employees } from '@erp/db/schema/hr';
import { approveKasbon, listKasbon, rejectKasbon, requestKasbon } from '@erp/services/hr';
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

export async function fetchKasbonPage(status?: string, employeeId?: string, page = 1) {
  const session = await getSession();
  if (!session?.user) throw new Error('Unauthenticated');
  const user = session.user as Record<string, unknown>;
  const tenantId = String(user.tenantId ?? 'default');
  const userId = String(user.id ?? '');

  const scope = await authorizedLocationIdsForTenant(userId, 'hr.payroll.read', tenantId);
  if (!scope.global && scope.locationIds.length === 0) return null;

  const ctx: AuditContext = { tenantId, userId, locationId: String(user.locationId ?? '') };

  const result = await listKasbon(
    {
      status: status || undefined,
      employeeId: employeeId || undefined,
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

export async function requestKasbonAction(employeeId: string, amount: number, reason: string) {
  const ctx = await getCtx();
  if (!ctx) return { error: 'Unauthenticated' };
  const t = await getTranslations('hr.kasbon');

  const result = await requestKasbon({ employeeId, amount, reason }, ctx);
  if (!result.ok) return { error: result.error.message };

  revalidatePath('/hr/kasbon');
  return { ok: true, message: t('requestSuccess') };
}

export async function approveKasbonAction(kasbonId: string) {
  const ctx = await getCtx();
  if (!ctx) return { error: 'Unauthenticated' };
  const t = await getTranslations('hr.kasbon');

  const [setting] = await db
    .select({ value: cmsSettings.value })
    .from(cmsSettings)
    .where(and(eq(cmsSettings.tenantId, ctx.tenantId), eq(cmsSettings.key, 'kasbon.accounts')));

  const accounts = (setting?.value as Record<string, string> | null) ?? {};
  const accountIdCash = accounts.cash || '';
  const accountIdKasbon = accounts.kasbon || '';

  if (!accountIdCash || !accountIdKasbon) {
    return { error: t('accountsNotConfigured') };
  }

  const result = await approveKasbon(kasbonId, accountIdCash, accountIdKasbon, ctx);
  if (!result.ok) return { error: result.error.message };

  revalidatePath('/hr/kasbon');
  return { ok: true, message: t('approveSuccess') };
}

export async function rejectKasbonAction(kasbonId: string, reason: string) {
  const ctx = await getCtx();
  if (!ctx) return { error: 'Unauthenticated' };
  const t = await getTranslations('hr.kasbon');

  const result = await rejectKasbon(kasbonId, reason, ctx);
  if (!result.ok) return { error: result.error.message };

  revalidatePath('/hr/kasbon');
  return { ok: true, message: t('rejectSuccess') };
}
