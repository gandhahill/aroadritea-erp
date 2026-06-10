'use server';

import { getSession } from '@/lib/auth';
import { and, db, eq } from '@erp/db';
import { authAccounts, sessions, users } from '@erp/db/schema/auth';
import { auditRecord } from '@erp/services/audit';
import { hashPassword, verifyPassword } from '@erp/services/auth/password';
import { headers } from 'next/headers';

function passwordMeetsPolicy(password: string): boolean {
  return password.length >= 8 && password.length <= 128;
}

export async function changePasswordAction(input: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}): Promise<{ ok: boolean; error?: string }> {
  const session = await getSession();
  if (!session?.user) return { ok: false, error: 'auth.changePassword.errorServer' };

  if (input.newPassword !== input.confirmPassword) {
    return { ok: false, error: 'auth.changePassword.errorMismatch' };
  }
  if (!passwordMeetsPolicy(input.newPassword)) {
    return { ok: false, error: 'auth.changePassword.errorLength' };
  }

  const userId = String(session.user.id ?? '');
  const [user] = await db
    .select({ id: users.id, passwordHash: users.passwordHash, tenantId: users.tenantId })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) return { ok: false, error: 'auth.changePassword.errorServer' };

  const currentValid = await verifyPassword(user.passwordHash, input.currentPassword);
  if (!currentValid) return { ok: false, error: 'auth.changePassword.errorServer' };

  const newHash = await hashPassword(input.newPassword);
  const now = new Date();

  // 1. Update password & clear force-change flag in users table.
  await db
    .update(users)
    .set({ passwordHash: newHash, requirePasswordChange: false, updatedAt: now })
    .where(eq(users.id, userId));

  // 2. Update password in better-auth accounts table.
  await db
    .update(authAccounts)
    .set({ password: newHash, updatedAt: now })
    .where(and(eq(authAccounts.userId, userId), eq(authAccounts.providerId, 'credential')));

  // 3. Delete ALL sessions for this user from DB.
  //    This invalidates any cached session_data cookie because the session
  //    token will no longer resolve to a valid DB row — better-auth's
  //    getSession flow falls through to findSession(), finds nothing,
  //    and returns null (which triggers the login redirect).
  await db.delete(sessions).where(eq(sessions.userId, userId));

  const headersList = await headers();
  await auditRecord({
    action: 'update',
    entityType: 'user',
    entityId: userId,
    before: null,
    after: null,
    metadata: { event: 'forced_password_change' },
    ctx: {
      userId,
      tenantId: user.tenantId,
      locationId: '',
      ipAddress: headersList.get('x-forwarded-for') ?? undefined,
      userAgent: headersList.get('user-agent') ?? undefined,
    },
  });

  // 4. Delete every auth-related cookie from the browser so the next
  //    request doesn't even try to present a stale session token.
  const { cookies } = await import('next/headers');
  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll();
  for (const c of allCookies) {
    if (c.name.includes('aroadri')) {
      cookieStore.delete(c.name);
    }
  }

  return { ok: true };
}
