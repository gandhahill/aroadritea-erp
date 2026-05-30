/**
 * hr.hardDeleteEmployee — SD §9.6, §21.8
 *
 * Permanently deletes an employee and their corresponding user account IF AND ONLY IF 
 * they have no transactional history (payrolls, attendances, etc).
 * Permission: hr.employee.write (global or scoped to employee's location)
 */

import { db } from '@erp/db';
import { authAccounts, userRoles, users } from '@erp/db/schema/auth';
import { 
  employees, 
  employmentContracts, 
  attendance, 
  payrollLines, 
  leaveRequests, 
  disciplinaryActions, 
  cashAdvances, 
  shiftAssignments 
} from '@erp/db/schema/hr';
import { AppError } from '@erp/shared/errors';
import { type Result, err, tryCatch } from '@erp/shared/result';
import type { AuditContext } from '@erp/shared/types';
import { and, eq } from 'drizzle-orm';
import { auditRecord } from '../audit';
import { requirePermission } from '../iam';
import { decryptPii } from '../security/pii';

export async function hardDeleteEmployee(
  employeeId: string,
  ctx: AuditContext,
): Promise<Result<{ id: string }>> {
  return tryCatch(
    async () => {
      // 1. Initial permission check
      await requirePermission(ctx.userId, 'hr.employee.write');

      const [emp] = await db
        .select()
        .from(employees)
        .where(and(eq(employees.tenantId, ctx.tenantId), eq(employees.id, employeeId)))
        .limit(1);

      if (!emp) throw AppError.notFound('hr.employee.notFound');

      // 2. Scoped location check
      if (emp.locationId) {
        await requirePermission(ctx.userId, 'hr.employee.write', { locationId: emp.locationId });
      }

      // 3. Validation: Prevent hard delete if ANY transactional records exist
      const queries = await Promise.all([
        db.select({ id: attendance.id }).from(attendance).where(eq(attendance.employeeId, employeeId)).limit(1),
        db.select({ id: payrollLines.id }).from(payrollLines).where(eq(payrollLines.employeeId, employeeId)).limit(1),
        db.select({ id: leaveRequests.id }).from(leaveRequests).where(eq(leaveRequests.employeeId, employeeId)).limit(1),
        db.select({ id: disciplinaryActions.id }).from(disciplinaryActions).where(eq(disciplinaryActions.employeeId, employeeId)).limit(1),
        db.select({ id: cashAdvances.id }).from(cashAdvances).where(eq(cashAdvances.employeeId, employeeId)).limit(1),
        db.select({ id: shiftAssignments.id }).from(shiftAssignments).where(eq(shiftAssignments.employeeId, employeeId)).limit(1),
      ]);

      const hasHistory = queries.some(result => result.length > 0);
      
      if (hasHistory) {
        throw AppError.validation('hr.employee.hardDeleteBlocked');
      }

      const email = decryptPii(emp.email, 'employees.email');

      // 4. Perform Hard Delete in transaction
      await db.transaction(async (tx) => {
        // Delete employment contracts
        await tx.delete(employmentContracts).where(eq(employmentContracts.employeeId, employeeId));

        // Delete associated user account if it exists (using the decrypted email)
        if (email) {
          const [user] = await tx
            .select({ id: users.id })
            .from(users)
            .where(and(eq(users.tenantId, ctx.tenantId), eq(users.email, email)))
            .limit(1);

          if (user) {
            await tx.delete(userRoles).where(eq(userRoles.userId, user.id));
            await tx.delete(authAccounts).where(eq(authAccounts.userId, user.id));
            await tx.delete(users).where(eq(users.id, user.id));
          }
        }

        // Finally, delete the employee record itself
        await tx.delete(employees).where(eq(employees.id, employeeId));
      });

      // 5. Audit log for hard delete
      await auditRecord({
        action: 'delete',
        entityType: 'employee',
        entityId: emp.id,
        before: null,
        after: { status: 'HARD_DELETED' },
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
