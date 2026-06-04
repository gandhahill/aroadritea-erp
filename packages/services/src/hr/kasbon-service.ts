import { db } from '@erp/db';
import { cashAdvances, employees, employmentContracts } from '@erp/db/schema/hr';
import { AppError } from '@erp/shared/errors';
import { type Result, err, ok } from '@erp/shared/result';
import type { AuditContext } from '@erp/shared/types';
import { generateId } from '@erp/shared/id';
import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import { requirePermission } from '../iam';
import { createJournal } from '../accounting/create-journal';
import { auditRecord } from '../audit';

export const RequestKasbonInputSchema = z.object({
  employeeId: z.string().min(1),
  amount: z.number().positive(),
  reason: z.string().min(3),
});

export type RequestKasbonInput = z.infer<typeof RequestKasbonInputSchema>;

export interface KasbonListItem {
  id: string;
  employeeId: string;
  employeeName: string;
  amount: string;
  reason: string;
  status: string;
  rejectReason: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  createdAt: string;
}

export async function requestKasbon(input: RequestKasbonInput, ctx: AuditContext): Promise<Result<{ id: string }>> {
  const parsed = RequestKasbonInputSchema.safeParse(input);
  if (!parsed.success) return err(AppError.validation('common.errors.validationFailed', { issues: parsed.error.issues }));

  const [contract] = await db
    .select()
    .from(employmentContracts)
    .where(and(eq(employmentContracts.employeeId, input.employeeId), eq(employmentContracts.isActive, true)));

  if (!contract) return err(AppError.businessRule('hr.kasbon.no_active_contract'));

  const maxLimit = Number(contract.baseSalary) * 0.3;
  if (input.amount > maxLimit) {
    return err(AppError.businessRule('hr.kasbon.exceeds_limit', { limit: maxLimit }));
  }

  const id = generateId();
  await db.insert(cashAdvances).values({
    id,
    tenantId: ctx.tenantId,
    locationId: ctx.locationId,
    employeeId: input.employeeId,
    amount: BigInt(input.amount),
    reason: input.reason,
    status: 'pending',
    createdBy: ctx.userId,
    updatedBy: ctx.userId,
  });

  await auditRecord({
    action: 'create',
    entityType: 'cash_advance',
    entityId: id,
    before: null,
    after: { employeeId: input.employeeId, amount: input.amount, reason: input.reason },
    metadata: {},
    ctx,
  });

  return ok({ id });
}

export async function approveKasbon(kasbonId: string, accountIdCash: string, accountIdKasbon: string, ctx: AuditContext): Promise<Result<{ id: string }>> {
  const [kasbon] = await db
    .select()
    .from(cashAdvances)
    .where(and(eq(cashAdvances.id, kasbonId), eq(cashAdvances.tenantId, ctx.tenantId)));

  if (!kasbon) return err(AppError.notFound('hr.kasbon.not_found'));
  if (kasbon.status !== 'pending') return err(AppError.businessRule('hr.kasbon.not_pending'));

  const permCheck = await requirePermission(ctx.userId, 'hr.payroll.write', { locationId: kasbon.locationId });
  if (!permCheck.ok) return permCheck;

  const jeResult = await createJournal(
    {
      postingDate: new Date().toISOString().split('T')[0] as string,
      locationId: kasbon.locationId,
      description: `Kasbon Employee - ${kasbon.employeeId}`,
      referenceType: 'payroll' as any,
      referenceId: kasbonId,
      lines: [
        {
          accountId: accountIdKasbon,
          locationId: kasbon.locationId,
          description: `Kasbon - ${kasbon.reason}`,
          debit: kasbon.amount.toString(),
          credit: '0',
        },
        {
          accountId: accountIdCash,
          locationId: kasbon.locationId,
          description: `Kasbon Payout`,
          debit: '0',
          credit: kasbon.amount.toString(),
        },
      ],
    },
    ctx, { skipPermissionCheck: true }
  );

  if (!jeResult.ok) return jeResult;

  await db
    .update(cashAdvances)
    .set({
      status: 'approved',
      approvedBy: ctx.userId,
      approvedAt: new Date(),
      journalEntryId: jeResult.value.id,
      updatedBy: ctx.userId,
    })
    .where(eq(cashAdvances.id, kasbonId));

  await auditRecord({
    action: 'approve',
    entityType: 'cash_advance',
    entityId: kasbonId,
    before: { status: 'pending' },
    after: { status: 'approved' },
    metadata: {},
    ctx,
  });

  return ok({ id: kasbon.id });
}

