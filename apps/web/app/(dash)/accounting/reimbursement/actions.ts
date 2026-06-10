'use server';

import { getSession } from '@/lib/auth';
import { authorizedLocationIdsForTenant, requirePermissionAtLocation } from '@/lib/authz';
import { and, db, desc, eq, inArray } from '@erp/db';
import { reimbursementRequests } from '@erp/db/schema/accounting';
import { auditLog } from '@erp/db/schema/audit';
import { locations, users } from '@erp/db/schema/auth';
import type { LocaleString } from '@erp/shared/types';
import { getLocale } from 'next-intl/server';

export interface ReimbursementItem {
  id: string;
  requesterId: string;
  requesterName: string;
  locationId: string;
  locationName: string;
  amount: string;
  category: string;
  description: string;
  attachmentUrl: string | null;
  attachmentName: string | null;
  status: string;
  approvedBy: string | null;
  approverName: string | null;
  approvedAt: Date | null;
  disbursedAt: Date | null;
  rejectionReason: string | null;
  createdAt: Date;
}

export interface LocationItem {
  id: string;
  name: string;
}

export interface ReimbursementPageResult {
  items: ReimbursementItem[];
  total: number;
}

export async function fetchReimbursements(
  tenantIdRaw?: string,
  statusFilter?: string,
  pagination?: { limit?: number; offset?: number },
): Promise<ReimbursementPageResult> {
  const session = await getSession();
  if (!session?.user) return { items: [], total: 0 };
  const user = session.user as Record<string, unknown>;
  const tenantId = String(user.tenantId ?? 'default');
  const userId = String(user.id ?? '');

  const conditions = [eq(reimbursementRequests.tenantId, tenantId)];
  if (statusFilter && statusFilter !== 'all') {
    conditions.push(eq(reimbursementRequests.status, statusFilter));
  }
  const locationScope = await authorizedLocationIdsForTenant(
    userId,
    'accounting.reimbursement.view',
    tenantId,
  );
  if (!locationScope.global && locationScope.locationIds.length > 0) {
    conditions.push(inArray(reimbursementRequests.locationId, locationScope.locationIds));
  } else if (!locationScope.global) {
    conditions.push(eq(reimbursementRequests.requesterId, userId));
  }

  const { count } = await import('@erp/db');
  const where = and(...conditions);
  const [countRow] = await db.select({ c: count() }).from(reimbursementRequests).where(where);
  const total = Number(countRow?.c ?? 0);

  const limit = pagination?.limit ?? 20;
  const offset = pagination?.offset ?? 0;

  const rows = await db
    .select({
      id: reimbursementRequests.id,
      requesterId: reimbursementRequests.requesterId,
      locationId: reimbursementRequests.locationId,
      amount: reimbursementRequests.amount,
      category: reimbursementRequests.category,
      description: reimbursementRequests.description,
      attachmentUrl: reimbursementRequests.attachmentUrl,
      attachmentName: reimbursementRequests.attachmentName,
      status: reimbursementRequests.status,
      approvedBy: reimbursementRequests.approvedBy,
      approvedAt: reimbursementRequests.approvedAt,
      disbursedAt: reimbursementRequests.disbursedAt,
      rejectionReason: reimbursementRequests.rejectionReason,
      createdAt: reimbursementRequests.createdAt,
    })
    .from(reimbursementRequests)
    .where(where)
    .orderBy(desc(reimbursementRequests.createdAt))
    .limit(limit)
    .offset(offset);

  const userIds = [
    ...new Set(
      rows.flatMap((r) => [r.requesterId, r.approvedBy]).filter((id): id is string => id !== null),
    ),
  ];
  // Tenant-scoped user + location lookups
  const userRows =
    userIds.length > 0
      ? await db
          .select({ id: users.id, displayName: users.displayName })
          .from(users)
          .where(eq(users.tenantId, tenantId))
      : [];
  const userMap = new Map(userRows.map((u) => [u.id, u.displayName]));

  const locIds = [...new Set(rows.map((r) => r.locationId))];
  const locRows =
    locIds.length > 0
      ? await db
          .select({ id: locations.id, name: locations.name, code: locations.code })
          .from(locations)
          .where(eq(locations.tenantId, tenantId))
      : [];
  const locale = (await getLocale().catch(() => 'id')) as 'id' | 'en' | 'zh';
  const locMap = new Map(
    locRows.map((l) => [l.id, { name: l.name as LocaleString, code: l.code }]),
  );
  function pickLocName(loc: { name: LocaleString; code: string } | undefined, fallback: string) {
    if (!loc) return fallback;
    return loc.name[locale] ?? loc.name.id ?? loc.name.en ?? loc.name.zh ?? loc.code ?? fallback;
  }

  return {
    items: rows.map((r) => ({
      id: r.id,
      requesterId: r.requesterId,
      requesterName: userMap.get(r.requesterId) ?? r.requesterId,
      locationId: r.locationId,
      locationName: pickLocName(locMap.get(r.locationId), r.locationId),
      amount: r.amount.toString(),
      category: r.category,
      description: r.description,
      attachmentUrl: r.attachmentUrl,
      attachmentName: r.attachmentName,
      status: r.status,
      approvedBy: r.approvedBy,
      approverName: r.approvedBy ? (userMap.get(r.approvedBy) ?? null) : null,
      approvedAt: r.approvedAt,
      disbursedAt: r.disbursedAt,
      rejectionReason: r.rejectionReason,
      createdAt: r.createdAt ?? new Date(0),
    })),
    total,
  };
}

