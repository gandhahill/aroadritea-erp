/**
 * HR Check-In Page — SD §21.8 §Attendance
 *
 * Mobile-friendly check-in page (PWA home-screen bookmark).
 * Shows GPS location, shift, employee selection, then big CHECK IN button.
 */

import { getSession } from '@/lib/auth';
import { and, asc, db, eq, gte, inArray, isNull, lte } from '@erp/db';
import { locations } from '@erp/db/schema/auth';
import {
  attendance,
  employeeFaceTemplates,
  employees,
  shiftAssignments,
  shiftDefinitions,
} from '@erp/db/schema/hr';
import { getLocationGpsConfig, hasValidFaceTemplate, resolveShiftTime } from '@erp/services/hr';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { CheckInClient } from './check-in-client';

export const metadata: Metadata = { title: 'Check In' };

export default async function CheckInPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const user = session.user as Record<string, unknown>;
  const userId = String(user.id ?? '');
  const tenantId = String(user.tenantId ?? 'default');
  let locationId = String(user.locationId ?? '');
  const sessionEmployeeId = String(user.employeeId ?? '');
  const userEmail = String(user.email ?? '')
    .trim()
    .toLowerCase();

  let employeeId = sessionEmployeeId;
  if (userEmail && (!employeeId || !locationId)) {
    const { resolveEmployeeForUser } = await import('@erp/services/hr');
    const employee = await resolveEmployeeForUser(tenantId, userId);
    employeeId = employee?.id ?? '';
    locationId = locationId || employee?.locationId || '';
  }

  const activeLocationId = locationId;
  let assignedShiftIds: string[] = [];

  if (employeeId) {
    const todayStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());

    const assignments = await db
      .select({
        shiftDefinitionId: shiftAssignments.shiftDefinitionId,
      })
      .from(shiftAssignments)
      .where(
        and(
          eq(shiftAssignments.tenantId, tenantId),
          eq(shiftAssignments.employeeId, employeeId),
          eq(shiftAssignments.workDate, todayStr),
          eq(shiftAssignments.kind, 'shift'),
          isNull(shiftAssignments.deletedAt),
        ),
      );

    if (assignments.length > 0) {
      assignedShiftIds = assignments
        .map((assignment) => assignment.shiftDefinitionId)
        .filter(Boolean) as string[];
    }
  }

  const shiftRows = await db
    .select({
      id: shiftDefinitions.id,
      name: shiftDefinitions.name,
      code: shiftDefinitions.code,
      startTime: shiftDefinitions.startTime,
      endTime: shiftDefinitions.endTime,
      overrides: shiftDefinitions.overrides,
    })
    .from(shiftDefinitions)
    .where(
      and(
        eq(shiftDefinitions.tenantId, tenantId),
        assignedShiftIds.length > 0
          ? inArray(shiftDefinitions.id, assignedShiftIds)
          : eq(shiftDefinitions.locationId, activeLocationId),
        eq(shiftDefinitions.isActive, true),
        isNull(shiftDefinitions.deletedAt),
      ),
    )
    .orderBy(asc(shiftDefinitions.startTime));

  const now = new Date();
  const shifts = shiftRows.map((shift) => {
    const resolved = resolveShiftTime(shift, now);
    return {
      id: shift.id,
      label: shift.name || shift.code,
      time: `${resolved.startTime} - ${resolved.endTime}`,
    };
  });

  // Fetch location GPS config so the client can show distance feedback
  let locationGps: { lat: number; lng: number; radiusM: number; name: string } | null = null;
  if (activeLocationId) {
    const [gpsConfig, loc] = await Promise.all([
      getLocationGpsConfig(tenantId, activeLocationId),
      db
        .select({
          name: locations.name,
          code: locations.code,
        })
        .from(locations)
        .where(eq(locations.id, activeLocationId))
        .limit(1)
        .then((rows) => rows[0] ?? null),
    ]);

    if (gpsConfig && loc) {
      const nameObj = loc.name as Record<string, string> | null;
      const locName = nameObj?.id ?? nameObj?.en ?? loc.code ?? '';
      locationGps = { ...gpsConfig, name: locName };
    }
  }

  // Check if this employee already checked in today (WIB) and hasn't checked out yet.
  let openAttendance: { id: string; checkInAt: string; shiftCode: string | null } | null = null;
  let hasFaceTemplate = false;
  if (employeeId) {
    const nowUtc = new Date();
    const wibMs = nowUtc.getTime() + 7 * 60 * 60 * 1000;
    const wib = new Date(wibMs);
    const todayStart = new Date(
      Date.UTC(wib.getUTCFullYear(), wib.getUTCMonth(), wib.getUTCDate(), -7),
    );
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000 - 1);

    const [open] = await db
      .select({
        id: attendance.id,
        checkInAt: attendance.checkInAt,
        shiftCode: attendance.shiftDefinitionCode,
      })
      .from(attendance)
      .where(
        and(
          eq(attendance.tenantId, tenantId),
          eq(attendance.employeeId, employeeId),
          isNull(attendance.checkOutAt),
          isNull(attendance.deletedAt),
          gte(attendance.checkInAt, todayStart),
          lte(attendance.checkInAt, todayEnd),
        ),
      )
      .limit(1);

    if (open) {
      openAttendance = {
        id: open.id,
        checkInAt: open.checkInAt?.toISOString() ?? '',
        shiftCode: open.shiftCode,
      };
    }

    hasFaceTemplate = await hasValidFaceTemplate(tenantId, employeeId);
  }

  return (
    <CheckInClient
      userId={userId}
      tenantId={tenantId}
      locationId={locationId}
      employeeId={employeeId}
      shifts={shifts}
      locationGps={locationGps}
      openAttendance={openAttendance}
      faceVerification={{ hasTemplate: hasFaceTemplate }}
    />
  );
}
