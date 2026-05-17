/**
 * Pick a localized value out of a JSONB `{ id, en, zh }` field.
 *
 * Fallback order: requested locale → id → en → zh → empty string.
 * Accepts `null` / non-object / missing locale gracefully so it can be
 * dropped in front of legacy data without crashing.
 */

export type LocaleKey = 'id' | 'en' | 'zh';

export function pickLocalized(
  value: unknown,
  locale: LocaleKey | string | undefined,
  fallback = '',
): string {
  if (!value) return fallback;
  if (typeof value === 'string') return value;
  if (typeof value !== 'object') return fallback;
  const obj = value as Record<string, unknown>;
  const ordered: string[] = [];
  if (typeof locale === 'string' && locale) ordered.push(locale);
  for (const k of ['id', 'en', 'zh']) {
    if (!ordered.includes(k)) ordered.push(k);
  }
  for (const key of ordered) {
    const v = obj[key];
    if (typeof v === 'string' && v.trim().length > 0) return v;
  }
  return fallback;
}
