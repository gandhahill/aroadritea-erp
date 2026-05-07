/**
 * Tests for accounting.closePeriod + getPeriodStatus — T-0015
 *
 * Unit tests with mocked DB layer. Tests period lifecycle
 * and business rules per SD §20.4, §21.1.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Sequenced DB Mock ---
let selectCallIndex = 0;
let selectResults: unknown[][] = [];
const insertCalls: unknown[][] = [];
const updateCalls: unknown[][] = [];

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
    update: (..._args: unknown[]) => ({
      set: (...sArgs: unknown[]) => {
        updateCalls.push(sArgs);
        return {
          where: () => Promise.resolve(),
        };
      },
    }),
    insert: (..._args: unknown[]) => ({
      values: (...vArgs: unknown[]) => {
        insertCalls.push(vArgs);
        return Promise.resolve();
      },
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
import { closePeriod, getPeriodStatus } from '../src/accounting/close-period';
import { ClosePeriodInputSchema, GetPeriodStatusInputSchema } from '../src/accounting/schemas';
import type { AuditContext } from '@erp/shared/types';

// --- Test data ---

function makeCtx(overrides?: Partial<AuditContext>): AuditContext {
  return {
    userId: 'user-001',
    tenantId: 'default',
    locationId: 'loc-mli',
    ipAddress: '127.0.0.1',
    ...overrides,
  };
}

function makePeriod(overrides?: Record<string, unknown>) {
  return {
    id: 'period-2026-05',
    tenantId: 'default',
    code: '2026-05',
    startDate: '2026-05-01',
    endDate: '2026-05-31',
    status: 'open',
    closedAt: null,
    closedBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    createdBy: 'user-001',
    updatedBy: 'user-001',
    ...overrides,
  };
}

function resetMocks() {
  selectCallIndex = 0;
  selectResults = [];
  insertCalls.length = 0;
  updateCalls.length = 0;
}

// --- Schema Tests ---

describe('ClosePeriodInputSchema (Zod)', () => {
  it('should accept valid period code', () => {
    expect(ClosePeriodInputSchema.safeParse({ periodCode: '2026-05' }).success).toBe(true);
  });

  it('should accept with force flag', () => {
    expect(ClosePeriodInputSchema.safeParse({ periodCode: '2026-12', force: true }).success).toBe(true);
  });

  it('should default force to false', () => {
    const result = ClosePeriodInputSchema.safeParse({ periodCode: '2026-05' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.force).toBe(false);
  });

  it('should reject invalid period code format', () => {
    expect(ClosePeriodInputSchema.safeParse({ periodCode: '2026-5' }).success).toBe(false);
    expect(ClosePeriodInputSchema.safeParse({ periodCode: '05-2026' }).success).toBe(false);
    expect(ClosePeriodInputSchema.safeParse({ periodCode: '2026' }).success).toBe(false);
  });
});

describe('GetPeriodStatusInputSchema (Zod)', () => {
  it('should accept valid period code', () => {
    expect(GetPeriodStatusInputSchema.safeParse({ periodCode: '2026-05' }).success).toBe(true);
  });

  it('should reject invalid format', () => {
    expect(GetPeriodStatusInputSchema.safeParse({ periodCode: '' }).success).toBe(false);
  });
});

// --- getPeriodStatus Tests ---

describe('getPeriodStatus service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPermissionResult = true;
    resetMocks();
  });

  it('should return period status with JE counts', async () => {
    selectResults = [
      [makePeriod()],    // period lookup
      [{ count: 3 }],   // draft count
      [{ count: 10 }],  // posted count
    ];

    const result = await getPeriodStatus({ periodCode: '2026-05' }, makeCtx());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.code).toBe('2026-05');
      expect(result.value.status).toBe('open');
      expect(result.value.draftJournalCount).toBe(3);
      expect(result.value.postedJournalCount).toBe(10);
    }
  });

  it('should reject when period not found', async () => {
    selectResults = [[]];
    const result = await getPeriodStatus({ periodCode: '2026-99' }, makeCtx());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('NOT_FOUND');
    }
  });

  it('should reject without permission', async () => {
    mockPermissionResult = false;
    const result = await getPeriodStatus({ periodCode: '2026-05' }, makeCtx());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('FORBIDDEN');
  });
});

// --- closePeriod Tests ---

describe('closePeriod service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPermissionResult = true;
    resetMocks();
  });

  // --- open → closing ---

  it('should transition open → closing when no drafts', async () => {
    selectResults = [
      [makePeriod({ status: 'open' })],  // period lookup
      [{ count: 0 }],                     // draft JE count
    ];

    const result = await closePeriod({ periodCode: '2026-05' }, makeCtx());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.previousStatus).toBe('open');
      expect(result.value.newStatus).toBe('closing');
      expect(result.value.closedAt).toBeNull();
      expect(result.value.closedBy).toBeNull();
    }
  });

  it('should reject open → closing when drafts exist and force=false', async () => {
    selectResults = [
      [makePeriod({ status: 'open' })],
      [{ count: 5 }],  // 5 draft JEs
    ];

    const result = await closePeriod({ periodCode: '2026-05' }, makeCtx());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('BUSINESS_RULE');
      expect(result.error.messageKey).toBe('accounting.period.hasDraftJournals');
      const details = result.error.details as Record<string, unknown>;
      expect(details.draftCount).toBe(5);
    }
  });

  it('should allow open → closing when drafts exist and force=true', async () => {
    selectResults = [
      [makePeriod({ status: 'open' })],
      // No draft count query when force=true (skipped)
    ];

    const result = await closePeriod({ periodCode: '2026-05', force: true }, makeCtx());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.newStatus).toBe('closing');
    }
  });

  // --- closing → closed ---

  it('should transition closing → closed', async () => {
    selectResults = [
      [makePeriod({ status: 'closing' })],
    ];

    const result = await closePeriod({ periodCode: '2026-05' }, makeCtx());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.previousStatus).toBe('closing');
      expect(result.value.newStatus).toBe('closed');
      expect(result.value.closedAt).toBeInstanceOf(Date);
      expect(result.value.closedBy).toBe('user-001');
    }
  });

  // --- already closed ---

  it('should reject when already closed', async () => {
    selectResults = [
      [makePeriod({ status: 'closed' })],
    ];

    const result = await closePeriod({ periodCode: '2026-05' }, makeCtx());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.messageKey).toBe('accounting.period.alreadyClosed');
    }
  });

  // --- not found ---

  it('should reject when period not found', async () => {
    selectResults = [[]];
    const result = await closePeriod({ periodCode: '2026-99' }, makeCtx());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('NOT_FOUND');
    }
  });

  // --- permission ---

  it('should reject without permission', async () => {
    mockPermissionResult = false;
    const result = await closePeriod({ periodCode: '2026-05' }, makeCtx());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('FORBIDDEN');
  });

  // --- audit ---

  it('should write audit log for open→closing', async () => {
    selectResults = [
      [makePeriod({ status: 'open' })],
      [{ count: 0 }],
    ];

    const result = await closePeriod({ periodCode: '2026-05' }, makeCtx());
    expect(result.ok).toBe(true);
    expect(insertCalls).toHaveLength(1);

    const auditValues = insertCalls[0]?.[0] as Record<string, unknown>;
    expect(auditValues.action).toBe('closing');
    expect(auditValues.entityType).toBe('accounting_period');
  });

  it('should write audit log for closing→closed', async () => {
    selectResults = [
      [makePeriod({ status: 'closing' })],
    ];

    const result = await closePeriod({ periodCode: '2026-05' }, makeCtx());
    expect(result.ok).toBe(true);
    expect(insertCalls).toHaveLength(1);

    const auditValues = insertCalls[0]?.[0] as Record<string, unknown>;
    expect(auditValues.action).toBe('close');

    const before = auditValues.before as Record<string, unknown>;
    expect(before.status).toBe('closing');

    const after = auditValues.after as Record<string, unknown>;
    expect(after.status).toBe('closed');
    expect(after.closedBy).toBe('user-001');
  });

  // --- Zod validation ---

  it('should reject invalid input', async () => {
    const result = await closePeriod({ periodCode: 'bad' } as any, makeCtx());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('VALIDATION_FAILED');
  });
});
