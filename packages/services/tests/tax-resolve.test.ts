/**
 * Tests for tax.resolve — T-0019c
 *
 * Tests the tax resolution engine per SD §19.3.3.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- DB Mock ---

// We need to mock both taxRules and taxRates queries
let queryCallIndex = 0;
let queryResults: unknown[][] = [];

vi.mock('@erp/db', () => ({
  db: {
    select: (..._args: unknown[]) => ({
      from: (..._fArgs: unknown[]) => ({
        where: (..._wArgs: unknown[]) => {
          const idx = queryCallIndex++;
          return queryResults[idx] ?? [];
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
import { resolve } from '../src/tax/resolve';
import type { AuditContext } from '@erp/shared/types';

function makeCtx(): AuditContext {
  return { userId: 'user-001', tenantId: 'default', locationId: 'loc-mli', ipAddress: '127.0.0.1' };
}

function makeRule(overrides?: Record<string, unknown>) {
  return {
    id: 'rule-001',
    tenantId: 'default',
    scopeKind: 'channel',
    scopeId: 'walk_in',
    taxCode: 'PB1',
    isAppliedDefault: true,
    priority: 100,
    effectiveFrom: '2024-01-01',
    effectiveUntil: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    createdBy: null,
    updatedBy: null,
    ...overrides,
  };
}

function makeRate(overrides?: Record<string, unknown>) {
  return {
    id: 'rate-pb1',
    code: 'PB1',
    name: { id: 'Pajak Restoran', en: 'Restaurant Tax', zh: '餐饮税' },
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
  queryCallIndex = 0;
  queryResults = [];
}

describe('tax.resolve', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPermissionResult = true;
    resetMocks();
  });

  it('should resolve PB1 for walk_in channel', async () => {
    // Query 1: tax_rules (effective, matching channel)
    queryResults = [
      [makeRule()], // tax_rules result
      [makeRate()], // tax_rates result
    ];

    const result = await resolve(
      { channel: 'walk_in', documentKind: 'sales', effectiveDate: '2026-05-07' },
      makeCtx(),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(1);
      expect(result.value[0].taxCode).toBe('PB1');
      expect(result.value[0].rateBps).toBe(1000);
      expect(result.value[0].ratePercent).toBe(10);
      expect(result.value[0].calculation).toBe('inclusive');
    }
  });

  it('should resolve PB1 for gofood channel', async () => {
    queryResults = [
      [makeRule({ scopeId: 'gofood' })],
      [makeRate()],
    ];

    const result = await resolve(
      { channel: 'gofood', documentKind: 'sales', effectiveDate: '2026-05-07' },
      makeCtx(),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(1);
      expect(result.value[0].taxCode).toBe('PB1');
    }
  });

  it('should resolve global_default PPN_IN for purchases', async () => {
    queryResults = [
      [makeRule({ scopeKind: 'global_default', scopeId: null, taxCode: 'PPN_IN', priority: 10 })],
      [makeRate({ code: 'PPN_IN', rateBps: 1100, calculation: 'exclusive', postingAccountId: 'acc-ppn-in' })],
    ];

    const result = await resolve(
      { documentKind: 'purchase', effectiveDate: '2026-05-07' },
      makeCtx(),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(1);
      expect(result.value[0].taxCode).toBe('PPN_IN');
      expect(result.value[0].rateBps).toBe(1100);
      expect(result.value[0].calculation).toBe('exclusive');
    }
  });

  it('should NOT include rules where is_applied_default=false', async () => {
    queryResults = [
      [makeRule({ taxCode: 'PPN_OUT', isAppliedDefault: false, scopeKind: 'global_default', scopeId: null })],
      [], // no rates lookup needed since no codes matched
    ];

    const result = await resolve(
      { channel: 'walk_in', documentKind: 'sales', effectiveDate: '2026-05-07' },
      makeCtx(),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(0);
    }
  });

  it('should pick highest priority rule when multiple match for same tax_code', async () => {
    queryResults = [
      [
        makeRule({ id: 'r1', scopeKind: 'global_default', scopeId: null, taxCode: 'PB1', priority: 10 }),
        makeRule({ id: 'r2', scopeKind: 'channel', scopeId: 'walk_in', taxCode: 'PB1', priority: 100 }),
      ],
      [makeRate()],
    ];

    const result = await resolve(
      { channel: 'walk_in', documentKind: 'sales', effectiveDate: '2026-05-07' },
      makeCtx(),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(1);
      expect(result.value[0].taxCode).toBe('PB1');
    }
  });

  it('should resolve multiple tax codes when applicable', async () => {
    queryResults = [
      [
        makeRule({ taxCode: 'PB1', scopeKind: 'channel', scopeId: 'walk_in', priority: 100 }),
        makeRule({ taxCode: 'PPN_IN', scopeKind: 'global_default', scopeId: null, priority: 10 }),
      ],
      [
        makeRate(),
        makeRate({ code: 'PPN_IN', rateBps: 1100, calculation: 'exclusive', postingAccountId: 'acc-ppn-in' }),
      ],
    ];

    const result = await resolve(
      { channel: 'walk_in', documentKind: 'sales', effectiveDate: '2026-05-07' },
      makeCtx(),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(2);
      const codes = result.value.map((t) => t.taxCode);
      expect(codes).toContain('PB1');
      expect(codes).toContain('PPN_IN');
    }
  });

  it('should return empty array when no rules match', async () => {
    queryResults = [
      [], // no rules
    ];

    const result = await resolve(
      { channel: 'unknown_channel', documentKind: 'sales', effectiveDate: '2026-05-07' },
      makeCtx(),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(0);
    }
  });

  it('should skip tax codes where the rate is inactive', async () => {
    queryResults = [
      [makeRule({ taxCode: 'PPN_OUT' })],
      [], // rate is inactive — not returned from DB
    ];

    const result = await resolve(
      { channel: 'walk_in', documentKind: 'sales', effectiveDate: '2026-05-07' },
      makeCtx(),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(0);
    }
  });

  it('should not match channel rules when no channel provided', async () => {
    queryResults = [
      [makeRule({ scopeKind: 'channel', scopeId: 'walk_in' })],
    ];

    const result = await resolve(
      { documentKind: 'sales', effectiveDate: '2026-05-07' },
      makeCtx(),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(0);
    }
  });

  it('should reject without permission', async () => {
    mockPermissionResult = false;
    const result = await resolve(
      { channel: 'walk_in', documentKind: 'sales' },
      makeCtx(),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('FORBIDDEN');
  });

  it('should match product_category scope', async () => {
    queryResults = [
      [makeRule({ scopeKind: 'product_category', scopeId: 'cat-beverages', taxCode: 'PB1' })],
      [makeRate()],
    ];

    const result = await resolve(
      { productCategoryId: 'cat-beverages', documentKind: 'sales', effectiveDate: '2026-05-07' },
      makeCtx(),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(1);
      expect(result.value[0].taxCode).toBe('PB1');
    }
  });
});
