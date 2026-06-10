import { db } from '@erp/db';
import { authAccounts, userRoles, users } from '@erp/db/schema/auth';
import { hashPassword, verifyPassword } from '@erp/services/auth/password';
import { AppError } from '@erp/shared/errors';
import { type Result, err, ok, tryCatch } from '@erp/shared/result';
import type { AuditContext } from '@erp/shared/types';
import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { auditRecord } from '../audit';
import { requirePermission } from './require-permission';

const ChangeMyPasswordSchema = z.object({
  oldPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

const AdminResetPasswordSchema = z.object({
  userId: z.string().min(1),
  newPassword: z.string().min(8),
});

/**
 * Self-Service: Karyawan mengubah passwordnya sendiri.
 */
export async function changeMyPassword(
  input: z.infer<typeof ChangeMyPasswordSchema>,
  ctx: AuditContext,
): Promise<Result<{ success: boolean }>> {
  const parsed = ChangeMyPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      AppError.validation('iam.password.validationFailed', { issues: parsed.error.issues }),
    );
  }
  const { oldPassword, newPassword } = parsed.data;

  return tryCatch(
    async () => {
      const [user] = await db
        .select({ id: users.id, passwordHash: users.passwordHash })
        .from(users)
        .where(and(eq(users.id, ctx.userId), eq(users.tenantId, ctx.tenantId)))
        .limit(1);

      if (!user) {
        throw AppError.notFound('iam.user.notFound');
      }

      // Verifikasi password lama
      const isValid = await verifyPassword(user.passwordHash, oldPassword);
      if (!isValid) {
        throw AppError.validation('iam.password.invalidOldPassword');
      }

      const newHash = await hashPassword(newPassword);

      await db
        .update(users)
        .set({
          passwordHash: newHash,
          updatedAt: new Date(),
          updatedBy: ctx.userId,
        })
        .where(eq(users.id, ctx.userId));

      await db
        .update(authAccounts)
        .set({
          password: newHash,
          updatedAt: new Date(),
        })
        .where(and(eq(authAccounts.userId, ctx.userId), eq(authAccounts.providerId, 'credential')));

      await auditRecord({
        action: 'update',
        entityType: 'user',
        entityId: ctx.userId,
        before: null, // Jangan rekam password hash di log
        after: null,
        metadata: { ip: ctx.ipAddress ?? null, userAgent: ctx.userAgent ?? null },
        ctx,
      });

      return { success: true };
    },
    (e) => {
      if (e instanceof AppError) return e;
      return AppError.internal('iam.password.changeFailed', e);
    },
  );
}

/**
 * Admin HR: Mereset password karyawan.
 */
export async function adminResetPassword(
  input: z.infer<typeof AdminResetPasswordSchema>,
  ctx: AuditContext,
): Promise<Result<{ success: boolean }>> {
  const parsed = AdminResetPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      AppError.validation('iam.password.validationFailed', { issues: parsed.error.issues }),
    );
  }
  const { userId, newPassword } = parsed.data;

  return tryCatch(
    async () => {
      // Lookup target user's locationId
      const roleRows = await db
        .select({ locationId: userRoles.locationId })
        .from(userRoles)
        .where(eq(userRoles.userId, userId))
        .limit(1);
      const targetLocationId = roleRows[0]?.locationId ?? undefined;

      const permCheck = await requirePermission(ctx.userId, 'hr.employee.write', {
        locationId: targetLocationId,
      });
      if (!permCheck.ok) {
        throw permCheck.error;
      }

      const [user] = await db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.id, userId), eq(users.tenantId, ctx.tenantId)))
        .limit(1);

      if (!user) {
        throw AppError.notFound('iam.user.notFound');
      }

      const newHash = await hashPassword(newPassword);

      await db
        .update(users)
        .set({
          passwordHash: newHash,
          requirePasswordChange: true, // Wajib ganti password setelah direset admin
          updatedAt: new Date(),
          updatedBy: ctx.userId,
        })
        .where(eq(users.id, userId));

      await db
        .update(authAccounts)
        .set({
          password: newHash,
          updatedAt: new Date(),
        })
        .where(and(eq(authAccounts.userId, userId), eq(authAccounts.providerId, 'credential')));

      await auditRecord({
        action: 'update',
        entityType: 'user',
        entityId: userId,
        before: null,
        after: null,
        metadata: { ip: ctx.ipAddress ?? null, userAgent: ctx.userAgent ?? null },
        ctx,
      });

      return { success: true };
    },
    (e) => {
      if (e instanceof AppError) return e;
      return AppError.internal('iam.password.resetFailed', e);
    },
  );
}
