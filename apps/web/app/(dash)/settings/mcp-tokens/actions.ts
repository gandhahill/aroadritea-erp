'use server';

import { db } from '@erp/db';
import { mcpTokens } from '@erp/db/schema/auth';
import { getSession } from '@/lib/auth';
import { eq } from 'drizzle-orm';
import { requirePermission } from '@erp/services/iam';

export async function fetchMcpTokens() {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');

  const perm = await requirePermission(String(session.user?.id), 'iam.users.read' as any);
  if (!perm.ok) throw new Error('Forbidden');

  return db
    .select({
      id: mcpTokens.id,
      name: mcpTokens.name,
      createdAt: mcpTokens.createdAt,
      lastUsedAt: mcpTokens.lastUsedAt,
    })
    .from(mcpTokens)
    .where(eq(mcpTokens.tenantId, String(session.user?.tenantId)));
}
