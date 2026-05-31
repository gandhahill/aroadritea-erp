/**
 * HR Check-In Page — SD §21.8 §Attendance
 *
 * Mobile-friendly check-in page (PWA home-screen bookmark).
 * Shows GPS location, shift, employee selection, then big CHECK IN button.
 */

import { getSession } from '@/lib/auth';
import { and, asc, db, eq, isNull } from '@erp/db';
import { employees, shiftAssignments, shiftDefinitions } from '@erp/db/schema/hr';
import { resolveShiftTime } from '@erp/services/hr';
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

  let activeLocationId = locationId;
  if (employeeId) {
    const todayStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());

    const [assignment] = await db
      .select({ locationId: shiftAssignments.locationId })
      .from(shiftAssignments)
      .where(
        and(
          eq(shiftAssignments.tenantId, tenantId),
          eq(shiftAssignments.employeeId, employeeId),
          eq(shiftAssignments.workDate, todayStr),
          eq(shiftAssignments.kind, 'shift'),
        ),
      )
      .limit(1);

    if (assignment?.locationId) {
      activeLocationId = assignment.locationId;
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
        eq(shiftDefinitions.locationId, activeLocationId),
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

  return (
    <CheckInClient
      userId={userId}
      tenantId={tenantId}
      locationId={locationId}
      employeeId={employeeId}
      shifts={shifts}
    />
  );
}
