import { db } from '@erp/db';
import { users } from '@erp/db/schema/auth';
import { employees } from '@erp/db/schema/hr';
import { and, eq, isNull, or } from 'drizzle-orm';

/**
 * Resolves the given userId to an employee record in the tenant.
 * Matches by encrypted email.
 */
export async function resolveEmployeeForUser(tenantId: string, userId: string) {
  const [requester] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!requester?.email) return null;

  const { encryptPiiForLookup } = await import('../security/pii');
  const encryptedRequester = encryptPiiForLookup(
    requester.email.toLowerCase(),
    'employees.email',
  );

  const [emp] = await db
    .select()
    .from(employees)
    .where(
      and(
        eq(employees.tenantId, tenantId),
        isNull(employees.deletedAt),
        or(
          encryptedRequester ? eq(employees.email, encryptedRequester) : undefined,
          eq(employees.email, requester.email.toLowerCase()),
        )!,
      ),
    )
    .limit(1);

  return emp ?? null;
}
