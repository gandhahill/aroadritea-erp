/**
 * Public Site Header - SD §31.1
 *
 * Sticky navigation with logo + locale switcher + nav links.
 */
'use client';

import { usePathname } from 'next/navigation';
import { type SiteLocale, localeLabels, siteLocales } from '../i18n';

const NAV_LINKS = [
  { key: 'home', href: (locale: string) => `/${locale}` },
  { key: 'menu', href: (locale: string) => `/${locale}/menu` },
  { key: 'about', href: (locale: string) => `/${locale}/tentang` },
  { key: 'locations', href: (locale: string) => `/${locale}/lokasi` },
] as const;

interface Props {
  locale: SiteLocale;
  brand: string;
  labels: Record<(typeof NAV_LINKS)[number]['key'] | 'member', string>;
}

export function PublicHeader({ locale, brand, labels }: Props) {
  const pathname = usePathname();

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
          <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-red">
            <img src="/brand/logo-primary.png" alt="" className="h-full w-full object-cover" />
          </span>
          <span className="min-w-0">
            <span className="block truncate font-display text-base font-bold tracking-normal text-brand-red sm:text-lg">
              {brand}
            </span>
            <span className="hidden text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-ink-3 sm:block">
              Chinese Tea & Dessert
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

        <div className="flex shrink-0 items-center gap-2">
          <a
            href={`/${locale}/member/daftar`}
            className="hidden rounded-full bg-brand-red px-4 py-2 text-sm font-bold text-brand-cream shadow-soft transition-brand hover:bg-brand-red-dark hover:shadow-pop focus-visible:outline-none focus-visible:shadow-focus sm:inline-flex"
          >
            {labels.member}
          </a>
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
    </header>
  );
}
