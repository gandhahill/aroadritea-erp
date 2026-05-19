/**
 * Tests for approvePayroll + markPayrollPaid — T-0103
 *
 * Pattern from accounting-create-journal.test.ts: use spread (...args: unknown[])
 * to capture calls and return sequential results via counter.
 *
 * Query order in approvePayroll (db.select() calls):
 *   slot[0] = payrolls.where → payroll row
 *   slot[1] = payrollLines.innerJoin → lines rows
 *   slot[2] = accounts.where → account rows
 *
 * Query order in markPayrollPaid:
 *   slot[0] = payrolls.where → payroll row
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

let _selIdx = 0;
let _selResults: unknown[][] = [];
const _updates: unknown[][] = [];

vi.mock('@erp/db', () => ({
  db: {
    select: (..._args: unknown[]) => ({
      from: () => ({
        where: () => {
          // Each where() call = one DB query; both .then() and .limit() share one slot
          const slot = _selIdx++;
          return {
            then: (fn: (r: unknown[]) => unknown) => fn(_selResults[slot] ?? []),
            limit: () => ({
              then: (fn: (r: unknown[]) => unknown) => fn(_selResults[slot] ?? []),
            }),
            innerJoin: () => ({
              where: () => {
                const slot2 = _selIdx++;
                return {
                  then: (fn: (r: unknown[]) => unknown) => fn(_selResults[slot2] ?? []),
                  innerJoin: () => ({
                    where: () => {
                      const slot3 = _selIdx++;
                      return {
                        then: (fn: (r: unknown[]) => unknown) => fn(_selResults[slot3] ?? []),
                      };
                    },
                  }),
                };
              },
            }),
          };
        },
        innerJoin: () => ({
          where: () => {
            const slot2 = _selIdx++;
            return {
              then: (fn: (r: unknown[]) => unknown) => fn(_selResults[slot2] ?? []),
              innerJoin: () => ({
                where: () => {
                  const slot3 = _selIdx++;
                  return {
                    then: (fn: (r: unknown[]) => unknown) => fn(_selResults[slot3] ?? []),
                  };
                },
              }),
            };
          },
        }),
      }),
    }),
    update: () => ({
      set: (data: unknown) => ({
        where: () => {
          _updates.push(data);
          // Support both `.where(...)` and `.where(...).returning(...)`
          // call shapes — the latter is needed for claim-first updates.
          const result: any = Promise.resolve([{ id: 'mock-id' }]);
          result.returning = () => Promise.resolve([{ id: 'mock-id' }]);
          return result;
        },
      }),
    }),
    insert: () => ({
      values: () => Promise.resolve({}),
    }),
  },
}));

vi.mock('../src/accounting/create-journal', () => ({
  createJournal: vi.fn(() => Promise.resolve({ ok: true, value: { id: 'je-1' } })),
}));

// Mock permission engine at the source so the entire IAM chain is bypassed
vi.mock('../src/iam/permission-engine', () => ({
  can: vi.fn(() => Promise.resolve(true)),
  invalidatePermissionCache: vi.fn(),
}));

// Mock requirePermission directly to bypass the entire IAM chain
vi.mock('../src/iam', () => ({
  requirePermission: vi.fn(() => Promise.resolve({ ok: true, value: undefined })),
}));

vi.mock('@erp/shared/errors', () => ({
  AppError: class AppError extends Error {
    constructor(
      public code: string,
      public details?: Record<string, unknown>,
    ) {
      super(code);
    }
    static notFound(code: string, details?: Record<string, unknown>) {
      return new this(code, details);
    }
    static conflict(code: string, details?: Record<string, unknown>) {
      return new this(code, details);
    }
    static internal(code: string, e?: unknown) {
      return new this(code, { error: String(e) });
    }
    static forbidden(code: string) {
      return new this(code);
    }
    static validation(code: string, details?: Record<string, unknown>) {
      return new this(code, details);
    }
    static businessRule(code: string, details?: Record<string, unknown>) {
      return new this(code, details);
    }
  },
}));

import type { AuditContext } from '@erp/shared/types';
import { approvePayroll, markPayrollPaid } from '../src/payroll/approve-payroll.js';

// ─── Fixtures ───────────────────────────────────────────────────────────────

const FIXED_TS = new Date('2026-05-31T00:00:00Z');

function ctxt() {
  return { userId: 'user-1', tenantId: 'tenant-1', locationId: 'loc-1' } as AuditContext;
}

function payrollRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'p1',
    tenantId: 'tenant-1',
    locationId: 'loc-1',
    periodCode: '2026-05',
    periodEnd: FIXED_TS,
    totalNet: 13_080_000n, // gross 14M minus PPh 500K minus BPJS Kes 140K minus BPJS TK 280K
    totalEarnings: 14_000_000n,
    status: 'draft',
    ...overrides,
  };
}

// lineRow: simulates a payrollLine row from DB query (innerJoin with salaryComponents)
// componentCode matches salaryComponents.code for aggregation in approvePayroll
function lineRow(code: string, kind: string, amount: number) {
  return {
    line: {
      amount: BigInt(amount),
      payrollId: 'p1',
      employeeId: 'e1',
      salaryComponentId: 'sc1',
      componentKind: kind,
    },
    componentCode: code,
    componentKind: kind,
  };
}

// Period row needed by createJournal (looks up period by month of postingDate)
function periodRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'per-2026-05',
    tenantId: 'tenant-1',
    code: '2026-05',
    status: 'open',
    startDate: new Date('2026-05-01'),
    endDate: new Date('2026-05-31'),
    ...overrides,
  };
}

const ACCTS = [
  { id: 'BS6201', code: 'BS-6201', isActive: true, isPostable: true },
  { id: 'LS2201', code: 'LS-2201', isActive: true, isPostable: true },
  { id: 'LS2202', code: 'LS-2202', isActive: true, isPostable: true },
  { id: 'LS2203', code: 'LS-2203', isActive: true, isPostable: true },
  { id: 'AS1101', code: 'AS-1101', isActive: true, isPostable: true },
];

beforeEach(() => {
  _selIdx = 0;
  _selResults = [];
  _updates.length = 0;
  vi.clearAllMocks();
});

// ─── Guards ─────────────────────────────────────────────────────────────────

describe('approvePayroll — guards', () => {
  it('not found', async () => {
    _selResults = [[]];
    const result = await approvePayroll({ payrollId: 'x' }, ctxt());
    expect(result.ok).toBe(false);
  });

  it('approved conflict', async () => {
    _selResults = [[payrollRow({ status: 'approved' })]];
    const result = await approvePayroll({ payrollId: 'p1' }, ctxt());
    expect(result.ok).toBe(false);
  });

  it('paid conflict', async () => {
    _selResults = [[payrollRow({ status: 'paid' })]];
    const result = await approvePayroll({ payrollId: 'p1' }, ctxt());
    expect(result.ok).toBe(false);
  });

  it('pending_approval is valid', async () => {
    _selResults = [
      [payrollRow({ status: 'pending_approval' })],
      [lineRow('BASE', 'earning', 14_000_000)],
      [ACCTS[0], ACCTS[4]],
    ];
    const result = await approvePayroll({ payrollId: 'p1' }, ctxt());
    expect(result.ok).toBe(true);
  });
});

// ─── JE creation ────────────────────────────────────────────────────────────

describe('approvePayroll — JE creation', () => {
  it('passes referenceType=payroll and referenceId to createJournal', async () => {
    _selResults = [
      [payrollRow()],
      [
        lineRow('BASE', 'earning', 14_000_000),
        lineRow('PPh21', 'deduction', 500_000),
        lineRow('KES', 'deduction', 140_000),
        lineRow('TK', 'deduction', 280_000),
      ],
      ACCTS,
    ];
    const result = await approvePayroll({ payrollId: 'p1' }, ctxt());
    expect(result.ok).toBe(true);
    const { createJournal } = await import('../src/accounting/create-journal');
    expect(createJournal).toHaveBeenCalled();
    const call = createJournal.mock.calls[0]![0] as Record<string, unknown>;
    expect(call.referenceType).toBe('payroll');
    expect(call.referenceId).toBe('p1');
    expect(call.postingDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('omits PPh21 credit line when zero deduction', async () => {
    _selResults = [[payrollRow()], [lineRow('BASE', 'earning', 14_000_000)], [ACCTS[0], ACCTS[4]]];
    await approvePayroll({ payrollId: 'p1' }, ctxt());
    const { createJournal } = await import('../src/accounting/create-journal');
    const call = createJournal.mock.calls[0]![0] as { lines: Record<string, unknown>[] };
    expect(call.lines.length).toBe(2); // DR salaries + CR cash
  });

  it('omits BPJS credit lines when zero deduction', async () => {
    _selResults = [
      [payrollRow()],
      [lineRow('BASE', 'earning', 14_000_000), lineRow('PPh21', 'deduction', 500_000)],
      [ACCTS[0], ACCTS[1], ACCTS[4]],
    ];
    await approvePayroll({ payrollId: 'p1' }, ctxt());
    const { createJournal } = await import('../src/accounting/create-journal');
    const call = createJournal.mock.calls[0]![0] as { lines: Record<string, unknown>[] };
    expect(call.lines.length).toBe(3); // DR + PPh21 CR + cash CR
  });

  it('missing required account → failure', async () => {
    _selResults = [
      [payrollRow()],
      [lineRow('BASE', 'earning', 14_000_000)],
      [[ACCTS[0]]], // missing LS-2201, LS-2202, LS-2203, AS-1101
    ];
    const result = await approvePayroll({ payrollId: 'p1' }, ctxt());
    expect(result.ok).toBe(false);
  });

  it('createJournal failure propagates error', async () => {
    _selResults = [[payrollRow()], [lineRow('BASE', 'earning', 14_000_000)], ACCTS];
    const { createJournal } = await import('../src/accounting/create-journal');
    vi.mocked(createJournal).mockResolvedValueOnce({
      ok: false,
      error: { code: 'JE_FAIL' },
    });
    const result = await approvePayroll({ payrollId: 'p1' }, ctxt());
    expect(result.ok).toBe(false);
  });
});

// ─── Status update ──────────────────────────────────────────────────────────

describe('approvePayroll — status update', () => {
  it('updates payroll to approved with journalEntryId', async () => {
    _selResults = [[payrollRow()], [lineRow('BASE', 'earning', 14_000_000)], ACCTS];
    const result = await approvePayroll({ payrollId: 'p1' }, ctxt());
    expect(result.ok).toBe(true);
    expect(_updates.length).toBeGreaterThan(0);
    const updateData = _updates[0] as Record<string, unknown>;
    expect(updateData.status).toBe('approved');
    expect(updateData.journalEntryId).toBe('je-1');
    expect(updateData.approvedBy).toBe('user-1');
  });
});

// ─── markPayrollPaid ────────────────────────────────────────────────────────

describe('markPayrollPaid', () => {
  it('not found', async () => {
    _selResults = [[]];
    const result = await markPayrollPaid({ payrollId: 'x' }, ctxt());
    expect(result.ok).toBe(false);
  });

  it('draft conflict', async () => {
    _selResults = [[payrollRow({ status: 'draft' })]];
    const result = await markPayrollPaid({ payrollId: 'p1' }, ctxt());
    expect(result.ok).toBe(false);
  });

  it('approved → paid ok', async () => {
    _selResults = [[payrollRow({ status: 'approved' })]];
    const result = await markPayrollPaid({ payrollId: 'p1' }, ctxt());
    expect(result.ok).toBe(true);
    expect(_updates.length).toBeGreaterThan(0);
    const updateData = _updates[0] as Record<string, unknown>;
    expect(updateData.status).toBe('paid');
  });
});
