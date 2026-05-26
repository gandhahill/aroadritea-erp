/**
 * Health check endpoint — apps/web.
 * SD §35.1.5, §28.2: returns DB status + app version.
 * No auth required.
 */

import { db, sql } from '@erp/db';

const APP_VERSION = process.env.npm_package_version ?? '0.1.0';

function includeDiagnostics(request: Request): boolean {
  const token = process.env.HEALTHZ_DETAIL_TOKEN;
  return Boolean(token && request.headers.get('x-healthz-token') === token);
}

export async function GET(request: Request) {
  let dbStatus: 'ok' | 'error' = 'ok';
  let dbLatencyMs: number | null = null;

  try {
    const start = Date.now();
    await db.execute(sql`SELECT 1`);
    dbLatencyMs = Date.now() - start;
  } catch {
    dbStatus = 'error';
  }

  const healthy = dbStatus === 'ok';
  const body = includeDiagnostics(request)
    ? {
        status: healthy ? 'ok' : 'degraded',
        service: 'web',
        version: APP_VERSION,
        checks: {
          db: {
            status: dbStatus,
            ...(dbLatencyMs !== null && { latencyMs: dbLatencyMs }),
          },
        },
      }
    : { status: healthy ? 'ok' : 'degraded' };

  return Response.json(body, {
    status: healthy ? 200 : 503,
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}
