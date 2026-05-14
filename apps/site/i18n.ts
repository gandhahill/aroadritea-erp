/**
 * Public Site i18n config - SD §31.1, ADR-0003
 *
 * URL-based routing: /{id,en,zh} prefix.
 * Default locale: id (Bahasa Indonesia).
 * next-intl with server-side rendering.
 */

export type SiteLocale = 'id' | 'en' | 'zh';

export const siteLocales: SiteLocale[] = ['id', 'en', 'zh'];
export const defaultSiteLocale: SiteLocale = 'id';

export const localeNames: Record<SiteLocale, string> = {
  id: 'Bahasa Indonesia',
  en: 'English',
  zh: '中文',
};

export const localeLabels: Record<SiteLocale, string> = {
  id: 'ID',
  en: 'EN',
  zh: '中文',
};
