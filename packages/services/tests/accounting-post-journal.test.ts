/**
 * Tests for accounting.postJournal — T-0013
 *
 * Unit tests with mocked DB layer. Tests all validation paths
 * and business rules per SD §20, §21.1.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// --- Sequenced DB Mock ---
// postJournal makes these DB calls in order:
// 1. select().from(journalEntries).where() -> JE lookup
// 2. select().from(accountingPeriods).where() -> period lookup
// 3. select().from(journalLines).where() -> lines fetch
// 4. db.update(journalEntries).set().where().returning() -> status update
// 5. insert(auditLog).values() -> audit

let selectCallIndex = 0;
let selectResults: unknown[][] = [];
const insertCalls: unknown[][] = [];
let updateReturning: unknown[] = [];

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
      set: (..._sArgs: unknown[]) => ({
        where: (..._wArgs: unknown[]) => ({
          returning: () => Promise.resolve(updateReturning),
        }),
      }),
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

import type { AuditContext } from '@erp/shared/types';
// --- Import after mocks ---
import { postJournal } from '../src/accounting/post-journal';
import { PostJournalInputSchema } from '../src/accounting/schemas';

// --- Test data factories ---

function makeCtx(overrides?: Partial<AuditContext>): AuditContext {
  return {
    userId: 'user-001',
    tenantId: 'default',
    locationId: 'loc-mli',
    ipAddress: '127.0.0.1',
    ...overrides,
  };
}

function makeDraftJE(overrides?: Record<string, unknown>) {
  return {
    id: 'je-001',
    tenantId: 'default',
    locationId: 'loc-mli',
    periodId: 'period-2026-05',
    postingDate: '2026-05-15',
    number: 'JE-2026-05-0001',
    description: 'Test journal',
    referenceType: 'manual',
    referenceId: null,
    status: 'draft',
    postedAt: null,
    postedBy: null,
    reversedByJeId: null,
    totalDebit: 100000n,
    totalCredit: 100000n,
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    createdBy: 'user-001',
    updatedBy: 'user-001',
    ...overrides,
  };
}

function makeOpenPeriod(overrides?: Record<string, unknown>) {
  return {
    id: 'period-2026-05',
    tenantId: 'default',
    code: '2026-05',
    startDate: '2026-05-01',
    endDate: '2026-05-31',
    status: 'open',
    closedAt: null,
    closedBy: null,
    ...overrides,
  };
}

function makeLines() {
  return [
    {
      id: 'line-1',
      journalEntryId: 'je-001',
      lineNo: 1,
      accountId: 'acc-cash',
      locationId: 'loc-mli',
      description: null,
      debit: 100000n,
      credit: 0n,
      taxCode: null,
      partnerId: null,
    },
    {
      id: 'line-2',
      journalEntryId: 'je-001',
      lineNo: 2,
      accountId: 'acc-sales',
      locationId: 'loc-mli',
      description: null,
      debit: 0n,
      credit: 100000n,
      taxCode: null,
      partnerId: null,
    },
  ];
}

/** Configure mocked DB select responses for postJournal flow. */
function setupDbMocks(config: {
  je?: ReturnType<typeof makeDraftJE> | null;
  period?: ReturnType<typeof makeOpenPeriod> | null;
  lines?: ReturnType<typeof makeLines>;
  updateSuccess?: boolean;
}) {
  selectCallIndex = 0;
  insertCalls.length = 0;
  selectResults = [];

  // Call 1: JE lookup
  if (config.je === null) {
    selectResults.push([]);
  } else {
    selectResults.push([config.je ?? makeDraftJE()]);
  }

  // Call 2: period lookup
  if (config.period === null) {
    selectResults.push([]);
  } else {
    selectResults.push([config.period ?? makeOpenPeriod()]);
  }

  // Call 3: lines fetch
  selectResults.push(config.lines ?? makeLines());

  // Update returning
  if (config.updateSuccess === false) {
    updateReturning = []; // empty = optimistic lock failed
  } else {
    const je = config.je ?? makeDraftJE();
    updateReturning = [{ ...je, status: 'posted', version: (je.version as number) + 1 }];
  }
}

// --- Tests ---

