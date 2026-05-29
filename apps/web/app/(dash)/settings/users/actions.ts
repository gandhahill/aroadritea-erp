'use server';

import { db } from '@erp/db';
import { users } from '@erp/db/schema/auth';
import { getSession } from '@/lib/auth';
import { eq } from 'drizzle-orm';
import { requirePermission } from '@erp/services/iam';

export async function fetchUsers() {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');

  const perm = await requirePermission(session.userId, 'iam.users.read' as any);
  if (!perm.ok) throw new Error('Forbidden');

  return db
    .select({
      id: users.id,
      displayName: users.displayName,
      email: users.email,
      status: users.status,
    })
    .from(users)
    .where(eq(users.tenantId, session.tenantId));
}
