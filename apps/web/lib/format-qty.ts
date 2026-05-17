/**
 * Format a numeric quantity stored as a numeric(p,s) Drizzle string.
 *
 * Postgres returns numeric(14,3) values as strings like "1.000" — when the
 * UI shows that as-is to an Indonesian audience it looks like "1,000" (one
 * thousand), because dot is the thousand separator. So we collapse trailing
 * zeroes after the decimal point and drop the decimal entirely when the
 * fractional part is zero ("1.000" → "1", "1.500" → "1.5").
 */
export function formatQty(value: string | number | bigint | null | undefined): string {
  if (value === null || value === undefined) return '0';
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(3).replace(/\.?0+$/, '');
}
