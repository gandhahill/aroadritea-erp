'use server';

import { getSession } from '@/lib/auth';
import { and, db, desc, eq, isNull } from '@erp/db';
import { auditLog } from '@erp/db/schema/audit';
import { jobApplicants, jobOpenings } from '@erp/db/schema/hr';
import { requirePermission } from '@erp/services/iam';
import { encryptPii } from '@erp/services/security/pii';
import { generateId } from '@erp/shared/id';
import type { AuditContext } from '@erp/shared/types';
import { revalidatePath } from 'next/cache';

async function buildCtx(): Promise<AuditContext | null> {
  const session = await getSession();
  if (!session?.user) return null;
  const user = session.user as Record<string, unknown>;
  return {
    userId: String(user.id ?? ''),
    tenantId: String(user.tenantId ?? 'default'),
    locationId: String(user.locationId ?? ''),
  };
}

export interface OpeningRow {
  id: string;
  title: string;
  department: string | null;
  status: string;
  headcount: number;
  openDate: string | null;
  closeDate: string | null;
  applicantCount: number;
}

export interface ApplicantRow {
  id: string;
  openingId: string;
  openingTitle: string;
  name: string;
  email: string | null;
  stage: string;
  appliedAt: string;
}

export async function fetchOpenings(): Promise<OpeningRow[]> {
  const ctx = await buildCtx();
  if (!ctx) return [];
  const rows = await db
    .select()
    .from(jobOpenings)
    .where(eq(jobOpenings.tenantId, ctx.tenantId))
    .orderBy(desc(jobOpenings.createdAt));

  // Applicant counts (one query, then map in code)
  const counts = await db
    .select({
      openingId: jobApplicants.openingId,
      count: jobApplicants.id,
    })
    .from(jobApplicants)
    .where(eq(jobApplicants.tenantId, ctx.tenantId));
  const map = new Map<string, number>();
  for (const c of counts) map.set(c.openingId, (map.get(c.openingId) ?? 0) + 1);

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    department: r.department,
    status: r.status,
    headcount: r.headcount,
    openDate: r.openDate ? String(r.openDate).slice(0, 10) : null,
    closeDate: r.closeDate ? String(r.closeDate).slice(0, 10) : null,
    applicantCount: map.get(r.id) ?? 0,
  }));
}

export async function fetchApplicants(openingId?: string): Promise<ApplicantRow[]> {
  const ctx = await buildCtx();
  if (!ctx) return [];
  // Hide soft-deleted rows. The schema's auditCols includes deletedAt;
  // we only show null = active applicants in the pipeline.
  const conditions = [eq(jobApplicants.tenantId, ctx.tenantId), isNull(jobApplicants.deletedAt)];
  if (openingId) conditions.push(eq(jobApplicants.openingId, openingId));

  const rows = await db
    .select({
      id: jobApplicants.id,
      openingId: jobApplicants.openingId,
      name: jobApplicants.name,
      email: jobApplicants.email,
      stage: jobApplicants.stage,
      appliedAt: jobApplicants.appliedAt,
      openingTitle: jobOpenings.title,
    })
    .from(jobApplicants)
    .leftJoin(
      jobOpenings,
      and(eq(jobApplicants.openingId, jobOpenings.id), eq(jobOpenings.tenantId, ctx.tenantId)),
    )
    .where(and(...conditions))
    .orderBy(desc(jobApplicants.appliedAt))
    .limit(500);

  return rows.map((r) => ({
    id: r.id,
    openingId: r.openingId,
    openingTitle: r.openingTitle ?? '—',
    name: r.name,
    email: r.email,
    stage: r.stage,
    appliedAt: r.appliedAt.toISOString(),
  }));
}

