import { db } from '@erp/db';
import { users } from '@erp/db/schema/auth';
import { employees } from '@erp/db/schema/hr';
import { eq } from 'drizzle-orm';

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

  const tenantEmployees = await db
    .select()
    .from(employees)
    .where(eq(employees.tenantId, tenantId));

  const { encryptPiiForLookup } = await import('../security/pii');
  const encryptedRequester = encryptPiiForLookup(
    requester.email.toLowerCase(),
    'employees.email',
  );

  const emp = tenantEmployees.find(
    (e) =>
      e.email &&
      (e.email === encryptedRequester ||
        e.email.toLowerCase() === requester.email.toLowerCase()),
  );

  return emp ?? null;
}
