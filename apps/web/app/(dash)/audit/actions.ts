'use server';

import { getSession } from '@/lib/auth';
import { and, db, desc, eq, gte, ilike, lte, sql } from '@erp/db';
import { auditLog } from '@erp/db/schema/audit';
import { users } from '@erp/db/schema/auth';
import { requirePermission } from '@erp/services/iam';
import { redirect } from 'next/navigation';

export interface AuditTrailRow {
  id: string;
  createdAt: string;
  userId: string;
  userLabel: string;
  action: string;
  entityType: string;
  entityId: string;
  before: unknown;
  after: unknown;
  metadata: unknown;
}

export interface AuditTrailFilters {
  entityType?: string;
  action?: string;
  actor?: string;
  from?: string;
  to?: string;
  page?: string;
  pageSize?: string;
}

export interface AuditTrailPageData {
  rows: AuditTrailRow[];
  total: number;
  page: number;
  pageSize: number;
}

export async function fetchAuditTrail(filters: AuditTrailFilters): Promise<AuditTrailPageData> {
  const session = await getSession();
  if (!session) redirect('/login');

  const user = session.user as Record<string, unknown>;
  const tenantId = String(user.tenantId ?? 'default');
  const userId = String(user.id ?? '');
  const permission = await requirePermission(userId, 'audit.view');

  const parsedPageSize = Number.parseInt(filters.pageSize ?? '50', 10);
  const pageSize = Math.max(
    1,
    Math.min(100, Number.isFinite(parsedPageSize) ? parsedPageSize : 50),
  );

  if (!permission.ok) return { rows: [], total: 0, page: 1, pageSize };
  const parsedPage = Number.parseInt(filters.page ?? '1', 10);
  const currentPage = Math.max(1, Number.isFinite(parsedPage) ? parsedPage : 1);

  const conditions = [eq(auditLog.tenantId, tenantId)];

  if (filters.entityType) conditions.push(eq(auditLog.entityType, filters.entityType));
  if (filters.action) conditions.push(eq(auditLog.action, filters.action));
  if (filters.actor) conditions.push(eq(auditLog.userId, filters.actor));
  if (filters.from)
    conditions.push(gte(auditLog.createdAt, new Date(`${filters.from}T00:00:00+07:00`)));
  if (filters.to) {
    const toDate = new Date(`${filters.to}T00:00:00+07:00`);
    toDate.setDate(toDate.getDate() + 1);
    conditions.push(lte(auditLog.createdAt, toDate));
  }
  const whereClause = and(...conditions);

  const [{ count = 0 } = { count: 0 }] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(auditLog)
    .where(whereClause);

  const rows = await db
    .select({
      id: auditLog.id,
      createdAt: auditLog.createdAt,
      userId: auditLog.userId,
      userName: users.displayName,
      userEmail: users.email,
      action: auditLog.action,
      entityType: auditLog.entityType,
      entityId: auditLog.entityId,
      before: auditLog.before,
      after: auditLog.after,
      metadata: auditLog.metadata,
    })
    .from(auditLog)
    .leftJoin(users, and(eq(users.id, auditLog.userId), eq(users.tenantId, tenantId)))
    .where(whereClause)
    .orderBy(desc(auditLog.createdAt))
    .limit(pageSize)
    .offset((currentPage - 1) * pageSize);

  return {
    rows: rows.map((row) => ({
      id: row.id,
      createdAt: row.createdAt.toISOString(),
      userId: row.userId,
      // Audit log keeps the raw user ID for forensic traceability, but the
      // human-facing label prefers display name → email → "User dihapus".
      // Showing the UUID to operators is unhelpful and reveals internal
      // identifiers unnecessarily.
      userLabel: row.userName
        ? `${row.userName}${row.userEmail ? ` (${row.userEmail})` : ''}`
        : (row.userEmail ?? 'User dihapus'),
      action: row.action,
      entityType: row.entityType,
      entityId: row.entityId,
      before: row.before,
      after: row.after,
      metadata: row.metadata,
    })),
    total: count,
    page: currentPage,
    pageSize,
  };
}
