/**
 * Date utilities — timezone-aware helpers for WIB (Asia/Jakarta).
 * SD §P8: UTC in DB, locale in UI. Store timezone: `Asia/Jakarta`.
 */

export const WIB_TZ = 'Asia/Jakarta';
export const WIB_OFFSET_HOURS = 7;

/** Get current Date (always UTC internally, JS Date). */
export function now(): Date {
  return new Date();
}

/**
 * Format a Date to 'YYYY-MM-DD' in WIB timezone.
 * Used for `posting_date` and period boundaries.
 */
export function formatDateWIB(date: Date): string {
  return date.toLocaleDateString('sv-SE', { timeZone: WIB_TZ });
}

/**
 * Format a Date to ISO 8601 string (UTC).
 * For storing in DB `timestamptz` columns.
 */
export function formatISO(date: Date): string {
  return date.toISOString();
}

/**
 * Parse a 'YYYY-MM-DD' string as a Date at midnight WIB.
 * Useful for parsing posting_date from user input.
 */
export function parsePostingDate(dateStr: string): Date {
  // Validate format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    throw new Error(`Invalid date format: ${dateStr}. Expected YYYY-MM-DD`);
  }
  // Parse as midnight WIB (UTC+7) → subtract 7 hours = UTC
  const [year, month, day] = dateStr.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(year, month - 1, day, -WIB_OFFSET_HOURS));
}

/**
 * Check if a given date falls within a period defined by [start, end] (inclusive).
 * Comparison uses 'YYYY-MM-DD' strings in WIB.
 */
export function isDateInPeriod(date: Date, periodStart: string, periodEnd: string): boolean {
  const dateStr = formatDateWIB(date);
  return dateStr >= periodStart && dateStr <= periodEnd;
}

/**
 * Get the start and end of a month in WIB, for period boundaries.
 * @param year - full year (e.g. 2026)
 * @param month - 1-indexed (1 = January)
 */
export function getMonthBounds(year: number, month: number): { start: string; end: string } {
  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate(); // day 0 of next month = last day of this month
  const end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { start, end };
}

/**
 * Format a Date for display in WIB locale.
 * @param locale - 'id', 'en', or 'zh'
 */
export function formatDisplayDate(date: Date, locale = 'id'): string {
  const localeMap: Record<string, string> = {
    id: 'id-ID',
    en: 'en-US',
    zh: 'zh-CN',
  };
  return date.toLocaleDateString(localeMap[locale] ?? 'id-ID', {
    timeZone: WIB_TZ,
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Format a Date as time string in WIB (HH:mm).
 */
export function formatTimeWIB(date: Date): string {
  return date.toLocaleTimeString('sv-SE', {
    timeZone: WIB_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/**
 * Generate a period code from a date: 'YYYY-MM'.
 */
export function toPeriodCode(date: Date): string {
  const dateStr = formatDateWIB(date);
  return dateStr.slice(0, 7); // 'YYYY-MM'
}
