/**
 * Public Site Header — SD §31.1
 *
 * Sticky navigation with logo + locale switcher + nav links.
 */
'use client';

import { useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';
import { type SiteLocale, localeFlags } from '../i18n';
import { siteLocales } from '../i18n';

const NAV_LINKS = [
  { key: 'home', href: (locale: string) => `/${locale}` },
  { key: 'menu', href: (locale: string) => `/${locale}/menu` },
  { key: 'about', href: (locale: string) => `/${locale}/tentang` },
  { key: 'locations', href: (locale: string) => `/${locale}/lokasi` },
] as const;

interface Props {
  locale: SiteLocale;
}

export function PublicHeader({ locale }: Props) {
  const t = useTranslations('nav');
  const tBrand = useTranslations('common');
  const pathname = usePathname();

  function switchLocale(newLocale: SiteLocale) {
    const segments = pathname.split('/');
    segments[1] = newLocale; // replace locale segment
    return segments.join('/');
  }

  return (
    <header className="sticky top-0 z-50 bg-brand-cream-3 border-b border-brand-cream shadow-sm">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        {/* Logo */}
        <a href={`/${locale}`} className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-red text-lg font-bold text-white">A</span>
          <span className="text-lg font-semibold text-brand-red">{tBrand('brand')}</span>
        </a>

        {/* Nav */}
        <nav className="hidden items-center gap-6 md:flex">
          {NAV_LINKS.map(({ key, href }) => (
            <a
              key={key}
              href={href(locale)}
              className="text-sm font-medium text-brand-ink transition-colors hover:text-brand-red"
            >
              {t(key)}
            </a>
          ))}
        </nav>

        {/* Locale Switcher */}
        <div className="flex items-center gap-1">
          {siteLocales.map((loc) => (
            <a
              key={loc}
              href={switchLocale(loc)}
              className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                loc === locale
                  ? 'bg-brand-red text-white'
                  : 'text-brand-ink hover:bg-brand-cream-2'
              }`}
            >
              {localeFlags[loc]}
            </a>
          ))}
        </div>
      </div>
    </header>
  );
}
