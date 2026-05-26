/**
 * Health check endpoint — apps/site (public website).
 * SD §35.1.5, §28.2: lightweight check — no DB required.
 * Returns ok if the app is running.
 */

const APP_VERSION = process.env.npm_package_version ?? '0.1.0';

function includeDiagnostics(request: Request): boolean {
  const token = process.env.HEALTHZ_DETAIL_TOKEN;
  return Boolean(token && request.headers.get('x-healthz-token') === token);
}

export async function GET(request: Request) {
  return Response.json(
    includeDiagnostics(request)
      ? { status: 'ok', service: 'site', version: APP_VERSION }
      : { status: 'ok' },
    {
      headers: {
        'Cache-Control': 'no-store',
      },
    },
  );
}
