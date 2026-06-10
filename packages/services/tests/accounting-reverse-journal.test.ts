/**
 * Tests for accounting.reverseJournal — T-0014
 *
 * Unit tests with mocked DB layer. Tests all validation paths
 * and business rules per SD §20.6, §21.1.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// --- Sequenced DB Mock ---
// reverseJournal makes these DB calls in order:
// 1. select().from(journalEntries).where() -> original JE lookup
// 2. select().from(accountingPeriods).where() -> reversal period lookup
// 3. select().from(journalLines).where() -> original lines fetch
// 4. insert(sequences).values().onConflictDoUpdate().returning() -> JE number
// 5. db.update(journalEntries).set().where() -> mark original reversed
// 6. insert(journalEntries).values() -> reversal JE
// 7. insert(journalLines).values() -> reversal lines
// 8. insert(auditLog).values() -> audit reversal creation
// 9. insert(auditLog).values() -> audit original status change

let selectCallIndex = 0;
let selectResults: unknown[][] = [];
let nextSequenceValue = 1;
const insertCalls: unknown[][] = [];

vi.mock('@erp/db', () => ({
  db: {
    select: (..._args: unknown[]) => ({
      from: (..._fArgs: unknown[]) => ({
        where: (..._wArgs: unknown[]) => {
          const idx = selectCallIndex++;
          const rows = selectResults[idx] ?? [];
          const builder = {
            orderBy: () => builder,
            limit: () => builder,
            then: (fn: (r: unknown[]) => unknown) => fn(rows),
          };
          return builder;
        },
      }),
    }),
    update: (..._args: unknown[]) => ({
      set: (..._sArgs: unknown[]) => ({
        where: () => {
          // Support `.where(...)` and `.where(...).returning(...)` for the
          // claim-first reverse pattern.
          const result: any = Promise.resolve([{ id: 'mock-id' }]);
          result.returning = () => Promise.resolve([{ id: 'mock-id' }]);
          return result;
        },
      }),
    }),
    insert: (..._args: unknown[]) => ({
      values: (...vArgs: unknown[]) => {
        const sequenceValues = vArgs[0] as Record<string, unknown> | undefined;
        const isSequenceInsert =
          vArgs.length === 1 &&
          typeof sequenceValues === 'object' &&
          sequenceValues !== null &&
          'name' in sequenceValues &&
          'currentVal' in sequenceValues;

        if (!isSequenceInsert) {
          insertCalls.push(vArgs);
        }

        return {
          onConflictDoUpdate: () => ({
            returning: () => Promise.resolve([{ currentVal: nextSequenceValue++ }]),
          }),
          returning: () => Promise.resolve([{ currentVal: nextSequenceValue++ }]),
          then: (resolve: (value: undefined) => unknown) => resolve(undefined),
        };
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
import { reverseJournal } from '../src/accounting/reverse-journal';
import { ReverseJournalInputSchema } from '../src/accounting/schemas';

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

function makePostedJE(overrides?: Record<string, unknown>) {
  return {
    id: 'je-001',
    tenantId: 'default',
    locationId: 'loc-mli',
    periodId: 'period-2026-05',
    postingDate: '2026-05-15',
    number: 'JE-2026-05-0001',
    description: 'Test posted journal',
    referenceType: 'manual',
    referenceId: null,
    status: 'posted',
    postedAt: new Date('2026-05-15T10:00:00Z'),
    postedBy: 'user-001',
    reversedByJeId: null,
    totalDebit: 100000n,
    totalCredit: 100000n,
    version: 2,
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
    id: 'period-2026-06',
    tenantId: 'default',
    code: '2026-06',
    startDate: '2026-06-01',
    endDate: '2026-06-30',
    status: 'open',
    closedAt: null,
    closedBy: null,
    ...overrides,
  };
}

function makeOriginalLines() {
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

function makeValidInput() {
  return {
    journalId: 'je-001',
    postingDate: '2026-06-01',
  };
}

/** Configure mocked DB responses for reverseJournal flow. */
function setupDbMocks(config: {
  je?: ReturnType<typeof makePostedJE> | null;
  period?: ReturnType<typeof makeOpenPeriod> | null;
  lines?: ReturnType<typeof makeOriginalLines>;
  jeCount?: number;
}) {
  selectCallIndex = 0;
  insertCalls.length = 0;
  nextSequenceValue = (config.jeCount ?? 0) + 1;
  selectResults = [];

  // Call 1: original JE lookup
  if (config.je === null) {
    selectResults.push([]);
  } else {
    selectResults.push([config.je ?? makePostedJE()]);
  }

  // Call 2: reversal period lookup
  if (config.period === null) {
    selectResults.push([]);
  } else {
    selectResults.push([config.period ?? makeOpenPeriod()]);
  }

  // Call 3: original lines fetch
  selectResults.push(config.lines ?? makeOriginalLines());

  // JE numbering uses the sequences table mock through nextSequenceValue.
}

