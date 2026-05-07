/**
 * next-intl request config — loads messages for the active locale.
 * Used by Next.js App Router via next-intl/plugin.
 *
 * Locale is read from the `aroadri.locale` cookie (set after login).
 * This avoids importing the auth module here, which would pull in
 * the DB client and cause issues when DATABASE_URL is not available.
 */

import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';
import { defaultLocale, locales } from './config';
import type { AppLocale } from './config';

const LOCALE_COOKIE = 'aroadri.locale';

export default getRequestConfig(async () => {
  let locale: AppLocale = defaultLocale;

  try {
    const cookieStore = await cookies();
    const cookieLocale = cookieStore.get(LOCALE_COOKIE)?.value;
    if (cookieLocale && locales.includes(cookieLocale as AppLocale)) {
      locale = cookieLocale as AppLocale;
    }
  } catch {
    // Static rendering or no cookies available — use default
  }

  const messages = (await import(`../messages/${locale}.json`)).default;

  return {
    locale,
    messages,
  };
});
