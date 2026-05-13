/**
 * Next.js middleware — route protection via session cookie check.
 * SD §11.1: Protect all /(dash)/* routes, redirect to /login if unauthenticated.
 *
 * This middleware only checks for the session cookie's existence (Edge-compatible).
 * Full session validation happens in server components via auth.api.getSession().
 */

import { type NextRequest, NextResponse } from 'next/server';

const SESSION_COOKIE = 'aroadri.session_token';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const publicPaths = ['/login', '/api/auth'];
  if (publicPaths.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const hasSession = request.cookies.has(SESSION_COOKIE);
  if (!hasSession) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!login|api/auth|_next/static|_next/image|favicon.ico|logo-primary.png|manifest.json).*)',
  ],
};
