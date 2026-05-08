/**
 * MCP Auth — API token verification via SHA-256 hash.
 * SD §16.3: Tools accept apiToken; server resolves token → user → permissions.
 *
 * Token format: aroadri_<env>_<base64url(32 bytes random)>
 * Stored as SHA-256 hash in api_tokens table.
 */

import { createHash } from 'node:crypto';
import { eq, and, isNull, or, gt } from 'drizzle-orm';
import { db } from '@erp/db';
import { apiTokens } from '@erp/db/schema/auth';

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

  const row = await db.query.apiTokens.findFirst({
    where: and(
      eq(apiTokens.tokenHash, tokenHash),
      isNull(apiTokens.revokedAt),
      or(
        isNull(apiTokens.expiresAt),
        gt(apiTokens.expiresAt, now),
      ),
    ),
    with: {
      user: true,
    },
  });

  if (!row || !row.user || row.user.status !== 'active') {
    return null;
  }

  // Update last_used_at (fire-and-forget)
  await db.update(apiTokens)
    .set({ lastUsedAt: now })
    .where(eq(apiTokens.id, row.id));

  return {
    userId: row.user.id,
    tenantId: row.user.tenantId,
    locale: row.user.locale,
  };
}

/**
 * Generate a new API token string.
 * Format: aroadri_<env>_<base64url(32 bytes)>
 * Store only the SHA-256 hash in the database.
 */
export function generateRawToken(): string {
  const randomBytes = Buffer.alloc(32);
  require('node:crypto').randomFillSync(randomBytes);
  const env = process.env.NODE_ENV ?? 'development';
  const randomPart = randomBytes.toString('base64url');
  return `aroadri_${env}_${randomPart}`;
}
