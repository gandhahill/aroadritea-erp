/**
 * Auth client helpers for apps/web client components.
 * Imports directly from the client module to avoid pulling in
 * server-side deps (argon2, neon) into the client bundle.
 */

export { authClient, signIn, signOut, useSession } from '@erp/services/auth/client';
