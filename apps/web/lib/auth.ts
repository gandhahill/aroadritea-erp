/**
 * Auth server helpers for apps/web.
 * Used in server components, server actions, and middleware.
 */

import { auth } from '@erp/services/auth';
import { headers } from 'next/headers';

/**
 * Get the current session in a server component or server action.
 * Returns null if not authenticated.
 */
export async function getSession() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  return session;
}

/**
 * Get the current session or throw — use only where auth is guaranteed
 * (e.g., inside a dashboard layout that already checked).
 */
export async function requireSession() {
  const session = await getSession();
  if (!session) {
    throw new Error('Unauthenticated');
  }
  return session;
}

// Re-export the auth instance for API routes
export { auth } from '@erp/services/auth';
