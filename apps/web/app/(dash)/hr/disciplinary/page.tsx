/**
 * Disciplinary Actions Page — SD §21.8 §Surat Peringatan
 *
 * Server component: loads initial data, renders client component.
 */

import { getSession } from '@/lib/auth';
import { db, eq } from '@erp/db';
import { users } from '@erp/db/schema/auth';
import { disciplinaryActions, employees } from '@erp/db/schema/hr';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { DisciplinaryClient } from './disciplinary-client';

export const metadata: Metadata = { title: 'Disciplinary Actions | Aroadri ERP' };

export default async function DisciplinaryPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const user = session.user as Record<string, unknown>;
  const tenantId = String(user.tenantId ?? 'default');

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

  // Load active employees for the dropdown — also used to resolve names.
  const empRows = await db
    .select({ id: employees.id, name: employees.name })
    .from(employees)
    .where(eq(employees.tenantId, tenantId));

  // Resolve issuer (user) names — tenant-scoped to prevent cross-tenant leaks.
  const userRows = await db
    .select({ id: users.id, displayName: users.displayName })
    .from(users)
    .where(eq(users.tenantId, tenantId));

  const empMap = new Map(empRows.map((e) => [e.id, String(e.name ?? e.id)]));
  const userMap = new Map(userRows.map((u) => [u.id, u.displayName ?? '']));

  const enriched = rows.map((r) => ({
    id: r.id,
    employeeId: r.employeeId,
    employeeName: empMap.get(r.employeeId) ?? null,
    level: r.level,
    reason: r.reason,
    incidentDate:
      r.incidentDate instanceof Date ? r.incidentDate.toISOString() : String(r.incidentDate ?? ''),
    status: r.status,
    issuedBy: r.issuedBy,
    issuedByName: userMap.get(r.issuedBy) || null,
    attachmentUrl: r.attachmentUrl,
  }));

  const employeeOptions = empRows.map((e) => ({
    value: e.id,
    label: String(e.name ?? e.id),
  }));

  return <DisciplinaryClient initialActions={enriched} employees={employeeOptions} />;
}
