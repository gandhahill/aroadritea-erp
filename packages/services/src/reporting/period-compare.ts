/**
 * reporting.periodCompare — T-0177.
 *
 * Generic helper that takes a fetcher returning a numeric metric for a
 * given date range and returns `{ current, previous, delta, deltaPct }`
 * so any reporting page can render a "vs last period" badge without
 * re-deriving the previous range every time.
 *
 * Example:
 *   const result = await periodCompare(
 *     { from: '2026-05-01', to: '2026-05-31' },
 *     async (range) => {
 *       const s = await getDailySummary({ ...range, locationId }, ctx);
 *       return s.ok ? BigInt(s.value.netRevenue) : 0n;
 *     },
 *   );
 *   // result.current = May, result.previous = April equivalent.
 */

export interface PeriodInput {
  from: string; // YYYY-MM-DD inclusive
  to: string; // YYYY-MM-DD inclusive
}

export interface PeriodCompareResult {
  current: { from: string; to: string; value: bigint };
  previous: { from: string; to: string; value: bigint };
  delta: bigint;
  /** Percent change vs previous. `null` when previous = 0 (no baseline). */
  deltaPercent: number | null;
}

// Date math in pure UTC milliseconds avoids the trap where parsing a
// `YYYY-MM-DD` with a WIB offset then formatting via `toISOString`
// silently shifts the day back to UTC.
function parseUtc(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}

function fmtUtc(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function daysBetweenUtc(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

/** Build the period that ends right before `current.from` and spans
 *  the same number of days as `current`. */
export function previousPeriod(current: PeriodInput): PeriodInput {
  const from = parseUtc(current.from);
  const to = parseUtc(current.to);
  // length INCLUSIVE of both endpoints (May 1..May 31 = 31 days).
  const length = daysBetweenUtc(from, to) + 1;
  const prevTo = new Date(from.getTime() - 24 * 60 * 60 * 1000);
  const prevFrom = new Date(prevTo.getTime() - (length - 1) * 24 * 60 * 60 * 1000);
  return { from: fmtUtc(prevFrom), to: fmtUtc(prevTo) };
}

export async function periodCompare(
  current: PeriodInput,
  fetcher: (range: PeriodInput) => Promise<bigint>,
): Promise<PeriodCompareResult> {
  const prev = previousPeriod(current);
  const [curValue, prevValue] = await Promise.all([fetcher(current), fetcher(prev)]);
  const delta = curValue - prevValue;
  const deltaPercent = prevValue === 0n ? null : Number((delta * 10000n) / prevValue) / 100;
  return {
    current: { ...current, value: curValue },
    previous: { ...prev, value: prevValue },
    delta,
    deltaPercent,
  };
}
