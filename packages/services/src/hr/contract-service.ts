import { db } from '@erp/db';
import { employees, employmentContracts } from '@erp/db/schema/hr';
import { AppError } from '@erp/shared/errors';
import { type Result, err, ok } from '@erp/shared/result';
import type { AuditContext } from '@erp/shared/types';
import { generateId } from '@erp/shared/id';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { requirePermission } from '../iam';
import { auditRecord } from '../audit';

export const CreateContractInputSchema = z.object({
  employeeId: z.string().min(1),
  contractType: z.enum(['pkwt', 'pkwtt']),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  baseSalary: z.number().positive(),
  notes: z.string().optional(),
});

export type CreateContractInput = z.infer<typeof CreateContractInputSchema>;

export async function createContract(
  input: CreateContractInput,
  ctx: AuditContext,
): Promise<Result<{ id: string }>> {
  const parsed = CreateContractInputSchema.safeParse(input);
  if (!parsed.success) return err(AppError.validation('common.errors.validationFailed', { issues: parsed.error.issues }));

  const permCheck = await requirePermission(ctx.userId, 'hr.employee.write', { locationId: ctx.locationId });
  if (!permCheck.ok) return permCheck;

  const data = parsed.data;

  const [emp] = await db
    .select({ id: employees.id, currentContractId: employees.currentContractId })
    .from(employees)
    .where(and(eq(employees.id, data.employeeId), eq(employees.tenantId, ctx.tenantId)));

  if (!emp) return err(AppError.notFound('hr.employees.notFound'));

  const newId = generateId();

  await db.transaction(async (tx) => {
    // Deactivate current contract
    if (emp.currentContractId) {
      await tx
        .update(employmentContracts)
        .set({ isActive: false, updatedBy: ctx.userId })
        .where(eq(employmentContracts.id, emp.currentContractId));
    }

    // Create new contract
    await tx.insert(employmentContracts).values({
      id: newId,
      tenantId: ctx.tenantId,
      locationId: ctx.locationId,
      employeeId: data.employeeId,
      contractType: data.contractType,
      startDate: new Date(`${data.startDate}T00:00:00+07:00`),
      endDate: data.endDate ? new Date(`${data.endDate}T00:00:00+07:00`) : null,
      isActive: true,
      baseSalary: BigInt(data.baseSalary),
      notes: data.notes ?? null,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    });

    // Update employee's currentContractId
    await tx
      .update(employees)
      .set({ currentContractId: newId, updatedBy: ctx.userId })
      .where(eq(employees.id, data.employeeId));

    await auditRecord({
      action: 'create',
      entityType: 'employment_contract',
      entityId: newId,
      before: emp.currentContractId ? { previousContractId: emp.currentContractId } : null,
      after: { contractType: data.contractType, startDate: data.startDate, baseSalary: data.baseSalary },
      metadata: {},
      ctx,
      tx,
    });
  });

  return ok({ id: newId });
}

export async function endContract(
  contractId: string,
  endDate: string,
  ctx: AuditContext,
): Promise<Result<{ id: string }>> {
  const permCheck = await requirePermission(ctx.userId, 'hr.employee.write', { locationId: ctx.locationId });
  if (!permCheck.ok) return permCheck;

  const [contract] = await db
    .select()
    .from(employmentContracts)
    .where(and(eq(employmentContracts.id, contractId), eq(employmentContracts.tenantId, ctx.tenantId)));

  if (!contract) return err(AppError.notFound('hr.contracts.notFound'));
  if (!contract.isActive) return err(AppError.businessRule('hr.contracts.alreadyEnded'));

  await db.transaction(async (tx) => {
    await tx
      .update(employmentContracts)
      .set({
        endDate: new Date(`${endDate}T00:00:00+07:00`),
        isActive: false,
        updatedBy: ctx.userId,
      })
      .where(eq(employmentContracts.id, contractId));

    // Clear currentContractId on employee
    await tx
      .update(employees)
      .set({ currentContractId: null, updatedBy: ctx.userId })
      .where(eq(employees.id, contract.employeeId));

    await auditRecord({
      action: 'deactivate',
      entityType: 'employment_contract',
      entityId: contractId,
      before: { isActive: true },
      after: { isActive: false, endDate },
      metadata: {},
      ctx,
      tx,
    });
  });

  return ok({ id: contractId });
}
