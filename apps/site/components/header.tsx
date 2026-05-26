/**
 * Public Site Header - SD §31.1
 *
 * Sticky navigation with logo + locale switcher + nav links.
 * Auth-aware: shows login/register when anonymous, shows "My Account" when logged in.
 */
'use client';

import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { type SiteLocale, localeLabels, siteLocales } from '../i18n';

const NAV_LINKS = [
  { key: 'home', href: (locale: string) => `/${locale}` },
  { key: 'menu', href: (locale: string) => `/${locale}/menu` },
  { key: 'about', href: (locale: string) => `/${locale}/tentang` },
  { key: 'locations', href: (locale: string) => `/${locale}/lokasi` },
  { key: 'careers', href: (locale: string) => `/${locale}/karier` },
] as const;

interface Props {
  locale: SiteLocale;
  brand: string;
  tagline: string;
  chineseTea: string;
  labels: Record<(typeof NAV_LINKS)[number]['key'] | 'member' | 'login' | 'myAccount', string>;
  isLoggedIn?: boolean;
  memberName?: string | null;
}

export function PublicHeader({
  locale,
  brand,
  tagline,
  chineseTea,
  labels,
  isLoggedIn,
  memberName,
}: Props) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  function switchLocale(newLocale: SiteLocale) {
    const segments = pathname.split('/');
    segments[1] = newLocale;
    return segments.join('/');
  }

  return (
    <header className="sticky top-0 z-50 border-b border-brand-red/10 bg-brand-cream/92 shadow-soft backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <a
          href={`/${locale}`}
          className="group flex min-w-0 items-center gap-3 rounded-[8px] focus-visible:outline-none focus-visible:shadow-focus"
          aria-label={brand}
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-cream p-1 shadow-soft">
            <img src="/brand/logo-primary.png" alt="" className="h-full w-full object-contain" />
          </span>
          <span className="min-w-0">
            <span className="flex min-w-0 items-center gap-2">
              <span className="brand-wordmark block truncate text-base text-brand-red sm:text-lg">
                {brand}
              </span>
              <span className="brand-chinese-mark inline-flex shrink-0 rounded-full border border-brand-red/16 bg-brand-red/[0.07] px-2 py-0.5 text-[11px] text-brand-red sm:text-xs">
                {chineseTea}
              </span>
            </span>
            <span className="brand-tagline hidden text-[10px] text-brand-ink-3 sm:block">
              {tagline}
            </span>
          </span>
        </a>

        <nav className="hidden items-center gap-2 rounded-full border border-brand-red/10 bg-brand-cream-1 px-2 py-1 md:flex">
          {NAV_LINKS.map(({ key, href }) => (
            <a
              key={key}
              href={href(locale)}
              className="rounded-full px-3 py-2 text-sm font-semibold text-brand-ink-2 transition-brand hover:bg-brand-cream-2 hover:text-brand-red focus-visible:outline-none focus-visible:shadow-focus"
            >
              {labels[key]}
            </a>
          ))}
        </nav>

        <button
          type="button"
          aria-label="Menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-brand-red/15 bg-brand-cream-1 text-brand-red md:hidden"
        >
          <svg
            aria-hidden="true"
            className="h-5 w-5"
            fill="none"
            focusable="false"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            {menuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>

        <div className="flex shrink-0 items-center gap-2">
          {isLoggedIn ? (
            <a
              href={`/${locale}/member/akun`}
              className="hidden items-center gap-2 rounded-full bg-brand-red px-4 py-2 text-sm font-bold text-brand-cream shadow-soft transition-brand hover:bg-brand-red-dark hover:shadow-pop focus-visible:outline-none focus-visible:shadow-focus sm:inline-flex"
            >
              <svg
                aria-hidden="true"
                className="h-4 w-4"
                fill="none"
                focusable="false"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"
                />
              </svg>
              {memberName || labels.myAccount}
            </a>
          ) : (
            <>
              <a
                href={`/${locale}/member/masuk`}
                className="hidden rounded-full border border-brand-red/20 bg-brand-cream-1 px-4 py-2 text-sm font-bold text-brand-red transition-brand hover:bg-brand-cream-2 focus-visible:outline-none focus-visible:shadow-focus sm:inline-flex"
              >
                {labels.login}
              </a>
              <a
                href={`/${locale}/member/daftar`}
                className="hidden rounded-full bg-brand-red px-4 py-2 text-sm font-bold text-brand-cream shadow-soft transition-brand hover:bg-brand-red-dark hover:shadow-pop focus-visible:outline-none focus-visible:shadow-focus sm:inline-flex"
              >
                {labels.member}
              </a>
            </>
          )}
          <div className="flex items-center rounded-full border border-brand-red/10 bg-brand-cream-1 p-1">
            {siteLocales.map((loc) => (
              <a
                key={loc}
                href={switchLocale(loc)}
                className={`rounded-full px-2.5 py-1.5 text-xs font-bold transition-brand focus-visible:outline-none focus-visible:shadow-focus ${
                  loc === locale
                    ? 'bg-brand-red text-brand-cream'
                    : 'text-brand-ink-3 hover:bg-brand-cream-2 hover:text-brand-red'
                }`}
              >
                {localeLabels[loc]}
              </a>
            ))}
          </div>
        </div>
      </div>

      {menuOpen && (
        <div className="border-t border-brand-red/10 bg-brand-cream-1 md:hidden">
          <nav className="flex flex-col gap-1 px-4 py-3">
            {NAV_LINKS.map(({ key, href }) => (
              <a
                key={key}
                href={href(locale)}
                onClick={() => setMenuOpen(false)}
                className="rounded-md px-3 py-2 text-sm font-semibold text-brand-ink-2 hover:bg-brand-cream-2 hover:text-brand-red"
              >
                {labels[key]}
              </a>
            ))}
            <div className="my-2 h-px bg-brand-red/10" />
            {isLoggedIn ? (
              <a
                href={`/${locale}/member/akun`}
                onClick={() => setMenuOpen(false)}
                className="rounded-md bg-brand-red px-3 py-2 text-sm font-bold text-brand-cream"
              >
                {memberName || labels.myAccount}
              </a>
            ) : (
              <>
                <a
                  href={`/${locale}/member/masuk`}
                  onClick={() => setMenuOpen(false)}
                  className="rounded-md border border-brand-red/20 px-3 py-2 text-sm font-bold text-brand-red"
                >
                  {labels.login}
                </a>
                <a
                  href={`/${locale}/member/daftar`}
                  onClick={() => setMenuOpen(false)}
                  className="rounded-md bg-brand-red px-3 py-2 text-sm font-bold text-brand-cream"
                >
                  {labels.member}
                </a>
              </>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
