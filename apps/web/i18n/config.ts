/**
 * i18n configuration — next-intl (non-routing, server-side).
 * SD §7.1, SoT §17.5: id, en, zh sejak awal.
 *
 * Locale dipilih dari user preference (DB `users.locale`),
 * fallback ke 'id'. Tidak pakai URL-based routing (/en/, /zh/)
 * karena ini internal ERP, bukan public site.
 */

export type AppLocale = 'id' | 'en' | 'zh';

export const locales: AppLocale[] = ['id', 'en', 'zh'];
export const defaultLocale: AppLocale = 'id';