// --- Tests ---

describe('ReverseJournalInputSchema (Zod)', () => {
  it('should accept valid input', () => {
    const result = ReverseJournalInputSchema.safeParse(makeValidInput());
    expect(result.success).toBe(true);
  });

  it('should reject empty journalId', () => {
    const result = ReverseJournalInputSchema.safeParse({
      journalId: '',
      postingDate: '2026-06-01',
    });
    expect(result.success).toBe(false);
  });

  it('should reject invalid posting date format', () => {
    const result = ReverseJournalInputSchema.safeParse({
      journalId: 'je-001',
      postingDate: '01-06-2026',
    });
    expect(result.success).toBe(false);
  });

  it('should reject missing fields', () => {
    expect(ReverseJournalInputSchema.safeParse({}).success).toBe(false);
    expect(ReverseJournalInputSchema.safeParse({ journalId: 'je-001' }).success).toBe(false);
  });
});

describe('reverseJournal service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPermissionResult = true;
    selectCallIndex = 0;
    insertCalls.length = 0;
    nextSequenceValue = 1;
    selectResults = [];
  });

  it('should reject when original JE not found', async () => {
    setupDbMocks({ je: null });
    const result = await reverseJournal(makeValidInput(), makeCtx());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('NOT_FOUND');
      expect(result.error.messageKey).toBe('accounting.journal.notFound');
    }
  });

  it('should reject when user lacks permission', async () => {
    mockPermissionResult = false;
    setupDbMocks({});
    const result = await reverseJournal(makeValidInput(), makeCtx());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('FORBIDDEN');
    }
  });

  it('should reject when JE is still draft', async () => {
    setupDbMocks({ je: makePostedJE({ status: 'draft' }) });
    const result = await reverseJournal(makeValidInput(), makeCtx());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('BUSINESS_RULE');
      expect(result.error.messageKey).toBe('accounting.journal.cannotReverse');
    }
  });

  it('should reject when JE is already reversed', async () => {
    setupDbMocks({ je: makePostedJE({ status: 'reversed' }) });
    const result = await reverseJournal(makeValidInput(), makeCtx());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.messageKey).toBe('accounting.journal.cannotReverse');
    }
  });

  it('should reject when reversal period not found', async () => {
    setupDbMocks({ period: null });
    const result = await reverseJournal(makeValidInput(), makeCtx());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.messageKey).toBe('accounting.journal.periodNotFound');
    }
  });

  it('should reject when reversal period is closed', async () => {
    setupDbMocks({
      period: makeOpenPeriod({ status: 'closed' }),
    });
    const result = await reverseJournal(makeValidInput(), makeCtx());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.messageKey).toBe('accounting.journal.periodClosed');
    }
  });

  it('should reject when reversal period is closing', async () => {
    setupDbMocks({
      period: makeOpenPeriod({ status: 'closing' }),
    });
    const result = await reverseJournal(makeValidInput(), makeCtx());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.messageKey).toBe('accounting.journal.periodClosed');
    }
  });

  it('should reject when original has no lines', async () => {
    setupDbMocks({ lines: [] });
    const result = await reverseJournal(makeValidInput(), makeCtx());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('INTERNAL');
    }
  });

  it('should create a reversal JE with swapped amounts', async () => {
    setupDbMocks({});
    const result = await reverseJournal(makeValidInput(), makeCtx());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe('posted');
      expect(result.value.description).toContain('Reversal of JE-2026-05-0001');
      expect(result.value.postingDate).toBe('2026-06-01');
      expect(result.value.totalDebit).toBe(100000n);
      expect(result.value.totalCredit).toBe(100000n);
      expect(result.value.lines).toHaveLength(2);

      // Verify amounts are swapped:
      // Original line 1: debit=100000, credit=0 → reversal: debit=0, credit=100000
      const line1 = result.value.lines.find((l) => l.accountId === 'acc-cash');
      expect(line1?.debit).toBe(0n);
      expect(line1?.credit).toBe(100000n);

      // Original line 2: debit=0, credit=100000 → reversal: debit=100000, credit=0
      const line2 = result.value.lines.find((l) => l.accountId === 'acc-sales');
      expect(line2?.debit).toBe(100000n);
      expect(line2?.credit).toBe(0n);
    }
  });

  it('should generate a new JE number for the reversal', async () => {
    setupDbMocks({});
    const result = await reverseJournal(makeValidInput(), makeCtx());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.number).toMatch(/^JE-2026-06-\d{4}$/);
    }
  });

  it('should use the reversal period, not the original period', async () => {
    setupDbMocks({});
    const result = await reverseJournal(makeValidInput(), makeCtx());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.periodId).toBe('period-2026-06');
    }
  });

  it('should write two audit log entries', async () => {
    setupDbMocks({});
    const result = await reverseJournal(makeValidInput(), makeCtx());
    expect(result.ok).toBe(true);

    // Inserts: reversal JE (1) + reversal lines (2) + update original (via .update, not counted) + audit×2 (3,4)
    // insert calls: JE insert, lines insert, audit create, audit reverse = 4
    expect(insertCalls).toHaveLength(4);

    // Last two inserts should be audit logs
    const auditCreate = insertCalls[2]?.[0] as Record<string, unknown>;
    expect(auditCreate.action).toBe('create');
    expect(auditCreate.entityType).toBe('journal_entry');

    const auditReverse = insertCalls[3]?.[0] as Record<string, unknown>;
    expect(auditReverse.action).toBe('reverse');
    expect(auditReverse.entityId).toBe('je-001');
  });

  it('should handle multi-line JE reversal correctly', async () => {
    const threeLines = [
      ...makeOriginalLines(),
      {
        id: 'line-3',
        journalEntryId: 'je-001',
        lineNo: 3,
        accountId: 'acc-tax',
        locationId: 'loc-mli',
        description: 'PB1',
        debit: 0n,
        credit: 3000n,
        taxCode: 'PB1',
        partnerId: null,
      },
    ];
    // Adjust totals: debit=103000, credit=103000
    setupDbMocks({
      je: makePostedJE({ totalDebit: 103000n, totalCredit: 103000n }),
      lines: threeLines,
    });

    const result = await reverseJournal(makeValidInput(), makeCtx());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.lines).toHaveLength(3);

      // Tax line should be reversed too
      const taxLine = result.value.lines.find((l) => l.taxCode === 'PB1');
      expect(taxLine?.debit).toBe(3000n);
      expect(taxLine?.credit).toBe(0n);
    }
  });

  it('should reject invalid Zod input', async () => {
    const result = await reverseJournal({ journalId: '', postingDate: 'bad' }, makeCtx());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('VALIDATION_FAILED');
    }
  });
});