export async function rejectKasbon(
  kasbonId: string,
  reason: string,
  ctx: AuditContext,
): Promise<Result<{ id: string }>> {
  const [kasbon] = await db
    .select()
    .from(cashAdvances)
    .where(and(eq(cashAdvances.id, kasbonId), eq(cashAdvances.tenantId, ctx.tenantId)));

  if (!kasbon) return err(AppError.notFound('hr.kasbon.not_found'));
  if (kasbon.status !== 'pending') return err(AppError.businessRule('hr.kasbon.not_pending'));

  const permCheck = await requirePermission(ctx.userId, 'hr.payroll.write', { locationId: kasbon.locationId });
  if (!permCheck.ok) return permCheck;

  await db
    .update(cashAdvances)
    .set({
      status: 'rejected',
      rejectReason: reason,
      updatedBy: ctx.userId,
    })
    .where(eq(cashAdvances.id, kasbonId));

  await auditRecord({
    action: 'reject',
    entityType: 'cash_advance',
    entityId: kasbonId,
    before: { status: 'pending' },
    after: { status: 'rejected', rejectReason: reason },
    metadata: {},
    ctx,
  });

  return ok({ id: kasbon.id });
}

export async function listKasbon(
  input: { status?: string; employeeId?: string; locationId?: string; locationIds?: string[]; page?: number; pageSize?: number },
  ctx: AuditContext,
): Promise<Result<{ items: KasbonListItem[]; total: number }>> {
  const permCheck = await requirePermission(ctx.userId, 'hr.payroll.read', {
    locationId: input.locationId ?? ctx.locationId,
  });
  if (!permCheck.ok) return permCheck;

  const page = Math.max(1, input.page ?? 1);
  const pageSize = input.pageSize ?? 25;
  const offset = (page - 1) * pageSize;

  const conds = [eq(cashAdvances.tenantId, ctx.tenantId), isNull(cashAdvances.deletedAt)];
  if (input.status) conds.push(eq(cashAdvances.status, input.status));
  if (input.employeeId) conds.push(eq(cashAdvances.employeeId, input.employeeId));
  if (input.locationId) conds.push(eq(cashAdvances.locationId, input.locationId));
  else if (input.locationIds && input.locationIds.length > 0) {
    conds.push(inArray(cashAdvances.locationId, input.locationIds));
  }

  const whereClause = and(...conds);

  const [totalRow] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(cashAdvances)
    .where(whereClause!);

  const rows = await db
    .select({
      id: cashAdvances.id,
      employeeId: cashAdvances.employeeId,
      amount: cashAdvances.amount,
      reason: cashAdvances.reason,
      status: cashAdvances.status,
      rejectReason: cashAdvances.rejectReason,
      approvedBy: cashAdvances.approvedBy,
      approvedAt: cashAdvances.approvedAt,
      createdAt: cashAdvances.createdAt,
    })
    .from(cashAdvances)
    .where(whereClause!)
    .orderBy(desc(cashAdvances.createdAt))
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
      amount: r.amount.toString(),
      reason: r.reason,
      status: r.status,
      rejectReason: r.rejectReason ?? null,
      approvedBy: r.approvedBy ?? null,
      approvedAt: r.approvedAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
    })),
  });
}
