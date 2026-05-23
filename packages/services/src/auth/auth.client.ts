/**
 * Auth client — for use in React client components.
 * Creates a better-auth client that hooks into the API route.
 */

import { createAuthClient } from 'better-auth/react';
import { twoFactorClient } from 'better-auth/client/plugins';

const client = createAuthClient({
  baseURL:
    typeof window !== 'undefined'
      ? window.location.origin
      : (process.env.BETTER_AUTH_URL ?? 'http://localhost:3000'),
  plugins: [twoFactorClient()],
});

export const authClient = client as any;
export const { signIn, signUp, signOut, useSession } = client as any;
