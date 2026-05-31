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
import { and, eq, isNull } from 'drizzle-orm';
import { auditRecord } from '../audit';
import { requirePermission } from '../iam';
import { decryptPii, encryptPiiForLookup } from '../security/pii';

export async function deleteEmployee(
  employeeId: string,
  ctx: AuditContext,
): Promise<Result<{ id: string }>> {
  return tryCatch(
    async () => {
      const permCheck = await requirePermission(ctx.userId, 'hr.employee.write');
      if (!permCheck.ok) throw permCheck.error;

      const [emp] = await db
        .select()
        .from(employees)
        .where(and(eq(employees.tenantId, ctx.tenantId), eq(employees.id, employeeId), isNull(employees.deletedAt)))
        .limit(1);

      if (!emp) throw AppError.notFound('hr.employee.notFound');

      // Pengecekan scope location
      if (emp.locationId) {
        const locPermCheck = await requirePermission(ctx.userId, 'hr.employee.write', { locationId: emp.locationId });
        if (!locPermCheck.ok) throw locPermCheck.error;
      }

      const email = decryptPii(emp.email, 'employees.email');
      const nik = emp.nik ? decryptPii(emp.nik, 'employees.nik') : null;
      const deletedSuffix = `_deleted_${Date.now()}`;
      const deletedAt = new Date();

      // Enkripsi kembali dengan suffix untuk menghindari unique constraint
      const scrambledEmail = encryptPiiForLookup(email ? `${email}${deletedSuffix}` : `deleted_${deletedSuffix}`, 'employees.email') ?? `deleted_${deletedSuffix}`;
      const scrambledNik = nik ? (encryptPiiForLookup(`${nik}${deletedSuffix}`, 'employees.nik') ?? null) : null;

      await db.transaction(async (tx) => {
        // 1. Soft-delete the employee & scramble unique fields
        await tx
          .update(employees)
          .set({ 
            status: 'terminated', 
            deletedAt,
            email: scrambledEmail,
            nik: scrambledNik
          })
          .where(eq(employees.id, employeeId));

        // 2. Soft-delete the associated user account if it exists
        if (email) {
          const [user] = await tx
            .select()
            .from(users)
            .where(and(eq(users.tenantId, ctx.tenantId), eq(users.email, email)))
            .limit(1);

          if (user) {
            // Rename the email to free up the unique constraint so the user can be recreated
            const deletedEmail = `${email}${deletedSuffix}`;
            
            await tx
              .update(users)
              .set({ 
                status: 'suspended', 
                deletedAt,
                email: deletedEmail 
              })
              .where(eq(users.id, user.id));

            // Revoke roles and auth accounts immediately
            await tx.delete(userRoles).where(eq(userRoles.userId, user.id));
            await tx.delete(authAccounts).where(eq(authAccounts.userId, user.id));
          }
        }
      });

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
