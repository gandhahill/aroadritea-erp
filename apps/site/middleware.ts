/**
 * Public Site Middleware — SD §31.1
 *
 * Redirects root to /id. next-intl handles locale routing.
 */
import createMiddleware from 'next-intl/middleware';
import type { NextRequest } from 'next/server';

const intlMiddleware = createMiddleware({
  locales: ['id', 'en', 'zh'],
  defaultLocale: 'id',
  localePrefix: 'always',
});

export default function middleware(request: NextRequest) {
  const response = intlMiddleware(request);
  response.headers.set(
    'Cache-Control',
    'public, s-maxage=3600, stale-while-revalidate=86400',
  );
  return response;
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\.[^/]+).*)'],
};
