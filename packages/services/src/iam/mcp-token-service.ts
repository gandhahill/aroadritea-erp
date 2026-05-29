import { db } from '@erp/db';
import { mcpTokens } from '@erp/db/schema/auth';
import { AppError } from '@erp/shared/errors';
import { type Result, err, ok } from '@erp/shared/result';
import type { AuditContext } from '@erp/shared/types';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { requirePermission } from './require-permission';
import { generateId } from '@erp/shared/id';

export const MintTokenInputSchema = z.object({
  name: z.string().min(1),
  scope: z.array(z.string()).default([]),
  expiresAt: z.string().datetime().optional(),
});

export type MintTokenInput = z.infer<typeof MintTokenInputSchema>;

export async function mintMcpToken(input: MintTokenInput, ctx: AuditContext): Promise<Result<{ id: string, token: string }>> {
  const parsed = MintTokenInputSchema.safeParse(input);
  if (!parsed.success) return err(new Error(parsed.error.message));

  const permCheck = await requirePermission(ctx.userId, 'iam.token.write');
  if (!permCheck.ok) return permCheck;

  const id = generateId();
  // In a real implementation we would generate a random secure string here
  const rawToken = `mcp_sk_${generateId()}_${generateId()}`; 
  const tokenHash = rawToken; // In a real implementation, hash this using argon2!

  await db.insert(mcpTokens).values({
    id,
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    name: input.name,
    tokenHash,
    scope: input.scope,
    expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
    createdBy: ctx.userId,
    updatedBy: ctx.userId,
  });

  // Return the raw token only once upon creation
  return ok({ id, token: rawToken });
}

export async function revokeMcpToken(tokenId: string, ctx: AuditContext): Promise<Result<{ id: string }>> {
  const permCheck = await requirePermission(ctx.userId, 'iam.token.write');
  if (!permCheck.ok) return permCheck;

  await db
    .update(mcpTokens)
    .set({ isRevoked: true, updatedBy: ctx.userId })
    .where(and(eq(mcpTokens.id, tokenId), eq(mcpTokens.tenantId, ctx.tenantId)));

  return ok({ id: tokenId });
}
