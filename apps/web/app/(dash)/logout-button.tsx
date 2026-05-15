'use client';

import { authClient } from '@/lib/auth-client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    try {
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
      className="rounded-md border border-brand-cream-3 bg-white px-3 py-1.5 text-xs font-semibold text-brand-ink transition-colors hover:bg-brand-cream-1 disabled:opacity-50"
    >
      {loading ? 'Keluar...' : 'Logout'}
    </button>
  );
}
