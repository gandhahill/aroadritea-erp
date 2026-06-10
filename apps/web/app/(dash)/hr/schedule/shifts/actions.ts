'use server';

import { getSession } from '@/lib/auth';
import { and, asc, db, desc, eq, ilike, isNull, or, sql } from '@erp/db';
import { locations } from '@erp/db/schema/auth';
import { shiftAssignments, shiftDefinitions } from '@erp/db/schema/hr';
import { can } from '@erp/services/iam';
import { generateId } from '@erp/shared/id';
import { revalidatePath } from 'next/cache';

export interface ShiftDefinitionData {
  id: string;
  code: string;
  name: string;
  startTime: string;
  endTime: string;
  breakStart: string | null;
  breakEnd: string | null;
  isActive: boolean;
  locationId: string;
  overrides?: {
    dayOfWeek?: Record<
      number,
      { startTime: string; endTime: string; breakStart?: string | null; breakEnd?: string | null }
    >;
    date?: Record<
      string,
      { startTime: string; endTime: string; breakStart?: string | null; breakEnd?: string | null }
    >;
  } | null;
}

export async function fetchShiftDefinitions(locationId: string) {
  const session = await getSession();
  if (!session) return [];
  const tenantId = String(session.user.tenantId ?? 'default');
  const userId = session.user.id as string;

  const allowed = await can(userId, 'hr.manage_attendance');
  if (!allowed) return [];

  const shifts = await db
    .select({
      id: shiftDefinitions.id,
      code: shiftDefinitions.code,
      name: shiftDefinitions.name,
      startTime: shiftDefinitions.startTime,
      endTime: shiftDefinitions.endTime,
      breakStart: shiftDefinitions.breakStart,
      breakEnd: shiftDefinitions.breakEnd,
      isActive: shiftDefinitions.isActive,
      locationId: shiftDefinitions.locationId,
      overrides: shiftDefinitions.overrides,
    })
    .from(shiftDefinitions)
    .where(
      and(
        eq(shiftDefinitions.tenantId, tenantId),
        eq(shiftDefinitions.locationId, locationId),
        isNull(shiftDefinitions.deletedAt),
      ),
    )
    .orderBy(asc(shiftDefinitions.startTime), asc(shiftDefinitions.code));

  return shifts;
}

export async function upsertShiftDefinition(
  data: Omit<ShiftDefinitionData, 'id'> & { id?: string },
) {
  const session = await getSession();
  if (!session) return { ok: false, error: 'Unauthorized' };
  const tenantId = String(session.user.tenantId ?? 'default');
  const userId = session.user.id as string;

  const allowed = await can(userId, 'hr.manage_attendance');
  if (!allowed) return { ok: false, error: 'Forbidden' };

  if (!data.code || !data.name || !data.startTime || !data.endTime || !data.locationId) {
    return { ok: false, error: 'Validation failed' };
  }

  try {
    if (data.id) {
      await db
        .update(shiftDefinitions)
        .set({
          code: data.code,
          name: data.name,
          startTime: data.startTime,
          endTime: data.endTime,
          breakStart: data.breakStart || null,
          breakEnd: data.breakEnd || null,
          overrides: data.overrides || {},
          updatedAt: new Date(),
          updatedBy: userId,
        })
        .where(and(eq(shiftDefinitions.id, data.id), eq(shiftDefinitions.tenantId, tenantId)));
    } else {
      await db.insert(shiftDefinitions).values({
        id: generateId(),
        tenantId,
        locationId: data.locationId,
        code: data.code,
        name: data.name,
        startTime: data.startTime,
        endTime: data.endTime,
        breakStart: data.breakStart || null,
        breakEnd: data.breakEnd || null,
        overrides: data.overrides || {},
        isActive: true,
        createdBy: userId,
        updatedBy: userId,
      });
    }
    return { ok: true };
  } catch (error: any) {
    console.error('Error saving shift definition:', error);
    if (error.code === '23505') {
      return { ok: false, error: 'Shift code already exists for this location.' };
    }
    return { ok: false, error: 'Save failed' };
  }
}

export async function toggleShiftActive(id: string, isActive: boolean) {
  const session = await getSession();
  if (!session) return { ok: false, error: 'Unauthorized' };
  const tenantId = String(session.user.tenantId ?? 'default');
  const userId = session.user.id as string;

  const allowed = await can(userId, 'hr.manage_attendance');
  if (!allowed) return { ok: false, error: 'Forbidden' };

  try {
    await db
      .update(shiftDefinitions)
      .set({ isActive, updatedAt: new Date(), updatedBy: userId })
      .where(and(eq(shiftDefinitions.id, id), eq(shiftDefinitions.tenantId, tenantId)));
    return { ok: true };
  } catch (error) {
    console.error('Error toggling shift active:', error);
    return { ok: false, error: 'Update failed' };
  }
}

export async function deleteShiftDefinition(id: string) {
  const session = await getSession();
  if (!session) return { ok: false, error: 'Unauthorized' };
  const tenantId = String(session.user.tenantId ?? 'default');
  const userId = session.user.id as string;

  const allowed = await can(userId, 'hr.manage_attendance');
  if (!allowed) return { ok: false, error: 'Forbidden' };

  try {
    // Check if shift has future assignments (prevent deleting shifts with upcoming schedules)
    const todayStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());

    const [futureUsage] = await db
      .select({ count: sql<number>`cast(count(*) as int)` })
      .from(shiftAssignments)
      .where(
        and(
          eq(shiftAssignments.tenantId, tenantId),
          eq(shiftAssignments.shiftDefinitionId, id),
          sql`${shiftAssignments.workDate} >= ${todayStr}`,
          isNull(shiftAssignments.deletedAt),
        ),
      );

    if ((futureUsage?.count ?? 0) > 0) {
      return {
        ok: false,
        error: 'SHIFT_HAS_ASSIGNMENTS',
        count: futureUsage?.count ?? 0,
      };
    }

    // Soft delete
    await db
      .update(shiftDefinitions)
      .set({ deletedAt: new Date(), updatedAt: new Date(), updatedBy: userId })
      .where(and(eq(shiftDefinitions.id, id), eq(shiftDefinitions.tenantId, tenantId)));

    revalidatePath('/hr/schedule/shifts');
    return { ok: true };
  } catch (error) {
    console.error('Error deleting shift definition:', error);
    return { ok: false, error: 'Delete failed' };
  }
}
