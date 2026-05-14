/**
 * Tests for reporting.cashFlow.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

let queryCallIndex = 0;
let queryResults: unknown[][] = [];

function nextResult() {
  const idx = queryCallIndex;
  queryCallIndex += 1;
  return queryResults[idx] ?? [];
}

vi.mock('@erp/db', () => ({
  db: {
    select: (..._args: unknown[]) => ({
      from: (..._fArgs: unknown[]) => ({
        where: (..._wArgs: unknown[]) => nextResult(),
        innerJoin: (..._jArgs: unknown[]) => ({
          where: (..._wArgs: unknown[]) => nextResult(),
          innerJoin: (..._j2Args: unknown[]) => ({
            where: (..._wArgs: unknown[]) => ({
              orderBy: (..._oArgs: unknown[]) => nextResult(),
            }),
          }),
        }),
      }),
    }),
  },
}));

let mockPermissionResult = true;
vi.mock('../src/iam', () => ({
  requirePermission: vi.fn(async () => {
    if (mockPermissionResult) return { ok: true, value: undefined };
    return { ok: false, error: { code: 'FORBIDDEN', messageKey: 'common.errors.forbidden' } };
  }),
}));

import type { AuditContext } from '@erp/shared/types';
import { cashFlow } from '../src/reporting/cash-flow';

function makeCtx(): AuditContext {
  return { userId: 'user-001', tenantId: 'default', locationId: 'loc-mli', ipAddress: '127.0.0.1' };
}

function resetMocks() {
  queryCallIndex = 0;
  queryResults = [];
  mockPermissionResult = true;
  vi.clearAllMocks();
}

describe('cashFlow', () => {
  beforeEach(resetMocks);

  it('computes operating, investing, financing, beginning cash, and ending cash', async () => {
    queryResults = [
      [{ id: 'acc-cash', code: '1-1020' }],
      [{ debit: 100000n, credit: 0n }],
      [
        {
          journalEntryId: 'je-sale',
          postingDate: '2026-05-01',
          journalNumber: 'JE-001',
          journalDescription: 'POS sale',
          referenceType: 'sales',
          referenceId: 'sale-1',
          lineNo: 1,
          accountId: 'acc-cash',
          accountCode: '1-1020',
          accountType: 'asset',
          accountSubtype: 'current_asset',
          debit: 110000n,
          credit: 0n,
        },
        {
          journalEntryId: 'je-sale',
          postingDate: '2026-05-01',
          journalNumber: 'JE-001',
          journalDescription: 'POS sale',
          referenceType: 'sales',
          referenceId: 'sale-1',
          lineNo: 2,
          accountId: 'acc-sales',
          accountCode: '4-1010',
          accountType: 'income',
          accountSubtype: 'revenue',
          debit: 0n,
          credit: 100000n,
        },
        {
          journalEntryId: 'je-exp',
          postingDate: '2026-05-02',
          journalNumber: 'JE-002',
          journalDescription: 'Operating expense',
          referenceType: 'manual',
          referenceId: null,
          lineNo: 1,
          accountId: 'acc-expense',
          accountCode: '6-1010',
          accountType: 'expense',
          accountSubtype: 'operating',
          debit: 40000n,
          credit: 0n,
        },
        {
          journalEntryId: 'je-exp',
          postingDate: '2026-05-02',
          journalNumber: 'JE-002',
          journalDescription: 'Operating expense',
          referenceType: 'manual',
          referenceId: null,
          lineNo: 2,
          accountId: 'acc-cash',
          accountCode: '1-1020',
          accountType: 'asset',
          accountSubtype: 'current_asset',
          debit: 0n,
          credit: 40000n,
        },
        {
          journalEntryId: 'je-asset',
          postingDate: '2026-05-03',
          journalNumber: 'JE-003',
          journalDescription: 'Buy equipment',
          referenceType: 'manual',
          referenceId: null,
          lineNo: 1,
          accountId: 'acc-equipment',
          accountCode: '1-2130',
          accountType: 'asset',
          accountSubtype: 'fixed_asset',
          debit: 25000n,
          credit: 0n,
        },
        {
          journalEntryId: 'je-asset',
          postingDate: '2026-05-03',
          journalNumber: 'JE-003',
          journalDescription: 'Buy equipment',
          referenceType: 'manual',
          referenceId: null,
          lineNo: 2,
          accountId: 'acc-cash',
          accountCode: '1-1020',
          accountType: 'asset',
          accountSubtype: 'current_asset',
          debit: 0n,
          credit: 25000n,
        },
        {
          journalEntryId: 'je-loan',
          postingDate: '2026-05-04',
          journalNumber: 'JE-004',
          journalDescription: 'Bank loan',
          referenceType: 'manual',
          referenceId: null,
          lineNo: 1,
          accountId: 'acc-cash',
          accountCode: '1-1020',
          accountType: 'asset',
          accountSubtype: 'current_asset',
          debit: 500000n,
          credit: 0n,
        },
        {
          journalEntryId: 'je-loan',
          postingDate: '2026-05-04',
          journalNumber: 'JE-004',
          journalDescription: 'Bank loan',
          referenceType: 'manual',
          referenceId: null,
          lineNo: 2,
          accountId: 'acc-loan',
          accountCode: '2-2010',
          accountType: 'liability',
          accountSubtype: 'long_term_liability',
          debit: 0n,
          credit: 500000n,
        },
      ],
    ];

    const result = await cashFlow({ from: '2026-05-01', to: '2026-05-31' }, makeCtx());

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.beginningCash).toBe(100000n);
      expect(result.value.operating.inflow).toBe(110000n);
      expect(result.value.operating.outflow).toBe(40000n);
      expect(result.value.operating.net).toBe(70000n);
      expect(result.value.investing.outflow).toBe(25000n);
      expect(result.value.financing.inflow).toBe(500000n);
      expect(result.value.netIncrease).toBe(545000n);
      expect(result.value.endingCash).toBe(645000n);
    }
  });

  it('rejects without accounting view permission', async () => {
    mockPermissionResult = false;

    const result = await cashFlow({ from: '2026-05-01', to: '2026-05-31' }, makeCtx());

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('FORBIDDEN');
  });

  it('rejects when no configured cash accounts are found', async () => {
    queryResults = [[]];

    const result = await cashFlow(
      { from: '2026-05-01', to: '2026-05-31', cashAccountCodes: ['9-9999'] },
      makeCtx(),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('VALIDATION_FAILED');
  });
});
