/**
 * Unit tests for hourly-sales.ts service (SD §25.6)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock db — use vi.hoisted so it's available in the vi.mock factory ───────────
const mockDbSelect = vi.hoisted(() => vi.fn());

// ── IAM mock ────────────────────────────────────────────────────────────────────
vi.mock('../src/iam', () => ({
  requirePermission: vi.fn(async () => ({ ok: true })),
}));

// ── DB mock ──────────────────────────────────────────────────────────────────────
vi.mock('@erp/db', (): typeof import('@erp/db') => ({
  db: { select: mockDbSelect },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any));

// ── Import after mocks ──────────────────────────────────────────────────────────
import { getHourlySales } from '../src/reporting/hourly-sales';

const BASE_CTX = {
  userId: 'user-1',
  tenantId: 'tenant-1',
  locationId: 'loc-1',
  ip: '127.0.0.1',
  userAgent: 'test',
  requestId: 'req-1',
};

// Helper: build a sale record at a given UTC time.
// WIB = UTC+7, store hours 10–22 WIB = UTC hours 3–15.
function sale(
  id: string,
  utcYear: number, utcMonth: number, utcDay: number,
  utcHour: number,
  subtotal: string,
  channel: string,
) {
  return {
    id,
    placedAt: new Date(Date.UTC(utcYear, utcMonth - 1, utcDay, utcHour, 0, 0, 0)),
    subtotal: BigInt(subtotal),
    channel,
  };
}

// Helper: configure the mock to return given rows
function withResult(rows: unknown[]) {
  mockDbSelect.mockImplementationOnce(
    () => ({
      from: () => ({
        where: () => Promise.resolve(rows),
      }),
    }),
  );
}

// ── Tests ────────────────────────────────────────────────────────────────────────

describe('getHourlySales', () => {
  beforeEach(() => {
    mockDbSelect.mockReset();
    mockDbSelect.mockReturnValue({
      from: () => ({ where: () => Promise.resolve([]) }),
    });
  });

  it('returns empty result when no sales', async () => {
    withResult([]);

    const result = await getHourlySales(
      { locationId: 'loc-1', startDate: '2026-05-01', endDate: '2026-05-01', groupBy: 'channel' },
      BASE_CTX,
    );

    expect(result.ok).toBe(true);
    expect(result.value!.totalTxCount).toBe(0);
    expect(result.value!.totalGrossSales).toBe('0');
    for (let h = 10; h < 22; h++) {
      expect(result.value!.hourTotals[h.toString()]!.txCount).toBe(0);
    }
  });

  it('aggregates by channel correctly', async () => {
    // 12:00 WIB = UTC 05, 14:00 WIB = UTC 07
    withResult([
      sale('s1', 2026, 5, 1, 5, '10000', 'gofood'),
      sale('s2', 2026, 5, 1, 5, '20000', 'gofood'),
      sale('s3', 2026, 5, 1, 7, '15000', 'dine_in'),
    ]);

    const result = await getHourlySales(
      { locationId: 'loc-1', startDate: '2026-05-01', endDate: '2026-05-01', groupBy: 'channel' },
      BASE_CTX,
    );

    expect(result.ok).toBe(true);
    const gofood = result.value!.channelRows!.find((r) => r.channel === 'gofood')!;
    expect(gofood.hourBreakdown['12']!.txCount).toBe(2);
    expect(gofood.hourBreakdown['12']!.grossSales).toBe('30000');

    const dineIn = result.value!.channelRows!.find((r) => r.channel === 'dine_in')!;
    expect(dineIn.hourBreakdown['14']!.txCount).toBe(1);
    expect(dineIn.hourBreakdown['14']!.grossSales).toBe('15000');

    expect(result.value!.totalTxCount).toBe(3);
    expect(result.value!.totalGrossSales).toBe('45000');
  });

  it('aggregates by day correctly', async () => {
    // 13:00 WIB = UTC 06, 11:00 WIB = UTC 04
    withResult([
      sale('s1', 2026, 5, 1, 6, '10000', 'dine_in'),
      sale('s2', 2026, 5, 1, 6, '20000', 'take_away'),
      sale('s3', 2026, 5, 2, 4, '15000', 'gofood'),
    ]);

    const result = await getHourlySales(
      { locationId: 'loc-1', startDate: '2026-05-01', endDate: '2026-05-02', groupBy: 'day' },
      BASE_CTX,
    );

    expect(result.ok).toBe(true);
    const may1 = result.value!.dayRows!.find((r) => r.date === '2026-05-01')!;
    const may2 = result.value!.dayRows!.find((r) => r.date === '2026-05-02')!;

    expect(may1.hourBreakdown['13']!.txCount).toBe(2);
    expect(may1.hourBreakdown['13']!.grossSales).toBe('30000');

    expect(may2.hourBreakdown['11']!.txCount).toBe(1);
    expect(may2.hourBreakdown['11']!.grossSales).toBe('15000');

    expect(result.value!.totalTxCount).toBe(3);
    expect(result.value!.totalGrossSales).toBe('45000');
  });

  it('hourTotals accumulate from all channels', async () => {
    // 15:00 WIB = UTC 08, 18:00 WIB = UTC 11
    withResult([
      sale('s1', 2026, 5, 1, 8, '10000', 'gofood'),
      sale('s2', 2026, 5, 1, 8, '20000', 'grabfood'),
      sale('s3', 2026, 5, 1, 11, '30000', 'dine_in'),
    ]);

    const result = await getHourlySales(
      { locationId: 'loc-1', startDate: '2026-05-01', endDate: '2026-05-01', groupBy: 'channel' },
      BASE_CTX,
    );

    expect(result.ok).toBe(true);
    expect(result.value!.hourTotals['15']!.txCount).toBe(2);
    expect(result.value!.hourTotals['15']!.grossSales).toBe('30000');
    expect(result.value!.hourTotals['18']!.txCount).toBe(1);
    expect(result.value!.hourTotals['18']!.grossSales).toBe('30000');
    expect(result.value!.hourTotals['10']!.txCount).toBe(0);
  });

  it('excludes sales outside store hours (09:00 and 23:00 WIB)', async () => {
    // 09:00 WIB = UTC 02, 23:00 WIB = UTC 16, 10:00 WIB = UTC 03
    withResult([
      sale('s1', 2026, 5, 1, 2, '10000', 'dine_in'),
      sale('s2', 2026, 5, 1, 16, '20000', 'dine_in'),
      sale('s3', 2026, 5, 1, 3, '15000', 'dine_in'),
    ]);

    const result = await getHourlySales(
      { locationId: 'loc-1', startDate: '2026-05-01', endDate: '2026-05-01', groupBy: 'channel' },
      BASE_CTX,
    );

    expect(result.ok).toBe(true);
    expect(result.value!.totalTxCount).toBe(1);
    expect(result.value!.totalGrossSales).toBe('15000');
    expect(result.value!.hourTotals['10']!.txCount).toBe(1);
    expect(result.value!.hourTotals['10']!.grossSales).toBe('15000');
  });

  it('uses bigint for all money values — exact integer arithmetic', async () => {
    withResult([sale('s1', 2026, 5, 1, 5, '999999999999999', 'dine_in')]);

    const result = await getHourlySales(
      { locationId: 'loc-1', startDate: '2026-05-01', endDate: '2026-05-01', groupBy: 'channel' },
      BASE_CTX,
    );

    expect(result.ok).toBe(true);
    expect(result.value!.totalGrossSales).toBe('999999999999999');
    expect(Number(result.value!.totalGrossSales)).toBe(999999999999999);
  });

  it('includes all 5 channels even if channel has no sales', async () => {
    withResult([sale('s1', 2026, 5, 1, 5, '10000', 'gofood')]);

    const result = await getHourlySales(
      { locationId: 'loc-1', startDate: '2026-05-01', endDate: '2026-05-01', groupBy: 'channel' },
      BASE_CTX,
    );

    expect(result.ok).toBe(true);
    expect(result.value!.channelRows!.length).toBe(5);
    const channels = result.value!.channelRows!.map((r) => r.channel);
    expect(channels).toContain('dine_in');
    expect(channels).toContain('take_away');
    expect(channels).toContain('gofood');
    expect(channels).toContain('grabfood');
    expect(channels).toContain('shopeefood');
  });

  it('returns error when user lacks permission', async () => {
    // Override the IAM mock to return forbidden
    const { requirePermission } = await import('../src/iam');
    (requirePermission as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      error: { code: 'FORBIDDEN', messageKey: 'common.errors.forbidden' },
    } as never);

    const result = await getHourlySales(
      { locationId: 'loc-1', startDate: '2026-05-01', endDate: '2026-05-01' },
      BASE_CTX,
    );

    expect(result.ok).toBe(false);
  });
});