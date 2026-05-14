'use server';

import { and, db, desc, eq } from '@erp/db';
import { reimbursementRequests } from '@erp/db/schema/accounting';
import { locations, users } from '@erp/db/schema/auth';
import type { LocaleString } from '@erp/shared/types';

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

export async function fetchReimbursements(
  tenantId: string,
  statusFilter?: string,
): Promise<ReimbursementItem[]> {
  const conditions = [eq(reimbursementRequests.tenantId, tenantId)];
  if (statusFilter && statusFilter !== 'all') {
    conditions.push(eq(reimbursementRequests.status, statusFilter));
  }

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
    .where(and(...conditions))
    .orderBy(desc(reimbursementRequests.createdAt))
    .limit(100);

  const userIds = [
    ...new Set(
      rows.flatMap((r) => [r.requesterId, r.approvedBy]).filter((id): id is string => id !== null),
    ),
  ];
  const userRows =
    userIds.length > 0
      ? await db.select({ id: users.id, displayName: users.displayName }).from(users)
      : [];
  const userMap = new Map(userRows.map((u) => [u.id, u.displayName]));

  const locIds = [...new Set(rows.map((r) => r.locationId))];
  const locRows =
    locIds.length > 0
      ? await db.select({ id: locations.id, name: locations.name }).from(locations)
      : [];
  const locMap = new Map(locRows.map((l) => [l.id, l.name as LocaleString]));

  return rows.map((r) => ({
    id: r.id,
    requesterId: r.requesterId,
    requesterName: userMap.get(r.requesterId) ?? r.requesterId,
    locationId: r.locationId,
    locationName: locMap.get(r.locationId)?.id ?? r.locationId,
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
  }));
}

export async function fetchLocations(tenantId: string): Promise<LocationItem[]> {
  const rows = await db
    .select({ id: locations.id, name: locations.name })
    .from(locations)
    .where(eq(locations.tenantId, tenantId));
  return rows.map((r) => ({
    id: r.id,
    name: (r.name as LocaleString)?.id ?? String(r.name),
  }));
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
  tenantId: string,
  userId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
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
    return { success: true };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

export async function submitReimbursement(
  id: string,
  tenantId: string,
  userId: string,
): Promise<{ success: boolean; error?: string }> {
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
    await db
      .update(reimbursementRequests)
      .set({ status: 'submitted', updatedBy: userId, updatedAt: new Date() })
      .where(eq(reimbursementRequests.id, id));
    return { success: true };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

export async function approveReimbursement(
  id: string,
  tenantId: string,
  userId: string,
): Promise<{ success: boolean; error?: string }> {
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
    await db
      .update(reimbursementRequests)
      .set({
        status: 'approved',
        approvedBy: userId,
        approvedAt: new Date(),
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(eq(reimbursementRequests.id, id));
    return { success: true };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

export async function rejectReimbursement(
  id: string,
  reason: string,
  tenantId: string,
  userId: string,
): Promise<{ success: boolean; error?: string }> {
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
    await db
      .update(reimbursementRequests)
      .set({
        status: 'rejected',
        rejectionReason: reason,
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(eq(reimbursementRequests.id, id));
    return { success: true };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

export async function disburseReimbursement(
  id: string,
  tenantId: string,
  userId: string,
): Promise<{ success: boolean; error?: string }> {
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
    await db
      .update(reimbursementRequests)
      .set({
        status: 'disbursed',
        disbursedAt: new Date(),
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(eq(reimbursementRequests.id, id));
    return { success: true };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}
