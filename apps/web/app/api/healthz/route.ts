/**
 * Health check endpoint — apps/web.
 * SD §35.1.5, §28.2: returns DB status + app version.
 * No auth required.
 */

import { db, sql } from '@erp/db';

const APP_VERSION = process.env.npm_package_version ?? '0.1.0';

export async function GET() {
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

  return Response.json(
    {
      status: healthy ? 'ok' : 'degraded',
      service: 'web',
      version: APP_VERSION,
      timestamp: new Date().toISOString(),
      checks: {
        db: {
          status: dbStatus,
          ...(dbLatencyMs !== null && { latencyMs: dbLatencyMs }),
        },
      },
    },
    { status: healthy ? 200 : 503 },
  );
}
