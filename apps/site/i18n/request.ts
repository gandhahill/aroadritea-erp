/**
 * next-intl request config — SD §31.1
 *
 * Provides locale detection + message loading for the public site.
 */
import { getRequestConfig } from 'next-intl/server';
import { type SiteLocale, defaultSiteLocale, siteLocales } from '../i18n';

export default getRequestConfig(async ({ requestLocale }) => {
  const requestedLocale = await requestLocale;
  const locale = siteLocales.includes(requestedLocale as SiteLocale)
    ? (requestedLocale as SiteLocale)
    : defaultSiteLocale;

  return {
    locale,
    timeZone: 'Asia/Jakarta',
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
