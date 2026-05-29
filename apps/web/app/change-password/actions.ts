'use server';

import { getSession } from '@/lib/auth';
import { and, db, eq } from '@erp/db';
import { authAccounts, users } from '@erp/db/schema/auth';
import { hashPassword, verifyPassword } from '@erp/services/auth/password';
import { revalidatePath } from 'next/cache';

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
    .select({ id: users.id, passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) return { ok: false, error: 'auth.changePassword.errorServer' };

  const currentValid = await verifyPassword(user.passwordHash, input.currentPassword);
  if (!currentValid) return { ok: false, error: 'auth.changePassword.errorServer' };

  const passwordHash = await hashPassword(input.newPassword);
  const now = new Date();

  await db
    .update(users)
    .set({ passwordHash, requirePasswordChange: false, updatedAt: now })
    .where(eq(users.id, userId));

  await db
    .update(authAccounts)
    .set({ password: passwordHash, updatedAt: now })
    .where(and(eq(authAccounts.userId, userId), eq(authAccounts.providerId, 'credential')));

  // Clear better-auth session cache cookie so the next getSession() reads the updated DB row
  const { cookies } = await import('next/headers');
  const cookieStore = await cookies();
  cookieStore.delete('aroadri.session_data');
  cookieStore.delete('__Secure-aroadri.session_data');

  revalidatePath('/', 'layout');
  return { ok: true };
}
