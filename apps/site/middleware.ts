/**
 * Public Site Middleware — SD §31.1
 *
 * Redirects root to /id. next-intl handles locale routing.
 */
import createMiddleware from 'next-intl/middleware';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const LOCALES = ['id', 'en', 'zh'] as const;
type Locale = (typeof LOCALES)[number];

const DEFAULT_LOCALE: Locale = 'id';
const PRODUCTION_SITE_ORIGIN = 'https://aroadritea.com';

const intlMiddleware = createMiddleware({
  locales: LOCALES,
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: 'always',
});

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
    process.env.NODE_ENV === 'production' ? PRODUCTION_SITE_ORIGIN : request.nextUrl.origin;
  return configuredOrigin(process.env.NEXT_PUBLIC_SITE_URL, fallback);
}

function hasLocalePrefix(pathname: string) {
  return LOCALES.some((locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`));
}

function getPreferredLocale(request: NextRequest): Locale {
  const cookieLocale = request.cookies.get('NEXT_LOCALE')?.value;
  return LOCALES.find((locale) => locale === cookieLocale) ?? DEFAULT_LOCALE;
}

function shouldCanonicalizeRedirect(request: NextRequest) {
  const forwardedHost = request.headers.get('x-forwarded-host');
  const host = request.headers.get('host');
  return (
    isLoopbackHost(request.nextUrl.host) || isLoopbackHost(host) || isLoopbackHost(forwardedHost)
  );
}

export default function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // Legacy slug redirect: /xx/karir → /xx/karier (Bahasa Indonesia spelling).
  // Preserve the locale prefix and any query string so the redirect is
  // idempotent and SEO-clean.
  const karirMatch = pathname.match(/^\/(id|en|zh)\/karir(\/.*)?$/);
  if (karirMatch) {
    const locale = karirMatch[1]!;
    const tail = karirMatch[2] ?? '';
    const target = new URL(`/${locale}/karier${tail}`, request.nextUrl.origin);
    target.search = search;
    return NextResponse.redirect(target, 308);
  }

  if (shouldCanonicalizeRedirect(request) && !hasLocalePrefix(pathname)) {
    const locale = getPreferredLocale(request);
    const localizedPathname = pathname === '/' ? `/${locale}` : `/${locale}${pathname}`;
    const redirectUrl = new URL(localizedPathname, getPublicOrigin(request));
    redirectUrl.search = search;

    const response = NextResponse.redirect(redirectUrl);
    response.cookies.set('NEXT_LOCALE', locale, { path: '/', sameSite: 'lax' });
    response.headers.set('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    return response;
  }

  const response = intlMiddleware(request);
  response.headers.set('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
  return response;
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\.[^/]+).*)'],
};
