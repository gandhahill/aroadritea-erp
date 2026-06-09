/**
 * Next.js middleware — route protection via session cookie check.
 * SD §11.1: Protect all /(dash)/* routes, redirect to /login if unauthenticated.
 *
 * This middleware only checks for the session cookie's existence (Edge-compatible).
 * Full session validation happens in server components via auth.api.getSession().
 */

import { type NextRequest, NextResponse } from 'next/server';

const SESSION_COOKIE_NAMES = ['aroadri.session_token', '__Secure-aroadri.session_token'];
const PRODUCTION_WEB_ORIGIN = 'https://erp.aroadritea.com';

function isLoopbackHost(host: string | null) {
  if (!host) return false;
  const normalized = host.toLowerCase();
  return (
    normalized === 'localhost' ||
    normalized.startsWith('localhost:') ||
    normalized === '127.0.0.1' ||
    normalized.startsWith('127.0.0.1:')
  );
}

function configuredOrigin(value: string | undefined, fallback: string) {
  if (!value) return fallback;

  try {
    return new URL(value).origin;
  } catch {
    return fallback;
  }
}

function getPublicOrigin(request: NextRequest) {
  const proxySecret = process.env.TRUSTED_PROXY_HEADER_SECRET;
  const trustForwarded =
    Boolean(proxySecret) && request.headers.get('x-aroadri-proxy-secret') === proxySecret;
  const forwardedHost = trustForwarded ? request.headers.get('x-forwarded-host') : null;
  const host = forwardedHost ?? request.headers.get('host');
  const fallback =
    process.env.NODE_ENV === 'production' ? PRODUCTION_WEB_ORIGIN : request.nextUrl.origin;

  if (host && !isLoopbackHost(host) && !isLoopbackHost(request.nextUrl.host)) {
    const proto =
      (trustForwarded ? request.headers.get('x-forwarded-proto') : null) ??
      request.nextUrl.protocol.replace(':', '');
    const candidate = configuredOrigin(`${proto}://${host}`, fallback);
    if (process.env.NODE_ENV !== 'production' || isAllowedProductionOrigin(candidate, fallback)) {
      return candidate;
    }
  }

  return configuredOrigin(process.env.NEXT_PUBLIC_WEB_URL ?? process.env.BETTER_AUTH_URL, fallback);
}

function isAllowedProductionOrigin(origin: string, fallback: string) {
  return new Set([
    PRODUCTION_WEB_ORIGIN,
    configuredOrigin(process.env.NEXT_PUBLIC_WEB_URL, fallback),
    configuredOrigin(process.env.BETTER_AUTH_URL, fallback),
  ]).has(origin);
}

function noStore(response: NextResponse) {
  response.headers.set('Cache-Control', 'private, no-store, max-age=0, must-revalidate');
  return response;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const publicPaths = [
    '/login',
    '/api/auth',
    '/api/healthz',
    // Error reporting must be reachable by the server instrumentation hook,
    // which posts without a session cookie. The route gates itself by
    // session-or-internal-secret, so middleware does not need to.
    '/api/error-report',
    '/favicon.ico',
    '/favicon.svg',
    '/manifest.json',
    '/sw.js',
    '/workbox-',
    '/icons/',
    '/photo/',
    '/brand/',
    '/images/',
    '/uploads/',
    '/logo-primary.png',
  ];
  if (publicPaths.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const hasSession = SESSION_COOKIE_NAMES.some((name) => request.cookies.has(name));
  if (!hasSession) {
    const loginUrl = new URL('/login', getPublicOrigin(request));
    loginUrl.searchParams.set('callbackUrl', pathname);
    return noStore(NextResponse.redirect(loginUrl));
  }

  return noStore(NextResponse.next());
}

export const config = {
  matcher: [
    '/((?!login|api/auth|api/healthz|_next/static|_next/image|favicon.ico|favicon.svg|logo-primary.png|manifest.json|sw.js|workbox-|icons/|photo/|brand/|images/|uploads/).*)',
  ],
};