export async function createOpeningAction(input: {
  title: string;
  department?: string;
  summary?: string;
  requirements?: string;
  headcount?: number;
  status?: 'draft' | 'open' | 'closed';
  openDate?: string;
  closeDate?: string;
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  const ctx = await buildCtx();
  if (!ctx) return { ok: false, error: 'Unauthenticated' };
  const perm = await requirePermission(ctx.userId, 'hr.employee.write');
  if (!perm.ok) return { ok: false, error: 'Forbidden' };

  if (!input.title.trim()) return { ok: false, error: 'Judul wajib diisi.' };

  const id = generateId();
  await db.insert(jobOpenings).values({
    id,
    tenantId: ctx.tenantId,
    locationId: ctx.locationId,
    title: input.title.trim(),
    department: input.department?.trim() ?? null,
    summary: input.summary?.trim() ?? null,
    requirements: input.requirements?.trim() ?? null,
    status: input.status ?? 'draft',
    headcount: input.headcount ?? 1,
    openDate: input.openDate ?? null,
    closeDate: input.closeDate ?? null,
    createdBy: ctx.userId,
    updatedBy: ctx.userId,
  });

  await db.insert(auditLog).values({
    id: generateId(),
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: 'create',
    entityType: 'job_opening',
    entityId: id,
    after: {
      title: input.title.trim(),
      department: input.department?.trim() ?? null,
      status: input.status ?? 'draft',
      headcount: input.headcount ?? 1,
    },
  });

  revalidatePath('/hr/recruitment');
  return { ok: true, id };
}

export async function updateOpeningStatusAction(input: {
  openingId: string;
  status: 'draft' | 'open' | 'closed';
}): Promise<{ ok: boolean; error?: string }> {
  const ctx = await buildCtx();
  if (!ctx) return { ok: false, error: 'Unauthenticated' };
  const perm = await requirePermission(ctx.userId, 'hr.employee.write');
  if (!perm.ok) return { ok: false, error: 'Forbidden' };
  await db
    .update(jobOpenings)
    .set({ status: input.status, updatedBy: ctx.userId, updatedAt: new Date() })
    .where(and(eq(jobOpenings.id, input.openingId), eq(jobOpenings.tenantId, ctx.tenantId)));

  await db.insert(auditLog).values({
    id: generateId(),
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: 'update',
    entityType: 'job_opening',
    entityId: input.openingId,
    after: { status: input.status },
  });

  revalidatePath('/hr/recruitment');
  return { ok: true };
}

export async function createApplicantAction(input: {
  openingId: string;
  name: string;
  email?: string;
  phone?: string;
  resumeUrl?: string;
  notes?: string;
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  const ctx = await buildCtx();
  if (!ctx) return { ok: false, error: 'Unauthenticated' };
  const perm = await requirePermission(ctx.userId, 'hr.employee.write');
  if (!perm.ok) return { ok: false, error: 'Forbidden' };

  if (!input.name.trim()) return { ok: false, error: 'Nama wajib diisi.' };

  const id = generateId();
  await db.insert(jobApplicants).values({
    id,
    tenantId: ctx.tenantId,
    openingId: input.openingId,
    name: input.name.trim(),
    email: input.email?.trim() ?? null,
    phone: encryptPii(input.phone ?? undefined, 'job_applicants.phone'),
    stage: 'applied',
    resumeUrl: input.resumeUrl?.trim() ?? null,
    notes: input.notes?.trim() ?? null,
    createdBy: ctx.userId,
    updatedBy: ctx.userId,
  });

  await db.insert(auditLog).values({
    id: generateId(),
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: 'create',
    entityType: 'job_applicant',
    entityId: id,
    after: {
      openingId: input.openingId,
      name: input.name.trim(),
      stage: 'applied',
    },
  });

  revalidatePath('/hr/recruitment');
  return { ok: true, id };
}

export async function setApplicantStageAction(input: {
  applicantId: string;
  stage: 'applied' | 'screening' | 'interview' | 'offer' | 'hired' | 'rejected' | 'withdrawn';
}): Promise<{ ok: boolean; error?: string }> {
  const ctx = await buildCtx();
  if (!ctx) return { ok: false, error: 'Unauthenticated' };
  const perm = await requirePermission(ctx.userId, 'hr.employee.write');
  if (!perm.ok) return { ok: false, error: 'Forbidden' };
  await db
    .update(jobApplicants)
    .set({ stage: input.stage, updatedBy: ctx.userId, updatedAt: new Date() })
    .where(and(eq(jobApplicants.id, input.applicantId), eq(jobApplicants.tenantId, ctx.tenantId)));

  await db.insert(auditLog).values({
    id: generateId(),
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: 'update',
    entityType: 'job_applicant',
    entityId: input.applicantId,
    after: { stage: input.stage },
  });

  revalidatePath('/hr/recruitment');
  return { ok: true };
}

/**
 * Update a candidate's editable fields (name/email/phone/resume/notes).
 * Phone is re-encrypted on change to keep PII at-rest properly wrapped.
 */
export async function updateApplicantAction(input: {
  applicantId: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  resumeUrl?: string | null;
  notes?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const ctx = await buildCtx();
  if (!ctx) return { ok: false, error: 'Unauthenticated' };
  const perm = await requirePermission(ctx.userId, 'hr.employee.write');
  if (!perm.ok) return { ok: false, error: 'Forbidden' };

  if (!input.name.trim()) return { ok: false, error: 'Nama wajib diisi.' };

  await db
    .update(jobApplicants)
    .set({
      name: input.name.trim(),
      email: input.email?.trim() || null,
      phone: encryptPii(input.phone ?? undefined, 'job_applicants.phone'),
      resumeUrl: input.resumeUrl?.trim() || null,
      notes: input.notes?.trim() || null,
      updatedBy: ctx.userId,
      updatedAt: new Date(),
    })
    .where(and(eq(jobApplicants.id, input.applicantId), eq(jobApplicants.tenantId, ctx.tenantId)));

  await db.insert(auditLog).values({
    id: generateId(),
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: 'update',
    entityType: 'job_applicant',
    entityId: input.applicantId,
    after: { name: input.name.trim() },
  });

  revalidatePath('/hr/recruitment');
  return { ok: true };
}

/**
 * Soft-delete a candidate by setting deletedAt (auditCols column).
 * Stops the row from appearing in fetchApplicants while keeping
 * audit history intact.
 */
export async function deleteApplicantAction(input: {
  applicantId: string;
}): Promise<{ ok: boolean; error?: string }> {
  const ctx = await buildCtx();
  if (!ctx) return { ok: false, error: 'Unauthenticated' };
  const perm = await requirePermission(ctx.userId, 'hr.employee.write');
  if (!perm.ok) return { ok: false, error: 'Forbidden' };

  await db
    .update(jobApplicants)
    .set({ deletedAt: new Date(), updatedBy: ctx.userId, updatedAt: new Date() })
    .where(and(eq(jobApplicants.id, input.applicantId), eq(jobApplicants.tenantId, ctx.tenantId)));

  await db.insert(auditLog).values({
    id: generateId(),
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: 'delete',
    entityType: 'job_applicant',
    entityId: input.applicantId,
  });

  revalidatePath('/hr/recruitment');
  return { ok: true };
}
