/**
 * period-compare regression — T-0177.
 *
 * Pure date arithmetic; no DB mocks needed.
 */

import { describe, expect, it } from 'vitest';
import { periodCompare, previousPeriod } from '../src/reporting/period-compare';

describe('previousPeriod', () => {
  it('returns the same-length window immediately before current', () => {
    const out = previousPeriod({ from: '2026-05-01', to: '2026-05-31' });
    expect(out.from).toBe('2026-03-31');
    expect(out.to).toBe('2026-04-30');
  });

  it('handles single-day periods', () => {
    const out = previousPeriod({ from: '2026-05-25', to: '2026-05-25' });
    expect(out.from).toBe('2026-05-24');
    expect(out.to).toBe('2026-05-24');
  });
});

describe('periodCompare', () => {
  it('returns current + previous + delta + deltaPercent', async () => {
    const result = await periodCompare(
      { from: '2026-05-01', to: '2026-05-31' },
      async (range) => (range.from === '2026-05-01' ? 1_500_000n : 1_000_000n),
    );
    expect(result.current.value).toBe(1_500_000n);
    expect(result.previous.value).toBe(1_000_000n);
    expect(result.delta).toBe(500_000n);
    expect(result.deltaPercent).toBe(50);
  });

  it('returns null deltaPercent when previous is 0', async () => {
    const result = await periodCompare(
      { from: '2026-05-01', to: '2026-05-31' },
      async (range) => (range.from === '2026-05-01' ? 250_000n : 0n),
    );
    expect(result.deltaPercent).toBeNull();
    expect(result.delta).toBe(250_000n);
  });
});
