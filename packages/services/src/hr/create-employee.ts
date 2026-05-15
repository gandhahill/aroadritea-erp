/**
 * hr.createEmployee — SD §9.6, §21.8
 *
 * Creates an employee record.
 * Permission: hr.employee.write
 */

import { db } from '@erp/db';
import { employees } from '@erp/db/schema/hr';
import { AppError } from '@erp/shared/errors';
import { generateId } from '@erp/shared/id';
import { type Result, err, tryCatch } from '@erp/shared/result';
import type { AuditContext } from '@erp/shared/types';
import { requirePermission } from '../iam';
import { type CreateEmployeeInput, CreateEmployeeInputSchema } from './schemas';

export async function createEmployee(
  input: CreateEmployeeInput,
  ctx: AuditContext,
): Promise<Result<{ id: string }>> {
  const permCheck = await requirePermission(ctx.userId, 'hr.employee.write', {
    locationId: ctx.locationId,
  });
  if (!permCheck.ok) return permCheck;

  const parsed = CreateEmployeeInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      AppError.validation('hr.employee.validationFailed', { issues: parsed.error.issues }),
    );
  }
  const data = parsed.data;

  return tryCatch(
    async () => {
      const empId = generateId();

      const [emp] = await db
        .insert(employees)
        .values({
          id: empId,
          tenantId: ctx.tenantId,
          locationId: ctx.locationId,
          createdBy: ctx.userId,
          updatedBy: ctx.userId,
          nik: data.nik,
          name: data.name,
          email: data.email,
          phone: data.phone ?? null,
          address: data.address ?? null,
          status: 'probation',
          position: data.position,
          department: data.department ?? null,
          hireDate: new Date(data.hireDate),
          probationEndDate: data.probationEndDate ? new Date(data.probationEndDate) : null,
          contractType: data.contractType,
          workSchedule: data.workSchedule,
          npwp: data.npwp ?? null,
          bpjsKesehatan: data.bpjsKesehatan ?? null,
          bpjsTenagakerja: data.bpjsTenagakerja ?? null,
          emergencyContactName: data.emergencyContactName ?? null,
          emergencyContactPhone: data.emergencyContactPhone ?? null,
        })
        .returning({ id: employees.id });

      if (!emp) {
        throw AppError.internal('hr.employee.createFailed', new Error('No rows returned'));
      }

      return { id: emp.id };
    },
    (e) => {
      if (e instanceof AppError) return e;
      return AppError.internal('hr.employee.createFailed', e);
    },
  );
}
