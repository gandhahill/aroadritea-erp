/**
 * Health check endpoint — apps/site (public website).
 * SD §35.1.5, §28.2: lightweight check — no DB required.
 * Returns ok if the app is running.
 */

const APP_VERSION = process.env.npm_package_version ?? '0.1.0';

export async function GET() {
  return Response.json({
    status: 'ok',
    service: 'site',
    version: APP_VERSION,
    timestamp: new Date().toISOString(),
  });
}
