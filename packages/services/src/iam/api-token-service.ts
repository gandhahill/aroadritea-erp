/**
 * API / MCP token service — SD §16.3.
 *
 * Tokens are personal: each token belongs to one user and inherits that user's
 * permission scope when used by the MCP server (apps/mcp resolves token → user).
 * The raw token is shown ONCE at creation; only its SHA-256 hash is stored
 * (same scheme as apps/mcp/src/auth.ts so minted tokens verify there).
 */

import { createHash, randomFillSync } from 'node:crypto';
import { db } from '@erp/db';
import { apiTokens } from '@erp/db/schema/auth';
import { AppError } from '@erp/shared/errors';
import { type Result, err, tryCatch } from '@erp/shared/result';
import type { AuditContext } from '@erp/shared/types';
import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { generateId } from '@erp/shared/id';
import { auditRecord } from '../audit';

/** SHA-256 hex hash of a raw token. Must match apps/mcp/src/auth.ts. */
export function hashApiToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}

/** Generate a high-entropy raw token: aroadri_<env>_<base64url(32 bytes)>. */
export function generateApiToken(): string {
  const buf = Buffer.alloc(32);
  randomFillSync(buf);
  const env = process.env.NODE_ENV ?? 'development';
  return `aroadri_${env}_${buf.toString('base64url')}`;
}

export const MintApiTokenSchema = z.object({
  name: z.string().min(1).max(80),
  expiresAt: z.string().datetime().optional(),
});
export type MintApiTokenInput = z.infer<typeof MintApiTokenSchema>;

/** Create a new personal MCP token for the calling user. Returns the raw token ONCE. */
export async function mintApiToken(
  input: MintApiTokenInput,
  ctx: AuditContext,
): Promise<Result<{ id: string; token: string }>> {
  const parsed = MintApiTokenSchema.safeParse(input);
  if (!parsed.success) {
    return err(AppError.validation('settings.mcpTokens.errors.invalid', { issues: parsed.error.issues }));
  }
  return tryCatch(
    async () => {
      const id = generateId();
      const raw = generateApiToken();
      await db.insert(apiTokens).values({
        id,
        userId: ctx.userId,
        name: parsed.data.name,
        tokenHash: hashApiToken(raw),
        scopeJson: null, // null = inherits the user's full permission set
        expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
      });
      await auditRecord({
        action: 'create',
        entityType: 'api_token',
        entityId: id,
        before: null,
        after: { name: parsed.data.name },
        ctx,
      });
      return { id, token: raw };
    },
    (e) => (e instanceof AppError ? e : AppError.internal('settings.mcpTokens.errors.mintFailed', e)),
  );
}

/** List the calling user's own tokens (no secrets returned). */
export async function listApiTokens(userId: string) {
  return db
    .select({
      id: apiTokens.id,
      name: apiTokens.name,
      createdAt: apiTokens.createdAt,
      lastUsedAt: apiTokens.lastUsedAt,
      expiresAt: apiTokens.expiresAt,
      revokedAt: apiTokens.revokedAt,
    })
    .from(apiTokens)
    .where(eq(apiTokens.userId, userId))
    .orderBy(desc(apiTokens.createdAt));
}

/** Revoke (soft-disable) one of the calling user's tokens. */
export async function revokeApiToken(
  tokenId: string,
  ctx: AuditContext,
): Promise<Result<{ id: string }>> {
  return tryCatch(
    async () => {
      const [existing] = await db
        .select({ id: apiTokens.id, name: apiTokens.name, revokedAt: apiTokens.revokedAt })
        .from(apiTokens)
        .where(and(eq(apiTokens.id, tokenId), eq(apiTokens.userId, ctx.userId)))
        .limit(1);
      if (!existing) throw AppError.notFound('settings.mcpTokens.errors.notFound');
      if (!existing.revokedAt) {
        const now = new Date();
        await db.update(apiTokens).set({ revokedAt: now }).where(eq(apiTokens.id, tokenId));
        await auditRecord({
          action: 'deactivate',
          entityType: 'api_token',
          entityId: tokenId,
          before: { name: existing.name },
          after: { revokedAt: now.toISOString() },
          ctx,
        });
      }
      return { id: tokenId };
    },
    (e) => (e instanceof AppError ? e : AppError.internal('settings.mcpTokens.errors.revokeFailed', e)),
  );
}
