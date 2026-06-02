'use client';

import { useEffect } from 'react';

/**
 * Next.js App Router error boundary for the (dash) layout group.
 * Catches server-side rendering errors and reports them to the
 * error-report API, which fans out a notification to helpdesk.handle users.
 */
export default function DashError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Report to notification API
    try {
      fetch('/api/error-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: error.message,
          stack: error.stack,
          source: 'server',
          url: typeof window !== 'undefined' ? window.location.href : '',
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
          extra: error.digest ? `digest: ${error.digest}` : undefined,
        }),
      }).catch(() => {});
    } catch {
      // Reporter must never crash
    }
  }, [error]);

  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center gap-4 p-8">
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-8 text-center shadow-sm">
        <h2 className="text-lg font-bold text-rose-700">Terjadi Kesalahan</h2>
        <p className="mt-2 text-sm text-rose-600">
          Kesalahan telah dilaporkan secara otomatis ke tim teknis.
        </p>
        {error.digest ? (
          <p className="mt-1 font-mono text-xs text-rose-400">ID: {error.digest}</p>
        ) : null}
        <button
          type="button"
          onClick={reset}
          className="mt-4 rounded-lg border border-rose-300 bg-white px-6 py-2 text-sm font-semibold text-rose-700 transition-colors hover:bg-rose-50"
        >
          Coba lagi
        </button>
      </div>
    </div>
  );
}
