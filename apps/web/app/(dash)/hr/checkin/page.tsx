/**
 * HR Check-In Page — SD §21.8 §Attendance
 *
 * Mobile-friendly check-in page (PWA home-screen bookmark).
 * Shows GPS location, shift, employee selection, then big CHECK IN button.
 */

import { getSession } from '@/lib/auth';
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
  const locationId = String(user.locationId ?? '');
  const employeeId = String(user.employeeId ?? ''); // employeeId set on user record

  return (
    <CheckInClient
      userId={userId}
      tenantId={tenantId}
      locationId={locationId}
      employeeId={employeeId}
    />
  );
}
