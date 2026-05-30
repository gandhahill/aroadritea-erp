import { db } from '@erp/db';
import { users, userRoles } from '@erp/db/schema/auth';
import { AppError } from '@erp/shared/errors';
import { type Result, err, ok } from '@erp/shared/result';
import type { AuditContext } from '@erp/shared/types';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { requirePermission } from './require-permission';
import { generateId } from '@erp/shared/id';

export const CreateUserInputSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  passwordHash: z.string().min(1), // Should be pre-hashed in actual implementation (e.g., argon2)
});

export type CreateUserInput = z.infer<typeof CreateUserInputSchema>;

export async function createUser(input: CreateUserInput, ctx: AuditContext): Promise<Result<{ id: string }>> {
  const parsed = CreateUserInputSchema.safeParse(input);
  if (!parsed.success) return err(AppError.validation(parsed.error.message));

  const permCheck = await requirePermission(ctx.userId, 'iam.manage_users');
  if (!permCheck.ok) return permCheck;

  const id = generateId();
  await db.insert(users).values({
    id,
    tenantId: ctx.tenantId,
    displayName: input.name,
    email: input.email,
    passwordHash: input.passwordHash,
    status: 'suspended',
  });

  return ok({ id });
}

export async function suspendUser(userId: string, ctx: AuditContext): Promise<Result<{ id: string }>> {
  const permCheck = await requirePermission(ctx.userId, 'iam.manage_users');
  if (!permCheck.ok) return permCheck;

  await db
    .update(users)
    .set({ status: 'suspended' })
    .where(and(eq(users.id, userId), eq(users.tenantId, ctx.tenantId)));

  return ok({ id: userId });
}

export const AssignRoleInputSchema = z.object({
  userId: z.string().min(1),
  roleId: z.string().min(1),
  locationId: z.string().optional(), // If null, it's a global role
});

export type AssignRoleInput = z.infer<typeof AssignRoleInputSchema>;

export async function assignRole(input: AssignRoleInput, ctx: AuditContext): Promise<Result<{ id: string }>> {
  const parsed = AssignRoleInputSchema.safeParse(input);
  if (!parsed.success) return err(AppError.validation(parsed.error.message));

  const permCheck = await requirePermission(ctx.userId, 'iam.manage_users');
  if (!permCheck.ok) return permCheck;

  await db.insert(userRoles).values({
    userId: input.userId,
    roleId: input.roleId,
    locationId: input.locationId ?? null,
  });

  return ok({ id: input.userId });
}
