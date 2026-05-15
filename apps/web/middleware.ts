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
  const forwardedHost = request.headers.get('x-forwarded-host');
  const host = forwardedHost ?? request.headers.get('host');

  if (host && !isLoopbackHost(host) && !isLoopbackHost(request.nextUrl.host)) {
    const proto =
      request.headers.get('x-forwarded-proto') ?? request.nextUrl.protocol.replace(':', '');
    return `${proto}://${host}`;
  }

  const fallback =
    process.env.NODE_ENV === 'production' ? PRODUCTION_WEB_ORIGIN : request.nextUrl.origin;
  return configuredOrigin(process.env.NEXT_PUBLIC_WEB_URL ?? process.env.BETTER_AUTH_URL, fallback);
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const publicPaths = ['/login', '/api/auth', '/api/healthz'];
  if (publicPaths.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const hasSession = SESSION_COOKIE_NAMES.some((name) => request.cookies.has(name));
  if (!hasSession) {
    const loginUrl = new URL('/login', getPublicOrigin(request));
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!login|api/auth|api/healthz|_next/static|_next/image|favicon.ico|logo-primary.png|manifest.json).*)',
  ],
};
