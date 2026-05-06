/**
 * next-intl request config — loads messages for the active locale.
 * Used by Next.js App Router via next-intl/plugin.
 */

import { getRequestConfig } from 'next-intl/server';
import { defaultLocale } from './config';
import type { AppLocale } from './config';

export default getRequestConfig(async () => {
  // TODO: read locale from user session/cookie once auth is wired (T-0006)
  // For now, use defaultLocale
  const locale: AppLocale = defaultLocale;

  const messages = (await import(`../messages/${locale}.json`)).default;

  return {
    locale,
    messages,
  };
});