describe('PostJournalInputSchema (Zod)', () => {
  it('should accept valid input', () => {
    const result = PostJournalInputSchema.safeParse({ journalId: 'je-001' });
    expect(result.success).toBe(true);
  });

  it('should reject empty journalId', () => {
    const result = PostJournalInputSchema.safeParse({ journalId: '' });
    expect(result.success).toBe(false);
  });

  it('should reject missing journalId', () => {
    const result = PostJournalInputSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe('postJournal service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPermissionResult = true;
    selectCallIndex = 0;
    insertCalls.length = 0;
    selectResults = [];
    updateReturning = [];
  });

  it('should reject when JE not found', async () => {
    setupDbMocks({ je: null });
    const result = await postJournal({ journalId: 'je-999' }, makeCtx());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('NOT_FOUND');
      expect(result.error.messageKey).toBe('accounting.journal.notFound');
    }
  });

  it('should reject when user lacks permission', async () => {
    mockPermissionResult = false;
    setupDbMocks({});
    const result = await postJournal({ journalId: 'je-001' }, makeCtx());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('FORBIDDEN');
    }
  });

  it('should reject when JE is already posted', async () => {
    setupDbMocks({ je: makeDraftJE({ status: 'posted' }) });
    const result = await postJournal({ journalId: 'je-001' }, makeCtx());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('BUSINESS_RULE');
      expect(result.error.messageKey).toBe('accounting.journal.notDraft');
    }
  });

  it('should reject when JE is reversed', async () => {
    setupDbMocks({ je: makeDraftJE({ status: 'reversed' }) });
    const result = await postJournal({ journalId: 'je-001' }, makeCtx());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.messageKey).toBe('accounting.journal.notDraft');
    }
  });

  it('should reject when JE is not balanced', async () => {
    setupDbMocks({
      je: makeDraftJE({ totalDebit: 100000n, totalCredit: 90000n }),
    });
    const result = await postJournal({ journalId: 'je-001' }, makeCtx());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.messageKey).toBe('accounting.journal.notBalanced');
    }
  });

  it('should reject zero-value JE', async () => {
    setupDbMocks({
      je: makeDraftJE({ totalDebit: 0n, totalCredit: 0n }),
    });
    const result = await postJournal({ journalId: 'je-001' }, makeCtx());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.messageKey).toBe('accounting.journal.zeroAmount');
    }
  });

  it('should reject when period not found', async () => {
    setupDbMocks({ period: null });
    const result = await postJournal({ journalId: 'je-001' }, makeCtx());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.messageKey).toBe('accounting.journal.periodNotFound');
    }
  });

  it('should reject when period is closed', async () => {
    setupDbMocks({
      period: makeOpenPeriod({ status: 'closed' }),
    });
    const result = await postJournal({ journalId: 'je-001' }, makeCtx());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.messageKey).toBe('accounting.journal.periodClosed');
    }
  });

  it('should reject when period is in closing status', async () => {
    setupDbMocks({
      period: makeOpenPeriod({ status: 'closing' }),
    });
    const result = await postJournal({ journalId: 'je-001' }, makeCtx());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.messageKey).toBe('accounting.journal.periodClosed');
    }
  });

  it('should detect optimistic lock conflict', async () => {
    setupDbMocks({ updateSuccess: false });
    const result = await postJournal({ journalId: 'je-001' }, makeCtx());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('CONFLICT');
      expect(result.error.messageKey).toBe('accounting.journal.concurrentModification');
    }
  });

  it('should post a valid draft JE', async () => {
    setupDbMocks({});
    const result = await postJournal({ journalId: 'je-001' }, makeCtx());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe('posted');
      expect(result.value.id).toBe('je-001');
      expect(result.value.number).toBe('JE-2026-05-0001');
      expect(result.value.totalDebit).toBe(100000n);
      expect(result.value.totalCredit).toBe(100000n);
      expect(result.value.lines).toHaveLength(2);
    }
  });

  it('should write audit log with action=post', async () => {
    setupDbMocks({});
    const result = await postJournal({ journalId: 'je-001' }, makeCtx());
    expect(result.ok).toBe(true);
    // Audit log insert should be the only insert call
    expect(insertCalls).toHaveLength(1);
  });

  it('should include before/after state in audit log', async () => {
    setupDbMocks({});
    const result = await postJournal({ journalId: 'je-001' }, makeCtx());
    expect(result.ok).toBe(true);

    // The first insert call's first arg should be the audit values
    const auditValues = insertCalls[0]?.[0] as Record<string, unknown>;
    expect(auditValues.action).toBe('post');
    expect(auditValues.entityType).toBe('journal_entry');
    expect(auditValues.entityId).toBe('je-001');

    const before = auditValues.before as Record<string, unknown>;
    expect(before.status).toBe('draft');

    const after = auditValues.after as Record<string, unknown>;
    expect(after.status).toBe('posted');
  });

  it('should reject invalid input (Zod)', async () => {
    const result = await postJournal({ journalId: '' }, makeCtx());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('VALIDATION_FAILED');
    }
  });
});
