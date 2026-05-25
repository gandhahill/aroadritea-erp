/**
 * Targeted notification helper — T-0175.
 *
 * Insert one in-app `user_notifications` row for a specific user and,
 * optionally, send them a transactional email. Designed for "we just
 * scheduled / changed / cancelled YOUR shift for tomorrow" style
 * messages where the audience is a single person, in contrast to
 * `notifyByPermission` which fans out by role.
 *
 * The email send is best-effort: a failure logs but does not undo the
 * in-app notification (the user can still see it in the bell icon when
 * they open the dashboard).
 */

import { db } from '@erp/db';
import { users } from '@erp/db/schema/auth';
import { userNotifications } from '@erp/db/schema/notification';
import { generateId } from '@erp/shared/id';
import { and, eq } from 'drizzle-orm';
import { sendTransactionalEmail } from './email-transport';

export interface NotifyUserInput {
  tenantId: string;
  /** ERP user id (auth.users.id). When you only have the email, use
   *  `notifyUserByEmail` below — it resolves to a userId first. */
  userId: string;
  kind: string;
  title: string;
  body?: string;
  link?: string;
  email?: {
    /** Override the email recipient. Defaults to the user's email. */
    to?: string;
    subject: string;
    text: string;
    html: string;
  };
}

export interface NotifyUserResult {
  ok: boolean;
  notificationId?: string;
  emailOk?: boolean;
  emailError?: string;
}

export async function notifyUser(input: NotifyUserInput): Promise<NotifyUserResult> {
  const id = generateId();
  try {
    await db.insert(userNotifications).values({
      id,
      tenantId: input.tenantId,
      userId: input.userId,
      kind: input.kind,
      title: input.title.slice(0, 240),
      body: input.body?.slice(0, 2000) ?? null,
      link: input.link ?? null,
      createdBy: 'system',
      updatedBy: 'system',
    });
  } catch {
    return { ok: false };
  }

  if (!input.email) return { ok: true, notificationId: id };

  let recipient = input.email.to;
  if (!recipient) {
    const [user] = await db
      .select({ email: users.email, status: users.status })
      .from(users)
      .where(and(eq(users.id, input.userId), eq(users.tenantId, input.tenantId)))
      .limit(1);
    if (!user || user.status !== 'active' || !user.email) {
      return { ok: true, notificationId: id, emailOk: false, emailError: 'no_active_email' };
    }
    recipient = user.email;
  }

  const sendResult = await sendTransactionalEmail({
    to: recipient,
    subject: input.email.subject,
    text: input.email.text,
    html: input.email.html,
  });
  if (!sendResult.ok) {
    return { ok: true, notificationId: id, emailOk: false, emailError: sendResult.error };
  }
  return { ok: true, notificationId: id, emailOk: true };
}

/**
 * Convenience: resolve a user by email (case-insensitive) then notify.
 * Returns `ok: true` with `notificationId: undefined` when the email
 * is not registered as a user — caller decides whether that's an
 * error (e.g. an HR admin tried to notify an employee whose login
 * account doesn't exist yet).
 */
export async function notifyUserByEmail(input: {
  tenantId: string;
  email: string;
  kind: string;
  title: string;
  body?: string;
  link?: string;
  email_template?: { subject: string; text: string; html: string };
}): Promise<NotifyUserResult> {
  const normalised = input.email.trim().toLowerCase();
  const [user] = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(and(eq(users.tenantId, input.tenantId), eq(users.email, normalised)))
    .limit(1);
  if (!user) {
    // Optional: send email anyway even if there's no ERP login. This
    // covers staff whose accounts haven't been provisioned yet.
    if (input.email_template) {
      const send = await sendTransactionalEmail({
        to: input.email,
        subject: input.email_template.subject,
        text: input.email_template.text,
        html: input.email_template.html,
      });
      return { ok: true, emailOk: send.ok, emailError: send.error };
    }
    return { ok: true };
  }
  return notifyUser({
    tenantId: input.tenantId,
    userId: user.id,
    kind: input.kind,
    title: input.title,
    body: input.body,
    link: input.link,
    email: input.email_template
      ? {
          to: input.email,
          subject: input.email_template.subject,
          text: input.email_template.text,
          html: input.email_template.html,
        }
      : undefined,
  });
}
