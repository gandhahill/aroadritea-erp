/**
 * hr.updateEmployeeLogin — SD §9.6, §21.8
 *
 * Manages an employee's login credentials (creates or updates user/roles/auth accounts).
 * Permission: hr.employee.write
 */

import { db } from '@erp/db';
import { authAccounts, roles, userRoles, users } from '@erp/db/schema/auth';
import { employees } from '@erp/db/schema/hr';
import { AppError } from '@erp/shared/errors';
import { generateId } from '@erp/shared/id';
import { type Result, err, tryCatch } from '@erp/shared/result';
import type { AuditContext } from '@erp/shared/types';
import { and, eq, isNull } from 'drizzle-orm';
import { auditRecord } from '../audit';
import { hashPassword } from '../auth/password';
import { requirePermission } from '../iam';
import { decryptPii, encryptPii } from '../security/pii';
import { type UpdateEmployeeLoginInput, UpdateEmployeeLoginInputSchema } from './schemas';

export async function updateEmployeeLogin(
  input: UpdateEmployeeLoginInput,
  ctx: AuditContext,
): Promise<Result<{ id: string }>> {
  const parsed = UpdateEmployeeLoginInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      AppError.validation('hr.employee.validationFailed', { issues: parsed.error.issues }),
    );
  }
  const data = parsed.data;

  return tryCatch(
    async () => {
      // 1. Fetch employee to get locationId and decrypted email for mapping
      const [emp] = await db
        .select({
          id: employees.id,
          locationId: employees.locationId,
          name: employees.name,
          phone: employees.phone,
          email: employees.email,
        })
        .from(employees)
        .where(
          and(
            eq(employees.id, data.employeeId),
            eq(employees.tenantId, ctx.tenantId),
            isNull(employees.deletedAt),
          )
        )
        .limit(1);

      if (!emp) throw AppError.notFound('hr.employee.notFound');

      const permCheck = await requirePermission(ctx.userId, 'hr.employee.write', {
        locationId: emp.locationId,
      });
      if (!permCheck.ok) throw permCheck.error;

      if (data.loginScope === 'global') {
        const globalPermCheck = await requirePermission(ctx.userId, 'hr.employee.write', {
          locationId: '__global_hr_employee_write__',
        });
        if (!globalPermCheck.ok) throw globalPermCheck.error;
      }

      const email = decryptPii(emp.email, 'employees.email');
      if (!email) throw AppError.internal('hr.employee.updateFailed', new Error('Missing email'));

      let [user] = await db
        .select()
        .from(users)
        .where(and(eq(users.tenantId, ctx.tenantId), eq(users.email, email)))
        .limit(1);

      let [role] = await db
        .select({ id: roles.id })
        .from(roles)
        .where(and(eq(roles.tenantId, ctx.tenantId), eq(roles.code, data.roleCode ?? '')))
        .limit(1);

      if (data.roleCode && !role) {
        throw AppError.validation('hr.employee.roleNotFound', { roleCode: data.roleCode });
      }

      if (user) {
        // User exists: Update role and optionally password
        if (data.roleCode && role) {
          await db
            .update(userRoles)
            .set({
              roleId: role.id,
              locationId: data.loginScope === 'global' ? null : emp.locationId,
            })
            .where(eq(userRoles.userId, user.id));
        } else if (!data.roleCode) {
          // Empty roleCode -> remove login access (delete userRoles and authAccounts)
          await db.delete(userRoles).where(eq(userRoles.userId, user.id));
          await db.delete(authAccounts).where(eq(authAccounts.userId, user.id));
          await db.update(users).set({ status: 'suspended' }).where(eq(users.id, user.id));
        }

        if (data.password && data.roleCode) {
          const hash = await hashPassword(data.password);
          await db
            .update(users)
            .set({ passwordHash: hash, requirePasswordChange: data.requirePasswordChange })
            .where(eq(users.id, user.id));
          
          await db
            .update(authAccounts)
            .set({ password: hash })
            .where(eq(authAccounts.userId, user.id));
        }
      } else if (data.roleCode && data.password && role) {
        // User does not exist, provision a new one
        const userId = generateId();
        const hash = await hashPassword(data.password);
        
        await db.insert(users).values({
          id: userId,
          tenantId: ctx.tenantId,
          email: email,
          passwordHash: hash,
          displayName: emp.name,
          phone: emp.phone ? encryptPii(decryptPii(emp.phone, 'employees.phone'), 'users.phone') : null,
          locale: 'id',
          status: 'active',
          emailVerified: new Date(),
          requirePasswordChange: data.requirePasswordChange,
          createdBy: ctx.userId,
          updatedBy: ctx.userId,
        });

        await db.insert(userRoles).values({
          userId,
          roleId: role.id,
          locationId: data.loginScope === 'global' ? null : emp.locationId,
        });

        await db.insert(authAccounts).values({
          id: generateId(),
          userId,
          accountId: email,
          providerId: 'credential',
          password: hash,
        });
      }

      await auditRecord({
        action: 'update',
        entityType: 'employee_login',
        entityId: emp.id,
        before: null, // Hard to reconstruct accurately, so we just log after
        after: {
          roleCode: data.roleCode,
          loginScope: data.loginScope,
          passwordChanged: !!data.password,
          requirePasswordChange: data.requirePasswordChange,
        },
        metadata: { ip: ctx.ipAddress ?? null, userAgent: ctx.userAgent ?? null },
        ctx,
      });

      return { id: emp.id };
    },
    (e) => {
      if (e instanceof AppError) return e;
      return AppError.internal('hr.employee.updateFailed', e);
    },
  );
}
