/**
 * (auth) layout — if user already has a session, send them straight to the
 * dashboard instead of showing the login page again.
 */

import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (session) redirect('/dashboard');
  return <>{children}</>;
}
