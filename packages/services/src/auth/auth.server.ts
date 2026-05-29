/**
 * Auth server — better-auth configuration with Drizzle adapter.
 * SD §11.1: Email + password, argon2id, session in DB.
 *
 * This module configures better-auth to use our existing IAM schema
 * (users, sessions tables) via the Drizzle adapter with table mapping.
 */

import { db } from '@erp/db';
import * as authSchema from '@erp/db/schema/auth';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { twoFactor } from 'better-auth/plugins';

const authBaseURL =
  process.env.BETTER_AUTH_URL ??
  (process.env.NODE_ENV === 'production' ? 'https://erp.aroadritea.com' : 'http://localhost:3000');

// ISO 27001 §A.9.4 — auth secrets MUST be stable across restarts and
// across replicas. Generating a random secret at boot in production
// (a) invalidates every active session on every deploy and (b) means
// each replica issues sessions the others can't verify. Fail closed at
// runtime so the operator notices the missing env var.
//
// Next.js `next build` sets NODE_ENV=production but the secret may not
// be available in the build environment; defer the hard fail to the
// first actual auth boot rather than blocking the build.
const isNextBuildPhase =
  process.env.NEXT_PHASE === 'phase-production-build' || process.env.NEXT_PHASE === 'phase-export';
let authSecret = process.env.BETTER_AUTH_SECRET;
if (!authSecret) {
  if (process.env.NODE_ENV === 'production' && !isNextBuildPhase) {
    throw new Error(
      'BETTER_AUTH_SECRET is not set in production. Refusing to boot — ' +
        'a per-instance random secret would silently invalidate all sessions on every deploy.',
    );
  }
  authSecret = 'aroadri-dev-auth-secret-change-me';
}

export const auth = betterAuth({
  baseURL: authBaseURL,
  secret: authSecret,

  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      user: authSchema.users,
      session: authSchema.sessions,
      account: authSchema.authAccounts,
    },
  }),

  // SD §11.1: Email + password as primary method
  emailAndPassword: {
    enabled: true,
    password: {
      hash: async (password: string) => {
        const { hashPassword } = await import('./password');
        return hashPassword(password);
      },
      verify: async ({ hash, password }: { hash: string; password: string }) => {
        const { verifyPassword } = await import('./password');
        return verifyPassword(hash, password);
      },
    },
  },

  // Session config — SD §11.1
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // refresh token every 24 hours
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // 5 min client-side cache
    },
  },

  // Map our schema fields to what better-auth expects
  user: {
    fields: {
      name: 'displayName',
      email: 'email',
      emailVerified: 'emailVerified',
      image: undefined, // We don't use image field
      password: 'passwordHash',
    },
    additionalFields: {
      tenantId: {
        type: 'string',
        required: true,
      },
      requirePasswordChange: {
        type: 'boolean',
        required: true,
        defaultValue: false,
      },
      twoFactorEnabled: {
        type: 'boolean',
        required: false,
        defaultValue: false,
      },
    },
  },

  plugins: [twoFactor()],

  // ISO 27001 §A.9.4 — limit credential-stuffing / brute force on the
  // staff login endpoint. better-auth's built-in window covers the
  // /api/auth/* surface (signIn, signUp, etc.) globally per IP.
  rateLimit: {
    enabled: true,
    window: 60,
    max: 20,
  },

  // Cookie configuration — SD §11.1: Secure, HttpOnly, SameSite=Lax
  advanced: {
    cookiePrefix: 'aroadri',
    defaultCookieAttributes: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
    },
  },
});

export type Auth = typeof auth;
