'use client';

import { recordAuthEvent } from '@/lib/audit-auth';
import { authClient } from '@/lib/auth-client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function LogoutButton({
  label,
  loadingLabel,
}: {
  label: string;
  loadingLabel: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    try {
      // Record the audit event BEFORE we drop the session — otherwise the
      // server action won't be able to resolve the user id from cookies.
      await recordAuthEvent({ action: 'logout' });
      await authClient.signOut();
    } finally {
      router.push('/login');
      router.refresh();
    }
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={loading}
      className="rounded-md border border-brand-cream-3 bg-brand-cream px-3 py-1.5 text-xs font-semibold text-brand-ink transition-colors hover:bg-brand-cream-1 disabled:opacity-50"
    >
      {loading ? loadingLabel : label}
    </button>
  );
}
