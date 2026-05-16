'use server';

import { getSession } from '@/lib/auth';
import { setSetting } from '@erp/services/cms';
import { requirePermission } from '@erp/services/iam';
import {
  ATTENDANCE_POLICY_SETTING_KEY,
  DEFAULT_ATTENDANCE_POLICY,
  type AttendancePolicy,
} from '@erp/services/payroll';
import type { AuditContext } from '@erp/shared/types';
import { and, db, eq } from '@erp/db';
import { cmsSettings } from '@erp/db/schema/cms';
import { revalidatePath } from 'next/cache';

type ActionState = { ok: boolean; message?: string };

interface AttendancePolicyForUi {
  latePenalty: number;
  freeLatesPerMonth: number;
  absentPenalty: number;
}

export async function fetchAttendancePolicy(): Promise<AttendancePolicyForUi> {
  const session = await getSession();
  const tenantId =
    ((session?.user as Record<string, unknown> | undefined)?.tenantId as string) ?? 'default';
  try {
    const row = await db
      .select({ value: cmsSettings.value })
      .from(cmsSettings)
      .where(
        and(eq(cmsSettings.tenantId, tenantId), eq(cmsSettings.key, ATTENDANCE_POLICY_SETTING_KEY)),
      )
      .limit(1);
    const raw = row[0]?.value as Record<string, unknown> | null | undefined;
    if (!raw) {
      return {
        latePenalty: Number(DEFAULT_ATTENDANCE_POLICY.latePenalty),
        freeLatesPerMonth: DEFAULT_ATTENDANCE_POLICY.freeLatesPerMonth,
        absentPenalty: Number(DEFAULT_ATTENDANCE_POLICY.absentPenalty),
      };
    }
    return {
      latePenalty:
        typeof raw.latePenalty === 'number'
          ? raw.latePenalty
          : Number(DEFAULT_ATTENDANCE_POLICY.latePenalty),
      freeLatesPerMonth:
        typeof raw.freeLatesPerMonth === 'number'
          ? raw.freeLatesPerMonth
          : DEFAULT_ATTENDANCE_POLICY.freeLatesPerMonth,
      absentPenalty:
        typeof raw.absentPenalty === 'number'
          ? raw.absentPenalty
          : Number(DEFAULT_ATTENDANCE_POLICY.absentPenalty),
    };
  } catch {
    return {
      latePenalty: Number(DEFAULT_ATTENDANCE_POLICY.latePenalty),
      freeLatesPerMonth: DEFAULT_ATTENDANCE_POLICY.freeLatesPerMonth,
      absentPenalty: Number(DEFAULT_ATTENDANCE_POLICY.absentPenalty),
    };
  }
}

export async function saveAttendancePolicy(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await getSession();
  if (!session) return { ok: false, message: 'settings.attendance.unauthorized' };
  const user = session.user as Record<string, unknown>;
  const ctx: AuditContext = {
    userId: String(user.id ?? ''),
    tenantId: String(user.tenantId ?? 'default'),
    locationId: String(user.locationId ?? ''),
  };
  const perm = await requirePermission(ctx.userId, 'settings.manage');
  if (!perm.ok) return { ok: false, message: 'settings.attendance.forbidden' };

  const latePenalty = Number(formData.get('latePenalty') ?? 0);
  const freeLatesPerMonth = Number(formData.get('freeLatesPerMonth') ?? 0);
  const absentPenalty = Number(formData.get('absentPenalty') ?? 0);

  if (!Number.isFinite(latePenalty) || latePenalty < 0) {
    return { ok: false, message: 'settings.attendance.invalidLate' };
  }
  if (!Number.isFinite(freeLatesPerMonth) || freeLatesPerMonth < 0) {
    return { ok: false, message: 'settings.attendance.invalidFreeLates' };
  }
  if (!Number.isFinite(absentPenalty) || absentPenalty < 0) {
    return { ok: false, message: 'settings.attendance.invalidAbsent' };
  }

  const policy = { latePenalty, freeLatesPerMonth, absentPenalty };
  const result = await setSetting(ctx.tenantId, ATTENDANCE_POLICY_SETTING_KEY, policy, ctx);
  if (!result.ok) return { ok: false, message: 'settings.attendance.saveFailed' };

  revalidatePath('/settings/attendance');
  return { ok: true, message: 'settings.attendance.saved' };
}
