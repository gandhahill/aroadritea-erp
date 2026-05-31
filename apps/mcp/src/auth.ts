/**
 * MCP Auth — API token verification via SHA-256 hash.
 * SD §16.3: Tools accept apiToken; server resolves token → user → permissions.
 *
 * Token format: aroadri_<env>_<base64url(32 bytes random)>
 * Stored as SHA-256 hash in api_tokens table.
 */

import { createHash, randomFillSync } from 'node:crypto';
import { db } from '@erp/db';
import { apiTokens, users } from '@erp/db/schema/auth';
import { and, eq, gt, isNull, or } from 'drizzle-orm';

export interface TokenUser {
  userId: string;
  tenantId: string;
  locale: string;
}

/** Hash a raw token with SHA-256. */
export function hashToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}

/**
 * Verify an API token and return the associated user.
 * Returns null if token is invalid, expired, or revoked.
 */
export async function verifyToken(rawToken: string): Promise<TokenUser | null> {
  const tokenHash = hashToken(rawToken);
  const now = new Date();

  try {
    // Plain join instead of Drizzle relational API (avoids LEFT JOIN LATERAL issues)
    const rows = await db
      .select({
        tokenId: apiTokens.id,
        userId: users.id,
        tenantId: users.tenantId,
        locale: users.locale,
        userStatus: users.status,
      })
      .from(apiTokens)
      .innerJoin(users, eq(apiTokens.userId, users.id))
      .where(
        and(
          eq(apiTokens.tokenHash, tokenHash),
          isNull(apiTokens.revokedAt),
          or(isNull(apiTokens.expiresAt), gt(apiTokens.expiresAt, now)),
        ),
      )
      .limit(1);

    const row = rows[0];
    if (!row || row.userStatus !== 'active') {
      return null;
    }

    // Update last_used_at (fire-and-forget)
    db.update(apiTokens)
      .set({ lastUsedAt: now })
      .where(eq(apiTokens.id, row.tokenId))
      .catch(() => {});

    return {
      userId: row.userId,
      tenantId: row.tenantId,
      locale: row.locale,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[MCP Auth] verifyToken failed:', msg);
    return null;
  }
}

/**
 * Generate a new API token string.
 * Format: aroadri_<env>_<base64url(32 bytes)>
 * Store only the SHA-256 hash in the database.
 */
export function generateRawToken(): string {
  const buf = Buffer.alloc(32);
  randomFillSync(buf);
  const env = process.env.NODE_ENV ?? 'development';
  const randomPart = buf.toString('base64url');
  return `aroadri_${env}_${randomPart}`;
}
