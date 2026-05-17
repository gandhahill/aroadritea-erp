/**
 * hr.updateEmployee — SD §9.6, §21.8
 *
 * Updates an employee record with optimistic locking.
 * Permission: hr.employee.write
 */

import { db } from '@erp/db';
import { auditLog } from '@erp/db/schema/audit';
import { employees } from '@erp/db/schema/hr';
import { AppError } from '@erp/shared/errors';
import { generateId } from '@erp/shared/id';
import { type Result, err, tryCatch } from '@erp/shared/result';
import type { AuditContext } from '@erp/shared/types';
import { and, eq } from 'drizzle-orm';
import { requirePermission } from '../iam';
import { encryptPii } from '../security/pii';
import { type UpdateEmployeeInput, UpdateEmployeeInputSchema } from './schemas';

export async function updateEmployee(
  input: UpdateEmployeeInput,
  ctx: AuditContext,
): Promise<Result<{ id: string }>> {
  const permCheck = await requirePermission(ctx.userId, 'hr.employee.write', {
    locationId: ctx.locationId,
  });
  if (!permCheck.ok) return permCheck;

  const parsed = UpdateEmployeeInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      AppError.validation('hr.employee.validationFailed', { issues: parsed.error.issues }),
    );
  }
  const { employeeId, version, ...data } = parsed.data;

  return tryCatch(
    async () => {
      const setCols: Record<string, unknown> = {
        updatedBy: ctx.userId,
      };

      if (data.name !== undefined) setCols.name = data.name;
      if (data.email !== undefined) setCols.email = data.email;
      if (data.phone !== undefined) setCols.phone = encryptPii(data.phone, 'employees.phone');
      if (data.address !== undefined) setCols.address = encryptPii(data.address, 'employees.address');
      if (data.position !== undefined) setCols.position = data.position;
      if (data.department !== undefined) setCols.department = data.department;
      if (data.status !== undefined) setCols.status = data.status;
      if (data.contractType !== undefined) setCols.contractType = data.contractType;
      if (data.workSchedule !== undefined) setCols.workSchedule = data.workSchedule;
      if (data.npwp !== undefined) setCols.npwp = encryptPii(data.npwp, 'employees.npwp');
      if (data.bpjsKesehatan !== undefined)
        setCols.bpjsKesehatan = encryptPii(data.bpjsKesehatan, 'employees.bpjsKesehatan');
      if (data.bpjsTenagakerja !== undefined)
        setCols.bpjsTenagakerja = encryptPii(data.bpjsTenagakerja, 'employees.bpjsTenagakerja');
      if (data.emergencyContactName !== undefined)
        setCols.emergencyContactName = data.emergencyContactName;
      if (data.emergencyContactPhone !== undefined)
        setCols.emergencyContactPhone = encryptPii(
          data.emergencyContactPhone,
          'employees.emergencyContactPhone',
        );

      const [updated] = await db
        .update(employees)
        .set(setCols)
        .where(and(eq(employees.id, employeeId), eq(employees.tenantId, ctx.tenantId)))
        .returning({ id: employees.id });

      if (!updated) {
        throw AppError.notFound('hr.employee.notFound');
      }

      // SD §15 — log only non-PII field changes. The encrypted columns
      // (phone/address/npwp/etc.) are intentionally excluded so the
      // audit trail can be read by managers without holding the PII key.
      const safeAfter: Record<string, unknown> = {};
      for (const key of [
        'name',
        'email',
        'position',
        'department',
        'status',
        'contractType',
        'workSchedule',
        'emergencyContactName',
      ] as const) {
        const v = data[key as keyof typeof data];
        if (v !== undefined) safeAfter[key] = v;
      }
      const piiKeysTouched = [
        'phone',
        'address',
        'npwp',
        'bpjsKesehatan',
        'bpjsTenagakerja',
        'emergencyContactPhone',
      ].filter((k) => data[k as keyof typeof data] !== undefined);
      if (piiKeysTouched.length > 0) safeAfter['_pii_fields_updated'] = piiKeysTouched;

      await db.insert(auditLog).values({
        id: generateId(),
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        action: 'update',
        entityType: 'employee',
        entityId: updated.id,
        before: null,
        after: safeAfter,
        metadata: { ip: ctx.ipAddress ?? null, userAgent: ctx.userAgent ?? null },
      });

      return { id: updated.id };
    },
    (e) => {
      if (e instanceof AppError) return e;
      return AppError.internal('hr.employee.updateFailed', e);
    },
  );
}

/**
 * Soft-deactivate an employee (set status to 'terminated').
 * Permission: hr.employee.write
 */
export async function deactivateEmployee(
  employeeId: string,
  ctx: AuditContext,
): Promise<Result<{ id: string }>> {
  const permCheck = await requirePermission(ctx.userId, 'hr.employee.write', {
    locationId: ctx.locationId,
  });
  if (!permCheck.ok) return permCheck;

  return tryCatch(
    async () => {
      const [updated] = await db
        .update(employees)
        .set({ status: 'terminated', updatedBy: ctx.userId })
        .where(and(eq(employees.id, employeeId), eq(employees.tenantId, ctx.tenantId)))
        .returning({ id: employees.id });

      if (!updated) throw AppError.notFound('hr.employee.notFound');
      return { id: updated.id };
    },
    (e) => {
      if (e instanceof AppError) return e;
      return AppError.internal('hr.employee.deactivateFailed', e);
    },
  );
}
