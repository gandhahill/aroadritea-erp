/**
 * hr.createEmployee — SD §9.6, §21.8
 *
 * Creates an employee record.
 * Permission: hr.employee.write
 */

import { db } from '@erp/db';
import { roles, userRoles, users, authAccounts } from '@erp/db/schema/auth';
import { employees } from '@erp/db/schema/hr';
import { AppError } from '@erp/shared/errors';
import { generateId } from '@erp/shared/id';
import { type Result, err, tryCatch } from '@erp/shared/result';
import type { AuditContext } from '@erp/shared/types';
import { and, eq } from 'drizzle-orm';
import { auditRecord } from '../audit';
import { hashPassword } from '../auth/password';
import { requirePermission } from '../iam';
import { encryptPii, encryptPiiForLookup } from '../security/pii';
import { type CreateEmployeeInput, CreateEmployeeInputSchema } from './schemas';

export async function createEmployee(
  input: CreateEmployeeInput,
  ctx: AuditContext,
): Promise<Result<{ id: string }>> {
  const parsed = CreateEmployeeInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      AppError.validation('hr.employee.validationFailed', { issues: parsed.error.issues }),
    );
  }
  const data = parsed.data;
  const targetLocationId = data.locationId ?? ctx.locationId;
  if (!targetLocationId) {
    return err(AppError.validation('hr.employee.locationRequired'));
  }

  const permCheck = await requirePermission(ctx.userId, 'hr.employee.write', {
    locationId: targetLocationId,
  });
  if (!permCheck.ok) return permCheck;

  if (data.loginScope === 'global') {
    const globalPermCheck = await requirePermission(ctx.userId, 'hr.employee.write', {
      locationId: '__global_hr_employee_write__',
    });
    if (!globalPermCheck.ok) return globalPermCheck;
  }

  return tryCatch(
    async () => {
      const empId = generateId();

      const [emp] = await db
        .insert(employees)
        .values({
          id: empId,
          tenantId: ctx.tenantId,
          locationId: targetLocationId,
          createdBy: ctx.userId,
          updatedBy: ctx.userId,
          // NIK is optional. When supplied we still encrypt at rest;
          // when omitted we persist NULL so the unique index does not
          // collide (PostgreSQL allows multiple NULLs in a unique
          // index) — see migration 0029_employee_nik_optional.
          nik: data.nik ? (encryptPii(data.nik, 'employees.nik') ?? null) : null,
          name: data.name,
          email: encryptPiiForLookup(data.email, 'employees.email') ?? '',
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
          requirePasswordChange: data.requirePasswordChange ?? false,
          createdBy: ctx.userId,
          updatedBy: ctx.userId,
        });
        await db.insert(userRoles).values({
          userId,
          roleId: role.id,
          locationId: data.loginScope === 'global' ? null : targetLocationId,
        });
        await db.insert(authAccounts).values({
          userId,
          accountId: data.email,
          providerId: 'credential',
          password: hash,
        });
      }

      // SD §15 — every employee create writes an audit row. Don't log
      // raw PII fields here; the before/after diff comes from the
      // encrypted values stored in the row. We only persist a short
      // summary that's safe to display in the audit-trail UI.
      await auditRecord({
        action: 'create',
        entityType: 'employee',
        entityId: emp.id,
        before: null,
        after: {
          name: data.name,
          email: data.email,
          position: data.position,
          department: data.department ?? null,
          contractType: data.contractType,
          hireDate: data.hireDate,
          locationId: targetLocationId,
          loginScope: data.password && data.roleCode ? data.loginScope : null,
        },
        metadata: { ip: ctx.ipAddress ?? null, userAgent: ctx.userAgent ?? null },
        ctx,
      });

      return { id: emp.id };
    },
    (e) => {
      if (e instanceof AppError) return e;
      return AppError.internal('hr.employee.createFailed', e);
    },
  );
}
