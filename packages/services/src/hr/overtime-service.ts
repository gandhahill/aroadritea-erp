import { db } from '@erp/db';
import { employees, overtimes } from '@erp/db/schema/hr';
import { AppError } from '@erp/shared/errors';
import { generateId } from '@erp/shared/id';
import { type Result, err, ok } from '@erp/shared/result';
import type { AuditContext } from '@erp/shared/types';
import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import { auditRecord } from '../audit';
import { requirePermission } from '../iam';

export const RecordOvertimeInputSchema = z.object({
  employeeId: z.string().min(1),
  workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  hours: z.number().positive().max(12),
  reason: z.string().min(3),
});

export interface OvertimeListItem {
  id: string;
  employeeId: string;
  employeeName: string;
  workDate: string;
  hours: string;
  reason: string;
  status: string;
  rejectReason: string | null;
  createdAt: string;
}

export async function recordOvertime(
  input: z.infer<typeof RecordOvertimeInputSchema>,
  ctx: AuditContext,
): Promise<Result<{ id: string }>> {
  const parsed = RecordOvertimeInputSchema.safeParse(input);
  if (!parsed.success)
    return err(
      AppError.validation('common.errors.validationFailed', { issues: parsed.error.issues }),
    );

  const permCheck = await requirePermission(ctx.userId, 'hr.manage_attendance', {
    locationId: ctx.locationId,
  });
  if (!permCheck.ok) return permCheck;

  const id = generateId();
  await db.insert(overtimes).values({
    id,
    tenantId: ctx.tenantId,
    locationId: ctx.locationId,
    employeeId: parsed.data.employeeId,
    workDate: parsed.data.workDate,
    hours: String(parsed.data.hours),
    reason: parsed.data.reason,
    status: 'pending',
    createdBy: ctx.userId,
    updatedBy: ctx.userId,
  });

  await auditRecord({
    action: 'create',
    entityType: 'overtime',
    entityId: id,
    before: null,
    after: {
      employeeId: parsed.data.employeeId,
      workDate: parsed.data.workDate,
      hours: parsed.data.hours,
    },
    metadata: {},
    ctx,
  });

  // Notify approvers (hr.payroll.write holders).
  const { notifyByPermission } = await import('../notification');
  notifyByPermission({
    tenantId: ctx.tenantId,
    kind: 'overtime',
    title: 'Lembur menunggu persetujuan',
    body: `${parsed.data.workDate} · ${parsed.data.hours} jam`,
    link: '/hr/overtime',
    permission: 'hr.payroll.write',
  }).catch(() => {});

  return ok({ id });
}

export async function approveOvertime(
  id: string,
  ctx: AuditContext,
): Promise<Result<{ id: string }>> {
  const [ot] = await db
    .select()
    .from(overtimes)
    .where(and(eq(overtimes.id, id), eq(overtimes.tenantId, ctx.tenantId)));

  if (!ot) return err(AppError.notFound('hr.overtime.not_found'));
  if (ot.status !== 'pending') return err(AppError.businessRule('hr.overtime.not_pending'));

  const permCheck = await requirePermission(ctx.userId, 'hr.payroll.write', {
    locationId: ot.locationId,
  });
  if (!permCheck.ok) return permCheck;

  await db
    .update(overtimes)
    .set({
      status: 'approved',
      approvedBy: ctx.userId,
      approvedAt: new Date(),
      updatedBy: ctx.userId,
    })
    .where(eq(overtimes.id, id));

  await auditRecord({
    action: 'approve',
    entityType: 'overtime',
    entityId: id,
    before: { status: 'pending' },
    after: { status: 'approved' },
    metadata: {},
    ctx,
  });

  return ok({ id: ot.id });
}

