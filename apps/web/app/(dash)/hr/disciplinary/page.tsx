/**
 * Disciplinary Actions Page — SD §21.8 §Surat Peringatan
 *
 * Server component: loads initial data, renders client component.
 */

import { getSession } from '@/lib/auth';
import { db, eq } from '@erp/db';
import { disciplinaryActions, employees } from '@erp/db/schema/hr';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { DisciplinaryClient } from './disciplinary-client';

export const metadata: Metadata = { title: 'Surat Peringatan' };

export default async function DisciplinaryPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const user = session.user as Record<string, unknown>;
  const tenantId = String(user.tenantId ?? 'default');
  const locationId = String(user.locationId ?? '');

  // Load all disciplinary actions for this tenant
  const rows = await db
    .select({
      id: disciplinaryActions.id,
      employeeId: disciplinaryActions.employeeId,
      level: disciplinaryActions.level,
      reason: disciplinaryActions.reason,
      incidentDate: disciplinaryActions.incidentDate,
      status: disciplinaryActions.status,
      issuedBy: disciplinaryActions.issuedBy,
      attachmentUrl: disciplinaryActions.attachmentUrl,
    })
    .from(disciplinaryActions)
    .where(eq(disciplinaryActions.tenantId, tenantId))
    .orderBy(disciplinaryActions.createdAt);

  // Load active employees for the dropdown
  const empRows = await db
    .select({ id: employees.id, name: employees.name })
    .from(employees)
    .where(eq(employees.tenantId, tenantId));

  const employeeOptions = empRows.map((e) => ({
    value: e.id,
    label: String(e.name ?? e.id),
  }));

  return (
    <DisciplinaryClient initialActions={rows as unknown as never[]} employees={employeeOptions} />
  );
}
