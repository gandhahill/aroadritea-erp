/**
 * Attendance server actions — SD §21.8 §Attendance SOP
 */

'use server';

import { getSession } from '@/lib/auth';
import { forgiveLate, listAttendance } from '@erp/services/hr';
import type { ListAttendanceInput } from '@erp/services/hr';
import type { AuditContext } from '@erp/shared/types';
import { revalidatePath } from 'next/cache';

export async function serverListAttendance(input: ListAttendanceInput) {
  const session = await getSession();
  if (!session?.user?.id) {
    return { ok: false as const, error: { code: 'UNAUTHENTICATED', message: 'Session expired' } };
  }
  const user = session.user as Record<string, unknown>;
  const ctx: AuditContext = {
    userId: String(user.id),
    tenantId: String(user.tenantId ?? 'default'),
    locationId: String(user.locationId ?? ''),
  };
  return listAttendance(input, ctx);
}

export async function forgiveLateAction(
  attendanceId: string,
  reason: string,
): Promise<{ ok: boolean; error?: string }> {
  const session = await getSession();
  if (!session?.user) return { ok: false, error: 'Unauthenticated' };
  const user = session.user as Record<string, unknown>;
  const ctx: AuditContext = {
    userId: String(user.id ?? ''),
    tenantId: String(user.tenantId ?? 'default'),
    locationId: String(user.locationId ?? ''),
  };
  const result = await forgiveLate({ attendanceId, reason }, ctx);
  if (!result.ok) {
    return {
      ok: false,
      error: result.error?.message ?? 'Gagal memberi dispensasi keterlambatan.',
    };
  }
  revalidatePath('/hr/attendance');
  return { ok: true };
}