export async function rejectOvertime(
  id: string,
  reason: string,
  ctx: AuditContext,
): Promise<Result<{ id: string }>> {
  const [ot] = await db
    .select()
    .from(overtimes)
    .where(and(eq(overtimes.id, id), eq(overtimes.tenantId, ctx.tenantId)));

  if (!ot) return err(AppError.notFound('hr.overtime.not_found'));
  if (ot.status !== 'pending') return err(AppError.businessRule('hr.overtime.not_pending'));

  const permCheck = await requirePermission(ctx.userId, 'hr.payroll.write', {
    locationId: ot.locationId,
  });
  if (!permCheck.ok) return permCheck;

  await db
    .update(overtimes)
    .set({ status: 'rejected', rejectReason: reason, updatedBy: ctx.userId })
    .where(eq(overtimes.id, id));

  await auditRecord({
    action: 'reject',
    entityType: 'overtime',
    entityId: id,
    before: { status: 'pending' },
    after: { status: 'rejected', rejectReason: reason },
    metadata: {},
    ctx,
  });

  return ok({ id: ot.id });
}

export async function listOvertimes(
  input: {
    status?: string;
    employeeId?: string;
    locationId?: string;
    locationIds?: string[];
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    pageSize?: number;
  },
  ctx: AuditContext,
): Promise<Result<{ items: OvertimeListItem[]; total: number }>> {
  const page = Math.max(1, input.page ?? 1);
  const pageSize = input.pageSize ?? 25;
  const offset = (page - 1) * pageSize;

  const conds = [eq(overtimes.tenantId, ctx.tenantId), isNull(overtimes.deletedAt)];
  if (input.status) conds.push(eq(overtimes.status, input.status));
  if (input.employeeId) conds.push(eq(overtimes.employeeId, input.employeeId));
  if (input.locationId) conds.push(eq(overtimes.locationId, input.locationId));
  else if (input.locationIds && input.locationIds.length > 0)
    conds.push(inArray(overtimes.locationId, input.locationIds));
  if (input.dateFrom) conds.push(sql`${overtimes.workDate} >= ${input.dateFrom}`);
  if (input.dateTo) conds.push(sql`${overtimes.workDate} <= ${input.dateTo}`);

  const whereClause = and(...conds);

  const [totalRow] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(overtimes)
    .where(whereClause!);

  const rows = await db
    .select({
      id: overtimes.id,
      employeeId: overtimes.employeeId,
      workDate: overtimes.workDate,
      hours: overtimes.hours,
      reason: overtimes.reason,
      status: overtimes.status,
      rejectReason: overtimes.rejectReason,
      createdAt: overtimes.createdAt,
    })
    .from(overtimes)
    .where(whereClause!)
    .orderBy(desc(overtimes.workDate))
    .limit(pageSize)
    .offset(offset);

  const empIds = [...new Set(rows.map((r) => r.employeeId))];
  let empMap = new Map<string, string>();
  if (empIds.length > 0) {
    const empRows = await db
      .select({ id: employees.id, name: employees.name })
      .from(employees)
      .where(and(eq(employees.tenantId, ctx.tenantId), inArray(employees.id, empIds)));
    empMap = new Map(empRows.map((e) => [e.id, e.name]));
  }

  return ok({
    total: totalRow?.count ?? 0,
    items: rows.map((r) => ({
      id: r.id,
      employeeId: r.employeeId,
      employeeName: empMap.get(r.employeeId) ?? 'Unknown',
      workDate: r.workDate,
      hours: r.hours,
      reason: r.reason,
      status: r.status,
      rejectReason: r.rejectReason ?? null,
      createdAt: r.createdAt.toISOString(),
    })),
  });
}

export async function getApprovedOvertimeForPeriod(
  tenantId: string,
  locationId: string,
  periodStart: string,
  periodEnd: string,
): Promise<Map<string, number>> {
  const rows = await db
    .select({
      employeeId: overtimes.employeeId,
      totalHours: sql<number>`cast(sum(${overtimes.hours}::numeric) as float)`,
    })
    .from(overtimes)
    .where(
      and(
        eq(overtimes.tenantId, tenantId),
        eq(overtimes.locationId, locationId),
        eq(overtimes.status, 'approved'),
        isNull(overtimes.deletedAt),
        sql`${overtimes.workDate} >= ${periodStart}`,
        sql`${overtimes.workDate} <= ${periodEnd}`,
      ),
    )
    .groupBy(overtimes.employeeId);

  return new Map(rows.map((r) => [r.employeeId, r.totalHours]));
}
