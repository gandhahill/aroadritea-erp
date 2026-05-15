'use server';

import { getSession } from '@/lib/auth';
import { and, db, eq } from '@erp/db';
import { auditLog } from '@erp/db/schema/audit';
import { authAccounts, users } from '@erp/db/schema/auth';
import { hashPassword, verifyPassword } from '@erp/services/auth/password';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const ProfileSchema = z.object({
  displayName: z.string().min(2).max(120),
  locale: z.enum(['id', 'en', 'zh']),
});

const EmailSchema = z.object({
  email: z.string().email().max(254),
  currentPassword: z.string().min(1),
});

const PasswordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(12).max(128),
    confirmPassword: z.string().min(12).max(128),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    path: ['confirmPassword'],
    message: 'passwordMismatch',
  });

type ActionResult = { ok: true; message: string } | { ok: false; message: string };

async function requireCurrentUser() {
  const session = await getSession();
  if (!session) throw new Error('Unauthenticated');
  const sessionUser = session.user as Record<string, unknown>;
  const userId = String(sessionUser.id ?? '');
  const tenantId = String(sessionUser.tenantId ?? 'default');
  const [row] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!row) throw new Error('User not found');
  return { row, userId, tenantId };
}

async function assertPassword(userId: string, password: string): Promise<boolean> {
  const [account] = await db
    .select({ password: authAccounts.password })
    .from(authAccounts)
    .where(and(eq(authAccounts.userId, userId), eq(authAccounts.providerId, 'credential')))
    .limit(1);

  const hash = account?.password;
  if (!hash) return false;
  return verifyPassword(hash, password);
}

function formString(formData: FormData, key: string): string {
  return String(formData.get(key) ?? '').trim();
}

export async function updateProfileAction(
  _state: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = ProfileSchema.safeParse({
    displayName: formString(formData, 'displayName'),
    locale: formString(formData, 'locale'),
  });
  if (!parsed.success) return { ok: false, message: 'account.validationFailed' };

  const { row, userId, tenantId } = await requireCurrentUser();
  const before = { displayName: row.displayName, locale: row.locale };

  await db
    .update(users)
    .set({
      displayName: parsed.data.displayName,
      locale: parsed.data.locale,
      updatedAt: new Date(),
      updatedBy: userId,
    })
    .where(eq(users.id, userId));

  await db.insert(auditLog).values({
    id: crypto.randomUUID(),
    tenantId,
    userId,
    action: 'update',
    entityType: 'user_profile',
    entityId: userId,
    before,
    after: parsed.data,
  });

  revalidatePath('/account');
  return { ok: true, message: 'account.profileSaved' };
}

export async function updateEmailAction(
  _state: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = EmailSchema.safeParse({
    email: formString(formData, 'email').toLowerCase(),
    currentPassword: String(formData.get('currentPassword') ?? ''),
  });
  if (!parsed.success) return { ok: false, message: 'account.validationFailed' };

  const { row, userId, tenantId } = await requireCurrentUser();
  const passwordOk = await assertPassword(userId, parsed.data.currentPassword);
  if (!passwordOk) return { ok: false, message: 'account.currentPasswordWrong' };

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, parsed.data.email))
    .limit(1);
  if (existing && existing.id !== userId) return { ok: false, message: 'account.emailInUse' };

  await db
    .update(users)
    .set({
      email: parsed.data.email,
      emailVerified: null,
      updatedAt: new Date(),
      updatedBy: userId,
    })
    .where(eq(users.id, userId));

  await db.insert(auditLog).values({
    id: crypto.randomUUID(),
    tenantId,
    userId,
    action: 'update',
    entityType: 'user_email',
    entityId: userId,
    before: { email: row.email },
    after: { email: parsed.data.email },
  });

  revalidatePath('/account');
  return { ok: true, message: 'account.emailSaved' };
}

export async function updatePasswordAction(
  _state: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = PasswordSchema.safeParse({
    currentPassword: String(formData.get('currentPassword') ?? ''),
    newPassword: String(formData.get('newPassword') ?? ''),
    confirmPassword: String(formData.get('confirmPassword') ?? ''),
  });
  if (!parsed.success) {
    const mismatch = parsed.error.issues.some((issue) => issue.message === 'passwordMismatch');
    return {
      ok: false,
      message: mismatch ? 'account.passwordMismatch' : 'account.passwordTooShort',
    };
  }

  const { userId, tenantId } = await requireCurrentUser();
  const passwordOk = await assertPassword(userId, parsed.data.currentPassword);
  if (!passwordOk) return { ok: false, message: 'account.currentPasswordWrong' };

  const passwordHash = await hashPassword(parsed.data.newPassword);
  await db
    .update(users)
    .set({ passwordHash, updatedAt: new Date(), updatedBy: userId })
    .where(eq(users.id, userId));

  await db
    .update(authAccounts)
    .set({ password: passwordHash, updatedAt: new Date() })
    .where(and(eq(authAccounts.userId, userId), eq(authAccounts.providerId, 'credential')));

  await db.insert(auditLog).values({
    id: crypto.randomUUID(),
    tenantId,
    userId,
    action: 'update',
    entityType: 'user_password',
    entityId: userId,
    before: { changed: false },
    after: { changed: true },
  });

  return { ok: true, message: 'account.passwordSaved' };
}
