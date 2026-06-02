/**
 * Disciplinary Actions Page — SD §21.8 §Surat Peringatan
 *
 * Server component: loads initial data, renders client component.
 */

import { getSession } from '@/lib/auth';
import { authorizedLocationIdsForTenant } from '@/lib/authz';
import { and, db, eq, inArray, isNull } from '@erp/db';
import { users } from '@erp/db/schema/auth';
import { disciplinaryActions, employees } from '@erp/db/schema/hr';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { DisciplinaryClient } from './disciplinary-client';

export const metadata: Metadata = { title: 'Disciplinary Actions' };

export default async function DisciplinaryPage() {
  const session = await getSession();
  if (!session?.user) redirect('/login');

  const user = session.user as Record<string, unknown>;
  const userId = String(user.id ?? '');
  const tenantId = String(user.tenantId ?? 'default');
  const scope = await authorizedLocationIdsForTenant(userId, 'hr.disciplinary.read', tenantId);
  if (!scope.global && scope.locationIds.length === 0) redirect('/dashboard');

  const scopedDisciplinaryConds = [
    eq(disciplinaryActions.tenantId, tenantId),
    isNull(disciplinaryActions.deletedAt),
  ];
  if (!scope.global) {
    scopedDisciplinaryConds.push(inArray(disciplinaryActions.locationId, scope.locationIds));
  }

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
    .where(and(...scopedDisciplinaryConds))
    .orderBy(disciplinaryActions.createdAt);

  // Load active employees for the dropdown — also used to resolve names.
  const employeeConds = [eq(employees.tenantId, tenantId), isNull(employees.deletedAt)];
  if (!scope.global) {
    employeeConds.push(inArray(employees.locationId, scope.locationIds));
  }

  const empRows = await db
    .select({ id: employees.id, name: employees.name })
    .from(employees)
    .where(and(...employeeConds));

  // Resolve issuer (user) names — tenant-scoped to prevent cross-tenant leaks.
  const issuerIds = [...new Set(rows.map((row) => row.issuedBy).filter(Boolean))] as string[];
  const userRows = issuerIds.length
    ? await db
        .select({ id: users.id, displayName: users.displayName })
        .from(users)
        .where(and(eq(users.tenantId, tenantId), inArray(users.id, issuerIds)))
    : [];

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
