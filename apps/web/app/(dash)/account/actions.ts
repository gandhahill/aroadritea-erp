'use server';

import { getSession } from '@/lib/auth';
import { and, db, desc, eq, not } from '@erp/db';
import { auditLog } from '@erp/db/schema/audit';
import { authAccounts, sessions, users } from '@erp/db/schema/auth';
import { hashPassword, verifyPassword } from '@erp/services/auth/password';
import { headers } from 'next/headers';
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

  // B24 best-practice — invalidate every other active session whenever
  // the password changes. The current session keeps the cookie because
  // the user is presumably still at their desk; everywhere else has to
  // re-authenticate with the new password.
  await revokeAllOtherSessionsForUser(userId, tenantId, /* auditAs */ 'password_change');

  return { ok: true, message: 'account.passwordSaved' };
}

// ─── B24 — Session management (multi-device list + revoke) ───────────────

/** What the UI renders in the session list — no secret values exposed. */
export interface SessionListRow {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
  expiresAt: string;
  isCurrent: boolean;
}

async function currentSessionToken(): Promise<string | null> {
  const hdrs = await headers();
  const cookie = hdrs.get('cookie') ?? '';
  // The cookie name set by better-auth — match either the http or
  // __Secure variant used in production.
  const match = cookie.match(
    /(?:^|; )(?:__Secure-)?aroadri\.session_token=([^;]+)/,
  );
  return match?.[1] ?? null;
}

export async function listMySessions(): Promise<SessionListRow[]> {
  const session = await getSession();
  if (!session?.user) return [];
  const userId = String((session.user as Record<string, unknown>).id ?? '');
  const currentToken = await currentSessionToken();

  const rows = await db
    .select({
      id: sessions.id,
      token: sessions.token,
      userAgent: sessions.userAgent,
      ipAddress: sessions.ipAddress,
      createdAt: sessions.createdAt,
      expiresAt: sessions.expiresAt,
    })
    .from(sessions)
    .where(eq(sessions.userId, userId))
    .orderBy(desc(sessions.createdAt));

  return rows.map((r) => ({
    id: r.id,
    userAgent: r.userAgent,
    ipAddress: r.ipAddress,
    createdAt: r.createdAt.toISOString(),
    expiresAt: r.expiresAt.toISOString(),
    // Don't leak the token — only flag whether it matches.
    isCurrent: currentToken !== null && r.token === currentToken,
  }));
}

export async function revokeSessionAction(
  sessionId: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!sessionId) return { ok: false, error: 'invalid_id' };
  const session = await getSession();
  if (!session?.user) return { ok: false, error: 'unauthenticated' };
  const userId = String((session.user as Record<string, unknown>).id ?? '');
  const tenantId = String((session.user as Record<string, unknown>).tenantId ?? 'default');
  const currentToken = await currentSessionToken();

  // Refuse to revoke the caller's *current* session via this entry
  // point — that's what /api/auth/sign-out is for and a single click
  // shouldn't kick the user out by accident.
  const [target] = await db
    .select({ id: sessions.id, userId: sessions.userId, token: sessions.token })
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);
  if (!target || target.userId !== userId) {
    return { ok: false, error: 'not_found' };
  }
  if (currentToken && target.token === currentToken) {
    return { ok: false, error: 'cannot_revoke_current' };
  }

  await db.delete(sessions).where(eq(sessions.id, sessionId));

  await db.insert(auditLog).values({
    id: crypto.randomUUID(),
    tenantId,
    userId,
    action: 'delete',
    entityType: 'user_session',
    entityId: sessionId,
    before: { revokedSessionId: sessionId },
    after: { reason: 'user_revoke', via: '/account/sessions' },
  });

  revalidatePath('/account');
  return { ok: true };
}

export async function revokeAllOtherSessionsAction(): Promise<{
  ok: boolean;
  revoked?: number;
  error?: string;
}> {
  const session = await getSession();
  if (!session?.user) return { ok: false, error: 'unauthenticated' };
  const userId = String((session.user as Record<string, unknown>).id ?? '');
  const tenantId = String((session.user as Record<string, unknown>).tenantId ?? 'default');
  const revoked = await revokeAllOtherSessionsForUser(userId, tenantId, 'user_logout_everywhere');
  revalidatePath('/account');
  return { ok: true, revoked };
}

async function revokeAllOtherSessionsForUser(
  userId: string,
  tenantId: string,
  reason: 'password_change' | 'user_logout_everywhere',
): Promise<number> {
  const currentToken = await currentSessionToken();

  const conditions = [eq(sessions.userId, userId)];
  if (currentToken) conditions.push(not(eq(sessions.token, currentToken)));

  const targets = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(and(...conditions));
  if (targets.length === 0) return 0;

  await db.delete(sessions).where(and(...conditions));

  // Single audit row per session so the trail stays granular.
  for (const t of targets) {
    try {
      await db.insert(auditLog).values({
        id: crypto.randomUUID(),
        tenantId,
        userId,
        action: 'delete',
        entityType: 'user_session',
        entityId: t.id,
        before: null,
        after: { reason },
      });
    } catch {
      // best-effort
    }
  }

  return targets.length;
}
