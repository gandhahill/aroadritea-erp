/**
 * next-intl request config — SD §31.1
 *
 * Provides locale detection + message loading for the public site.
 */
import { getRequestConfig } from 'next-intl/server';
import { siteLocales, defaultSiteLocale } from '../i18n';

export default getRequestConfig(async ({ locale }) => {
  return {
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
