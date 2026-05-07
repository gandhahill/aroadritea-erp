/**
 * Tests for tax.listRates + tax.getRateByCode — T-0019
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- DB Mock ---
let selectCallIndex = 0;
let selectResults: unknown[][] = [];

vi.mock('@erp/db', () => ({
  db: {
    select: (..._args: unknown[]) => ({
      from: (..._fArgs: unknown[]) => ({
        where: (..._wArgs: unknown[]) => {
          const idx = selectCallIndex++;
          const rows = selectResults[idx] ?? [];
          return {
            then: (fn: (r: unknown[]) => unknown) => fn(rows),
          };
        },
      }),
    }),
  },
}));

// --- Mock IAM ---
let mockPermissionResult = true;
vi.mock('../src/iam', () => ({
  requirePermission: vi.fn(async () => {
    if (mockPermissionResult) return { ok: true, value: undefined };
    return { ok: false, error: { code: 'FORBIDDEN', messageKey: 'common.errors.forbidden' } };
  }),
}));

// --- Import after mocks ---
import { listRates, getRateByCode } from '../src/tax/list-rates';
import type { AuditContext } from '@erp/shared/types';

function makeCtx(): AuditContext {
  return { userId: 'user-001', tenantId: 'default', locationId: 'loc-mli', ipAddress: '127.0.0.1' };
}

function makeTaxRate(overrides?: Record<string, unknown>) {
  return {
    id: 'tax-pb1',
    code: 'PB1',
    name: { id: 'Pajak Restoran (10%)', en: 'Restaurant Tax (10%)', zh: '餐饮税 (10%)' },
    rateBps: 1000,
    calculation: 'inclusive',
    postingAccountId: 'acc-pb1-payable',
    isActive: true,
    effectiveFrom: '2024-01-01',
    effectiveUntil: null,
    ...overrides,
  };
}

function resetMocks() {
  selectCallIndex = 0;
  selectResults = [];
}

describe('listRates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPermissionResult = true;
    resetMocks();
  });

  it('should return all active tax rates', async () => {
    selectResults = [[makeTaxRate(), makeTaxRate({ id: 'tax-ppn', code: 'PPN_OUT', rateBps: 1100 })]];
    const result = await listRates({}, makeCtx());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(2);
      expect(result.value[0].code).toBe('PB1');
      expect(result.value[0].ratePercent).toBe(10);
      expect(result.value[1].ratePercent).toBe(11);
    }
  });

  it('should convert rateBps to ratePercent correctly', async () => {
    selectResults = [[makeTaxRate({ rateBps: 200 })]]; // 2%
    const result = await listRates({}, makeCtx());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value[0].ratePercent).toBe(2);
    }
  });

  it('should handle fractional percent', async () => {
    selectResults = [[makeTaxRate({ rateBps: 50 })]]; // 0.5%
    const result = await listRates({}, makeCtx());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value[0].ratePercent).toBe(0.5);
    }
  });

  it('should return empty array when no rates', async () => {
    selectResults = [[]];
    const result = await listRates({}, makeCtx());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(0);
    }
  });

  it('should reject without permission', async () => {
    mockPermissionResult = false;
    const result = await listRates({}, makeCtx());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('FORBIDDEN');
  });
});

describe('getRateByCode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPermissionResult = true;
    resetMocks();
  });

  it('should return a specific tax rate', async () => {
    selectResults = [[makeTaxRate()]];
    const result = await getRateByCode('PB1', makeCtx());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.code).toBe('PB1');
      expect(result.value.calculation).toBe('inclusive');
      expect(result.value.rateBps).toBe(1000);
    }
  });

  it('should return NOT_FOUND for unknown code', async () => {
    selectResults = [[]];
    const result = await getRateByCode('NONEXISTENT', makeCtx());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('NOT_FOUND');
      expect(result.error.messageKey).toBe('tax.rate.notFound');
    }
  });

  it('should reject without permission', async () => {
    mockPermissionResult = false;
    const result = await getRateByCode('PB1', makeCtx());
    expect(result.ok).toBe(false);
  });

  it('should include name as trilingual object', async () => {
    selectResults = [[makeTaxRate()]];
    const result = await getRateByCode('PB1', makeCtx());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.name.id).toContain('Pajak');
      expect(result.value.name.en).toContain('Tax');
      expect(result.value.name.zh).toContain('税');
    }
  });
});
