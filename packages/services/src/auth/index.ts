/**
 * @erp/services/auth — Authentication service barrel export.
 *
 * password.ts is NOT re-exported here because argon2 is a native addon
 * that can't be bundled for Edge Runtime (used by Next.js middleware).
 * Import directly: import { hashPassword } from '@erp/services/auth/password'
 */

export { auth } from './auth.server';
export type { Auth } from './auth.server';
export { authClient, signIn, signUp, signOut, useSession } from './auth.client';