export async function fetchLocations(tenantIdRaw?: string): Promise<LocationItem[]> {
  const session = await getSession();
  if (!session?.user) return [];
  const tenantId = String((session.user as Record<string, unknown>).tenantId ?? 'default');
  const userId = String((session.user as Record<string, unknown>).id ?? '');
  const locationScope = await authorizedLocationIdsForTenant(
    userId,
    'accounting.reimbursement.create',
    tenantId,
  );
  if (!locationScope.global && locationScope.locationIds.length === 0) return [];

  const rows = await db
    .select({ id: locations.id, name: locations.name, code: locations.code })
    .from(locations)
    .where(
      and(
        eq(locations.tenantId, tenantId),
        ...(locationScope.global ? [] : [inArray(locations.id, locationScope.locationIds)]),
      ),
    );
  const locale = (await getLocale().catch(() => 'id')) as 'id' | 'en' | 'zh';
  return rows.map((r) => {
    const name = r.name as LocaleString;
    const label = name?.[locale] ?? name?.id ?? name?.en ?? name?.zh ?? r.code;
    return { id: r.id, name: label };
  });
}

export async function createReimbursement(
  data: {
    locationId: string;
    amount: number;
    category: string;
    description: string;
    attachmentUrl?: string;
    attachmentName?: string;
  },
  tenantIdRaw?: string,
  userIdRaw?: string,
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: 'Unauthenticated' };
  const tenantId = String((session.user as Record<string, unknown>).tenantId ?? 'default');
  const userId = String((session.user as Record<string, unknown>).id ?? '');

  try {
    const locationAllowed = await requirePermissionAtLocation(
      userId,
      'accounting.reimbursement.create',
      data.locationId,
    );
    if (!locationAllowed) return { success: false, error: 'Unauthorized' };

    const [locationRow] = await db
      .select({ id: locations.id })
      .from(locations)
      .where(and(eq(locations.id, data.locationId), eq(locations.tenantId, tenantId)))
      .limit(1);
    if (!locationRow) return { success: false, error: 'Unauthorized' };

    const id = crypto.randomUUID();
    await db.insert(reimbursementRequests).values({
      id,
      tenantId,
      requesterId: userId,
      locationId: data.locationId,
      amount: BigInt(data.amount),
      category: data.category,
      description: data.description,
      attachmentUrl: data.attachmentUrl ?? null,
      attachmentName: data.attachmentName ?? null,
      status: 'draft',
      createdBy: userId,
      updatedBy: userId,
    });

    await db.insert(auditLog).values({
      id: crypto.randomUUID(),
      tenantId,
      userId,
      action: 'create',
      entityType: 'reimbursement_request',
      entityId: id,
      after: {
        locationId: data.locationId,
        amount: Number(data.amount),
        category: data.category,
        description: data.description,
        status: 'draft',
      },
    });

    return { success: true };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

export async function submitReimbursement(
  id: string,
  tenantIdRaw?: string,
  userIdRaw?: string,
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: 'Unauthenticated' };
  const tenantId = String((session.user as Record<string, unknown>).tenantId ?? 'default');
  const userId = String((session.user as Record<string, unknown>).id ?? '');

  try {
    const rows = await db
      .select()
      .from(reimbursementRequests)
      .where(and(eq(reimbursementRequests.id, id), eq(reimbursementRequests.tenantId, tenantId)))
      .limit(1);
    if (!rows[0]) return { success: false, error: 'Pengajuan tidak ditemukan.' };
    if (rows[0].status !== 'draft') {
      return { success: false, error: 'Hanya pengajuan berstatus Draf yang dapat diajukan.' };
    }
    if (rows[0].requesterId !== userId) {
      return { success: false, error: 'Unauthorized' };
    }
    await db
      .update(reimbursementRequests)
      .set({ status: 'submitted', updatedBy: userId, updatedAt: new Date() })
      .where(and(eq(reimbursementRequests.id, id), eq(reimbursementRequests.tenantId, tenantId)));

    await db.insert(auditLog).values({
      id: crypto.randomUUID(),
      tenantId,
      userId,
      action: 'update',
      entityType: 'reimbursement_request',
      entityId: id,
      before: { status: 'draft' },
      after: { status: 'submitted' },
    });

    return { success: true };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

export async function approveReimbursement(
  id: string,
  tenantIdRaw?: string,
  userIdRaw?: string,
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: 'Unauthenticated' };
  const tenantId = String((session.user as Record<string, unknown>).tenantId ?? 'default');
  const userId = String((session.user as Record<string, unknown>).id ?? '');

  try {
    const rows = await db
      .select()
      .from(reimbursementRequests)
      .where(and(eq(reimbursementRequests.id, id), eq(reimbursementRequests.tenantId, tenantId)))
      .limit(1);
    if (!rows[0]) return { success: false, error: 'Pengajuan tidak ditemukan.' };
    if (rows[0].status !== 'submitted') {
      return { success: false, error: 'Hanya pengajuan berstatus Diajukan yang dapat disetujui.' };
    }
    const allowed = await requirePermissionAtLocation(
      userId,
      'accounting.reimbursement.approve',
      rows[0].locationId,
    );
    if (!allowed) return { success: false, error: 'Unauthorized' };

    await db
      .update(reimbursementRequests)
      .set({
        status: 'approved',
        approvedBy: userId,
        approvedAt: new Date(),
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(and(eq(reimbursementRequests.id, id), eq(reimbursementRequests.tenantId, tenantId)));

    await db.insert(auditLog).values({
      id: crypto.randomUUID(),
      tenantId,
      userId,
      action: 'update',
      entityType: 'reimbursement_request',
      entityId: id,
      before: { status: 'submitted' },
      after: { status: 'approved' },
    });

    return { success: true };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

export async function rejectReimbursement(
  id: string,
  reason: string,
  tenantIdRaw?: string,
  userIdRaw?: string,
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: 'Unauthenticated' };
  const tenantId = String((session.user as Record<string, unknown>).tenantId ?? 'default');
  const userId = String((session.user as Record<string, unknown>).id ?? '');

  try {
    const rows = await db
      .select()
      .from(reimbursementRequests)
      .where(and(eq(reimbursementRequests.id, id), eq(reimbursementRequests.tenantId, tenantId)))
      .limit(1);
    if (!rows[0]) return { success: false, error: 'Pengajuan tidak ditemukan.' };
    if (rows[0].status !== 'submitted') {
      return { success: false, error: 'Hanya pengajuan berstatus Diajukan yang dapat ditolak.' };
    }
    const allowed = await requirePermissionAtLocation(
      userId,
      'accounting.reimbursement.approve',
      rows[0].locationId,
    );
    if (!allowed) return { success: false, error: 'Unauthorized' };

    await db
      .update(reimbursementRequests)
      .set({
        status: 'rejected',
        rejectionReason: reason,
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(and(eq(reimbursementRequests.id, id), eq(reimbursementRequests.tenantId, tenantId)));

    await db.insert(auditLog).values({
      id: crypto.randomUUID(),
      tenantId,
      userId,
      action: 'update',
      entityType: 'reimbursement_request',
      entityId: id,
      before: { status: 'submitted' },
      after: { status: 'rejected', rejectionReason: reason },
    });

    return { success: true };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

export async function disburseReimbursement(
  id: string,
  tenantIdRaw?: string,
  userIdRaw?: string,
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: 'Unauthenticated' };
  const tenantId = String((session.user as Record<string, unknown>).tenantId ?? 'default');
  const userId = String((session.user as Record<string, unknown>).id ?? '');

  try {
    const rows = await db
      .select()
      .from(reimbursementRequests)
      .where(and(eq(reimbursementRequests.id, id), eq(reimbursementRequests.tenantId, tenantId)))
      .limit(1);
    if (!rows[0]) return { success: false, error: 'Pengajuan tidak ditemukan.' };
    if (rows[0].status !== 'approved') {
      return { success: false, error: 'Hanya pengajuan berstatus Disetujui yang dapat dicairkan.' };
    }
    const allowed = await requirePermissionAtLocation(
      userId,
      'accounting.reimbursement.disburse',
      rows[0].locationId,
    );
    if (!allowed) return { success: false, error: 'Unauthorized' };

    await db
      .update(reimbursementRequests)
      .set({
        status: 'disbursed',
        disbursedAt: new Date(),
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(and(eq(reimbursementRequests.id, id), eq(reimbursementRequests.tenantId, tenantId)));

    await db.insert(auditLog).values({
      id: crypto.randomUUID(),
      tenantId,
      userId,
      action: 'update',
      entityType: 'reimbursement_request',
      entityId: id,
      before: { status: 'approved' },
      after: { status: 'disbursed' },
    });

    return { success: true };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}
