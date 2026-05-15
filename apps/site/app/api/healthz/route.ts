/**
 * Health check endpoint — apps/site (public website).
 * SD §35.1.5, §28.2: lightweight check — no DB required.
 * Returns ok if the app is running.
 */

const APP_VERSION = process.env.npm_package_version ?? '0.1.0';

export async function GET() {
  const memory = process.memoryUsage();
  return Response.json(
    {
      status: 'ok',
      service: 'site',
      version: APP_VERSION,
      timestamp: new Date().toISOString(),
      checks: {
        memory: {
          rssMb: Math.round(memory.rss / 1024 / 1024),
          heapUsedMb: Math.round(memory.heapUsed / 1024 / 1024),
          heapTotalMb: Math.round(memory.heapTotal / 1024 / 1024),
        },
      },
    },
    {
      headers: {
        'Cache-Control': 'no-store',
      },
    },
  );
}
