/**
 * hr.deleteEmployee — SD §9.6, §21.8
 *
 * Soft-deletes an employee and their corresponding user account, 
 * freeing up their email for future re-registration.
 * Permission: hr.employee.write (global or scoped to employee's location)
 */

import { db } from '@erp/db';
import { authAccounts, userRoles, users } from '@erp/db/schema/auth';
import { employees } from '@erp/db/schema/hr';
import { AppError } from '@erp/shared/errors';
import { type Result, err, tryCatch } from '@erp/shared/result';
import type { AuditContext } from '@erp/shared/types';
import { and, eq } from 'drizzle-orm';
import { auditRecord } from '../audit';
import { requirePermission } from '../iam';
import { decryptPii } from '../security/pii';

export async function deleteEmployee(
  employeeId: string,
  ctx: AuditContext,
): Promise<Result<{ id: string }>> {
  return tryCatch(
    async () => {
      const [emp] = await db
        .select({
          id: employees.id,
          locationId: employees.locationId,
          email: employees.email,
          nik: employees.nik,
        })
        .from(employees)
        .where(and(eq(employees.id, employeeId), eq(employees.tenantId, ctx.tenantId)))
        .limit(1);

      if (!emp) throw AppError.notFound('hr.employee.notFound');

      const permCheck = await requirePermission(ctx.userId, 'hr.employee.write', {
        locationId: emp.locationId,
      });
      if (!permCheck.ok) throw permCheck.error;

      const email = decryptPii(emp.email, 'employees.email');
      const deletedAt = new Date();
      const deletedSuffix = `_deleted_${Date.now()}`;
      
      // 1. Soft-delete the employee & scramble unique fields
      await db
        .update(employees)
        .set({ 
          status: 'terminated', 
          deletedAt,
          email: `${emp.email}${deletedSuffix}`,
          nik: emp.nik ? `${emp.nik}${deletedSuffix}` : null
        })
        .where(eq(employees.id, employeeId));

      // 2. Soft-delete the associated user account if it exists
      if (email) {
        const [user] = await db
          .select()
          .from(users)
          .where(and(eq(users.tenantId, ctx.tenantId), eq(users.email, email)))
          .limit(1);

        if (user) {
          // Rename the email to free up the unique constraint so the user can be recreated
          const deletedEmail = `${email}${deletedSuffix}`;
          
          await db
            .update(users)
            .set({ 
              status: 'suspended', 
              deletedAt,
              email: deletedEmail 
            })
            .where(eq(users.id, user.id));

          // Revoke roles and auth accounts immediately
          await db.delete(userRoles).where(eq(userRoles.userId, user.id));
          await db.delete(authAccounts).where(eq(authAccounts.userId, user.id));
        }
      }

      await auditRecord({
        action: 'delete',
        entityType: 'employee',
        entityId: emp.id,
        before: null,
        after: { status: 'terminated', deletedAt: deletedAt.toISOString() },
        metadata: { ip: ctx.ipAddress ?? null, userAgent: ctx.userAgent ?? null },
        ctx,
      });

      return { id: emp.id };
    },
    (e) => {
      if (e instanceof AppError) return e;
      return AppError.internal('hr.employee.deleteFailed', e);
    },
  );
}
