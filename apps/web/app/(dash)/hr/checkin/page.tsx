/**
 * HR Check-In Page — SD §21.8 §Attendance
 *
 * Mobile-friendly check-in page (PWA home-screen bookmark).
 * Shows GPS location, shift, employee selection, then big CHECK IN button.
 */

import { getSession } from '@/lib/auth';
import { and, asc, db, eq, isNull } from '@erp/db';
import { employees, shiftDefinitions } from '@erp/db/schema/hr';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { CheckInClient } from './check-in-client';

export const metadata: Metadata = { title: 'Check In | Aroadri ERP' };

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

  const shiftRows = await db
    .select({
      id: shiftDefinitions.id,
      name: shiftDefinitions.name,
      code: shiftDefinitions.code,
      startTime: shiftDefinitions.startTime,
      endTime: shiftDefinitions.endTime,
    })
    .from(shiftDefinitions)
    .where(
      and(
        eq(shiftDefinitions.tenantId, tenantId),
        eq(shiftDefinitions.isActive, true),
        isNull(shiftDefinitions.deletedAt),
      ),
    )
    .orderBy(asc(shiftDefinitions.startTime));

  const shifts = shiftRows.map((shift) => ({
    id: shift.id,
    label: shift.name || shift.code,
    time: `${shift.startTime} - ${shift.endTime}`,
  }));

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
