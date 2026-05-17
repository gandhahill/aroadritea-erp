/**
 * Minimal print-only layout — no sidebar, no top bar, no offline banner.
 * Session check stays because thermal-print pages still touch the DB.
 * Tailwind base + print CSS only.
 */

import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import '../globals.css';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Print' };

export default async function PrintLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login');

  return <div className="print-root">{children}</div>;
}
