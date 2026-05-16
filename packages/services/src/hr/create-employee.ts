/**
 * hr.createEmployee — SD §9.6, §21.8
 *
 * Creates an employee record.
 * Permission: hr.employee.write
 */

import { db } from '@erp/db';
import { roles, userRoles, users } from '@erp/db/schema/auth';
import { employees } from '@erp/db/schema/hr';
import { AppError } from '@erp/shared/errors';
import { generateId } from '@erp/shared/id';
import { type Result, err, tryCatch } from '@erp/shared/result';
import type { AuditContext } from '@erp/shared/types';
import { and, eq } from 'drizzle-orm';
import { hashPassword } from '../auth/password';
import { requirePermission } from '../iam';
import { encryptPii } from '../security/pii';
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
          nik: encryptPii(data.nik, 'employees.nik') ?? '',
          name: data.name,
          email: data.email,
          phone: encryptPii(data.phone, 'employees.phone'),
          address: encryptPii(data.address, 'employees.address'),
          status: 'probation',
          position: data.position,
          department: data.department ?? null,
          hireDate: new Date(data.hireDate),
          probationEndDate: data.probationEndDate ? new Date(data.probationEndDate) : null,
          contractType: data.contractType,
          workSchedule: data.workSchedule,
          npwp: encryptPii(data.npwp, 'employees.npwp'),
          bpjsKesehatan: encryptPii(data.bpjsKesehatan, 'employees.bpjsKesehatan'),
          bpjsTenagakerja: encryptPii(data.bpjsTenagakerja, 'employees.bpjsTenagakerja'),
          emergencyContactName: data.emergencyContactName ?? null,
          emergencyContactPhone: encryptPii(
            data.emergencyContactPhone,
            'employees.emergencyContactPhone',
          ),
        })
        .returning({ id: employees.id });

      if (!emp) {
        throw AppError.internal('hr.employee.createFailed', new Error('No rows returned'));
      }

      // Optional: provision ERP login account for this employee.
      if (data.password && data.roleCode) {
        // Reject duplicate email so we don't shadow an existing user.
        const existing = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.email, data.email))
          .limit(1);
        if (existing[0]) {
          throw AppError.validation('hr.employee.emailAlreadyHasLogin', { email: data.email });
        }

        const [role] = await db
          .select({ id: roles.id })
          .from(roles)
          .where(and(eq(roles.tenantId, ctx.tenantId), eq(roles.code, data.roleCode)))
          .limit(1);
        if (!role) {
          throw AppError.validation('hr.employee.roleNotFound', { roleCode: data.roleCode });
        }

        const userId = generateId();
        const hash = await hashPassword(data.password);
        await db.insert(users).values({
          id: userId,
          tenantId: ctx.tenantId,
          email: data.email,
          passwordHash: hash,
          displayName: data.name,
          phone: encryptPii(data.phone, 'users.phone'),
          locale: 'id',
          status: 'active',
          emailVerified: new Date(),
          createdBy: ctx.userId,
          updatedBy: ctx.userId,
        });
        await db.insert(userRoles).values({ userId, roleId: role.id });
      }

      return { id: emp.id };
    },
    (e) => {
      if (e instanceof AppError) return e;
      return AppError.internal('hr.employee.createFailed', e);
    },
  );
}
