/**
 * Next.js instrumentation — runs once when the server starts.
 * Captures truly-unhandled server errors (uncaught exceptions + unhandled
 * promise rejections) and forwards them to the in-app error-report endpoint,
 * which notifies helpdesk.handle permission holders.
 *
 * Why HTTP instead of importing @erp/services/notification directly:
 * in the standalone production build the instrumentation hook is loaded by
 * Node's native ESM loader, NOT through webpack. Importing the notification
 * service pulls in the @erp/db barrel, whose extensionless internal imports
 * (`export { db } from './client'`) cannot be resolved by Node ESM and crash
 * the hook with "Cannot find module .../packages/db/client". Posting to the
 * already-bundled /api/error-report route sidesteps the resolver entirely and
 * keeps this file dependency-free (only `fetch` + `process`).
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const report = async (kind: 'unhandledRejection' | 'uncaughtException', err: Error) => {
    // Always log to stderr first so PM2 captures the full trace even if the
    // HTTP hop below fails (e.g. the process is already tearing down).
    console.error(`[instrumentation] ${kind}:`, err?.stack ?? err?.message ?? err);
    try {
      const port = process.env.PORT || '3000';
      await fetch(`http://127.0.0.1:${port}/api/error-report`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          // Loopback-only shared secret so the publicly-routable endpoint still
          // rejects anonymous server-source reports. Same value the route reads.
          'x-internal-secret': process.env.BETTER_AUTH_SECRET ?? '',
        },
        body: JSON.stringify({
          source: 'server',
          message: err?.message ? String(err.message).slice(0, 500) : String(err),
          stack: err?.stack ? String(err.stack).slice(0, 1500) : undefined,
          extra: kind,
        }),
        // Never let a hung request wedge a crashing process.
        signal: AbortSignal.timeout(3000),
      });
    } catch {
      // Reporting must never crash the process — the console.error above stands.
    }
  };

  process.on('unhandledRejection', (reason: unknown) => {
    const err = reason instanceof Error ? reason : new Error(String(reason));
    void report('unhandledRejection', err);
  });

  process.on('uncaughtException', (err: Error) => {
    void report('uncaughtException', err);
  });
}
