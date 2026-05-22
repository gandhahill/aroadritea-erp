'use server';

/**
 * Write a row to audit_log for login / logout / failed login events.
 *
 * better-auth doesn't touch our audit_log table directly, so we record the
 * event from the client-driven actions in (auth)/login/page.tsx and the
 * logout button. Stays best-effort — if the insert fails we swallow the
 * error rather than break the auth flow.
 */

import { getSession } from '@/lib/auth';
import { db } from '@erp/db';
import { auditLog } from '@erp/db/schema/audit';
import { generateId } from '@erp/shared/id';
import { headers } from 'next/headers';

export type AuthAuditAction = 'login' | 'logout' | 'login_failed';

export async function recordAuthEvent(args: {
  action: AuthAuditAction;
  email?: string;
  reason?: string;
}): Promise<void> {
  try {
    const session = await getSession();
    const user = (session?.user ?? null) as Record<string, unknown> | null;
    const tenantId = String(user?.tenantId ?? 'default');
    const userId = user?.id ? String(user.id) : null;

    const hdrs = await headers();
    const ip = hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() ?? hdrs.get('x-real-ip') ?? null;
    const ua = hdrs.get('user-agent') ?? null;

    await db.insert(auditLog).values({
      id: generateId(),
      tenantId,
      // Audit rows store the active user when known; for failed logins or
      // the very last logout-before-clear we still log under 'anonymous'.
      userId: userId ?? 'anonymous',
      action: args.action,
      entityType: 'auth_session',
      entityId: userId ?? args.email ?? 'unknown',
      before: null,
      after: {
        email: args.email ?? user?.email ?? null,
        reason: args.reason ?? null,
      },
      metadata: { ip, userAgent: ua },
    });
  } catch {
    // never crash the caller on audit failure
  }
}
